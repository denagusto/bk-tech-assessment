import { Injectable } from '@nestjs/common';
import { IFlashSaleRepository } from '../../../domain/repositories/iflash-sale.repository';
import { FlashSaleStatus, UserPurchase } from '../../../domain/entities/flash-sale.entity';
import { RedisService } from '../../redis/redis.service';
import { DataSource } from 'typeorm';
import { FlashSale } from '../../../database/entities/flash-sale.entity';
import { KafkaService } from '../../kafka/kafka.service';

@Injectable()
export class RedisFlashSaleRepository implements IFlashSaleRepository {
  private readonly STOCK_KEY = 'flash_sale:stock';
  private readonly MAX_STOCK_KEY = 'flash_sale:max_stock';
  private readonly START_TIME_KEY = 'flash_sale:start_time';
  private readonly END_TIME_KEY = 'flash_sale:end_time';
  private readonly PURCHASES_KEY = 'flash_sale:purchases';
  private readonly USER_PURCHASES_KEY = 'flash_sale:user_purchases';
  private readonly CURRENT_FLASH_SALE_KEY = 'flash_sale:current_id';
  private readonly STATUS_CACHE_KEY = 'flash_sale:status_cache';
  private readonly CACHE_TTL = 300; // 5 minutes cache

  constructor(
    private readonly redisService: RedisService,
    private readonly dataSource: DataSource,
    private readonly kafkaService: KafkaService,
  ) {}

  async getStatus(): Promise<FlashSaleStatus> {
    try {
      // Try to get from Redis cache first
      const cachedStatus = await this.redisService.get(this.STATUS_CACHE_KEY);
      if (cachedStatus) {
        try {
          const parsed = JSON.parse(cachedStatus);
          // Check if cache is still valid
          if (parsed.timestamp && (Date.now() - parsed.timestamp) < (this.CACHE_TTL * 1000)) {
            return parsed.data;
          }
        } catch (e) {
          // Invalid cache, continue to fetch fresh data
        }
      }

      // Get data from Redis or fallback to database
      const currentStock = await this.getCurrentStock();
      const maxStock = await this.getMaxStock();
      const startTime = await this.getStartTime();
      const endTime = await this.getEndTime();

      const now = new Date();
      
      let status: FlashSaleStatus['status'];
      let timeUntilStart: number | undefined;
      let timeUntilEnd: number | undefined;

      if (now < startTime) {
        status = 'upcoming';
        timeUntilStart = startTime.getTime() - now.getTime();
      } else if (now >= startTime && now <= endTime) {
        status = currentStock > 0 ? 'active' : 'sold-out';
        timeUntilEnd = endTime.getTime() - now.getTime();
      } else {
        status = 'ended';
      }

      const flashSaleStatus: FlashSaleStatus = {
        status,
        startTime,
        endTime,
        currentStock,
        maxStock,
        timeUntilStart,
        timeUntilEnd
      };

      // Cache the result in Redis
      await this.redisService.setex(
        this.STATUS_CACHE_KEY, 
        this.CACHE_TTL, 
        JSON.stringify({
          data: flashSaleStatus,
          timestamp: Date.now()
        })
      );

      return flashSaleStatus;
    } catch (error) {
      console.error('Failed to get flash sale status:', error);
      // Return default status if everything fails
      return {
        status: 'ended',
        startTime: new Date(),
        endTime: new Date(),
        currentStock: 0,
        maxStock: 0,
        timeUntilStart: undefined,
        timeUntilEnd: undefined
      };
    }
  }

  async updateStock(newStock: number): Promise<void> {
    try {
      // Use atomic operation to ensure stock consistency
      await this.redisService.set(this.STOCK_KEY, Math.max(0, newStock).toString());
    } catch (error) {
      console.error('Failed to update stock:', error);
      throw error;
    }
  }

  async decreaseStock(amount: number = 1): Promise<boolean> {
    try {
      // Get current stock from Redis
      const stock = await this.redisService.get(this.STOCK_KEY);
      if (!stock) {
        // If Redis doesn't have stock, get from database and cache
        const flashSale = await this.dataSource.getRepository(FlashSale).findOne({
          where: { is_active: true },
          order: { created_at: 'DESC' }
        });
        
        if (flashSale) {
          await this.redisService.set(this.STOCK_KEY, flashSale.current_stock.toString());
          
          // Also set the current flash sale ID
          await this.redisService.set(this.CURRENT_FLASH_SALE_KEY, flashSale.id);
          
          if (flashSale.current_stock < amount) {
            return false;
          }
        } else {
          return false;
        }
      } else {
        const currentStock = parseInt(stock);
        if (currentStock < amount) {
          return false;
        }
      }

      // Decrease stock atomically using Redis decrBy
      const newStock = await this.redisService.decrBy(this.STOCK_KEY, amount);
      
      // Clear status cache to force refresh
      await this.redisService.del(this.STATUS_CACHE_KEY);
      
      return newStock >= 0;
    } catch (error) {
      console.error('Failed to decrease stock atomically:', error);
      return false;
    }
  }

  async processPurchase(username: string, amount: number = 1): Promise<{ success: boolean; transactionId?: string; message?: string }> {
    try {
      // Check if user already purchased
      const hasPurchased = await this.hasUserPurchased(username);
      if (hasPurchased) {
        return { success: false, message: 'User has already purchased' };
      }

      // Check if we have enough stock
      const canDecrease = await this.decreaseStock(amount);
      if (!canDecrease) {
        return { success: false, message: 'Insufficient stock' };
      }

      // Generate transaction ID
      const transactionId = `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Record purchase in Redis immediately
      await this.recordPurchase(username, transactionId);
      
      // Emit Kafka event for async database sync
      await this.kafkaService.publish('flash-sale-transactions', {
        key: username,
        value: {
          username,
          flashSaleId: await this.getCurrentFlashSaleId(),
          amount,
          timestamp: new Date().toISOString(),
          redisTransactionId: transactionId,
          kafkaTimestamp: new Date().toISOString()
        },
        topic: 'flash-sale-transactions'
      });

      // Clear status cache to force refresh
      await this.redisService.del(this.STATUS_CACHE_KEY);
      
      return { 
        success: true, 
        transactionId,
        message: 'Purchase successful'
      };
    } catch (error) {
      console.error('Failed to process purchase:', error);
      return { success: false, message: 'Purchase failed' };
    }
  }

  public async getCurrentStock(): Promise<number> {
    try {
      // Try Redis first
      const stock = await this.redisService.get(this.STOCK_KEY);
      if (stock) {
        return parseInt(stock);
      }

      // Fallback to database
      const flashSale = await this.dataSource.getRepository(FlashSale).findOne({
        where: { is_active: true },
        order: { created_at: 'DESC' }
      });

      if (flashSale) {
        // Cache the stock in Redis
        await this.redisService.set(this.STOCK_KEY, flashSale.current_stock.toString());
        
        // Also set the current flash sale ID
        await this.redisService.set(this.CURRENT_FLASH_SALE_KEY, flashSale.id);
        
        return flashSale.current_stock;
      }

      return 5; // Default fallback
    } catch (error) {
      console.error('Failed to get current stock:', error);
      return 5;
    }
  }

  private async getMaxStock(): Promise<number> {
    try {
      // Try Redis first
      const maxStock = await this.redisService.get(this.MAX_STOCK_KEY);
      if (maxStock) {
        return parseInt(maxStock);
      }

      // Fallback to database
      const flashSale = await this.dataSource.getRepository(FlashSale).findOne({
        where: { is_active: true },
        order: { created_at: 'DESC' }
      });

      if (flashSale) {
        // Cache the max stock in Redis
        await this.redisService.set(this.MAX_STOCK_KEY, flashSale.max_stock.toString());
        
        // Also set the current flash sale ID
        await this.redisService.set(this.CURRENT_FLASH_SALE_KEY, flashSale.id);
        
        return flashSale.max_stock;
      }

      return 5; // Default fallback
    } catch (error) {
      console.error('Failed to get max stock:', error);
      return 5;
    }
  }

  private async getStartTime(): Promise<Date> {
    try {
      // Try Redis first
      const startTime = await this.redisService.get(this.START_TIME_KEY);
      if (startTime) {
        return new Date(startTime);
      }

      // Fallback to database
      const flashSale = await this.dataSource.getRepository(FlashSale).findOne({
        where: { is_active: true },
        order: { created_at: 'DESC' }
      });

      if (flashSale) {
        // Cache the start time in Redis
        await this.redisService.set(this.START_TIME_KEY, flashSale.start_time.toISOString());
        
        // Also set the current flash sale ID
        await this.redisService.set(this.CURRENT_FLASH_SALE_KEY, flashSale.id);
        
        return flashSale.start_time;
      }

      return new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago as default
    } catch (error) {
      console.error('Failed to get start time:', error);
      return new Date(Date.now() - 24 * 60 * 60 * 1000);
    }
  }

  private async getEndTime(): Promise<Date> {
    try {
      // Try Redis first
      const endTime = await this.redisService.get(this.END_TIME_KEY);
      if (endTime) {
        return new Date(endTime);
      }

      // Fallback to database
      const flashSale = await this.dataSource.getRepository(FlashSale).findOne({
        where: { is_active: true },
        order: { created_at: 'DESC' }
      });

      if (flashSale) {
        // Cache the end time in Redis
        await this.redisService.set(this.END_TIME_KEY, flashSale.end_time.toISOString());
        
        // Also set the current flash sale ID
        await this.redisService.set(this.CURRENT_FLASH_SALE_KEY, flashSale.id);
        
        return flashSale.end_time;
      }

      return new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now as default
    } catch (error) {
      console.error('Failed to get end time:', error);
      return new Date(Date.now() + 24 * 60 * 60 * 1000);
    }
  }

  async hasUserPurchased(userId: string): Promise<boolean> {
    try {
      // Get current flash sale ID from Redis, fallback to database
      let currentFlashSaleId = await this.redisService.get(this.CURRENT_FLASH_SALE_KEY);
      if (!currentFlashSaleId) {
        // Fallback to database to get active flash sale
        const flashSale = await this.dataSource.getRepository(FlashSale).findOne({
          where: { is_active: true },
          order: { created_at: 'DESC' }
        });
        
        if (flashSale) {
          currentFlashSaleId = flashSale.id;
          // Set the key in Redis for future use
          await this.redisService.set(this.CURRENT_FLASH_SALE_KEY, currentFlashSaleId);
        } else {
          return false; // No active flash sale
        }
      }

      // Check if user has purchased in current flash sale
      const userPurchaseKey = `${this.USER_PURCHASES_KEY}:${currentFlashSaleId}`;
      const hasPurchased = await this.redisService.hexists(userPurchaseKey, userId);
      return hasPurchased;
    } catch (error) {
      console.error('Failed to check user purchase:', error);
      return false;
    }
  }

  async recordPurchase(userId: string, purchaseId: string): Promise<void> {
    try {
      // Get current flash sale ID from Redis, fallback to database
      let currentFlashSaleId = await this.redisService.get(this.CURRENT_FLASH_SALE_KEY);
      if (!currentFlashSaleId) {
        // Fallback to database to get active flash sale
        const flashSale = await this.dataSource.getRepository(FlashSale).findOne({
          where: { is_active: true },
          order: { created_at: 'DESC' }
        });
        
        if (flashSale) {
          currentFlashSaleId = flashSale.id;
          // Set the key in Redis for future use
          await this.redisService.set(this.CURRENT_FLASH_SALE_KEY, currentFlashSaleId);
        } else {
          throw new Error('No active flash sale found');
        }
      }

      const timestamp = new Date().toISOString();
      const purchaseData = JSON.stringify({
        userId,
        purchaseId,
        timestamp,
        flashSaleId: currentFlashSaleId
      });

      // Store purchase with flash sale context
      const userPurchaseKey = `${this.USER_PURCHASES_KEY}:${currentFlashSaleId}`;
      await this.redisService.hset(userPurchaseKey, userId, purchaseId);
      await this.redisService.hset(this.PURCHASES_KEY, purchaseId, purchaseData);
    } catch (error) {
      console.error('Failed to record purchase:', error);
      throw error;
    }
  }

  async getUserPurchase(userId: string): Promise<UserPurchase | null> {
    try {
      // Get current flash sale ID from Redis, fallback to database
      let currentFlashSaleId = await this.redisService.get(this.CURRENT_FLASH_SALE_KEY);
      if (!currentFlashSaleId) {
        // Fallback to database to get active flash sale
        const flashSale = await this.dataSource.getRepository(FlashSale).findOne({
          where: { is_active: true },
          order: { created_at: 'DESC' }
        });
        
        if (flashSale) {
          currentFlashSaleId = flashSale.id;
          // Set the key in Redis for future use
          await this.redisService.set(this.CURRENT_FLASH_SALE_KEY, currentFlashSaleId);
        } else {
          return null; // No active flash sale
        }
      }

      // Check purchase in current flash sale
      const userPurchaseKey = `${this.USER_PURCHASES_KEY}:${currentFlashSaleId}`;
      const purchaseId = await this.redisService.hget(userPurchaseKey, userId);
      if (!purchaseId) return null;

      const purchaseData = await this.redisService.hget(this.PURCHASES_KEY, purchaseId);
      if (!purchaseData) return null;

      const purchase = JSON.parse(purchaseData);
      return {
        userId: purchase.userId,
        purchaseId: purchase.purchaseId,
        timestamp: new Date(purchase.timestamp)
      };
    } catch (error) {
      console.error('Failed to get user purchase:', error);
      return null;
    }
  }

  async getAllPurchases(): Promise<UserPurchase[]> {
    try {
      const purchases = await this.redisService.hgetall(this.PURCHASES_KEY);
      return Object.values(purchases)
        .map(purchaseData => {
          try {
            const parsed = JSON.parse(purchaseData);
            return {
              userId: parsed.userId,
              purchaseId: parsed.purchaseId,
              timestamp: new Date(parsed.timestamp)
            };
          } catch {
            return null;
          }
        })
        .filter((purchase): purchase is UserPurchase => purchase !== null);
    } catch (error) {
      console.error('Failed to get all purchases:', error);
      return [];
    }
  }

  async resetStock(): Promise<void> {
    try {
      // Get fresh data from database
      const flashSale = await this.dataSource.getRepository(FlashSale).findOne({
        where: { is_active: true },
        order: { created_at: 'DESC' }
      });

      if (flashSale) {
        // Update database to reset stock to max_stock
        await this.dataSource.getRepository(FlashSale).update(
          { id: flashSale.id },
          { current_stock: flashSale.max_stock }
        );
        
        // Update Redis with fresh data from database
        await this.redisService.set(this.STOCK_KEY, flashSale.max_stock.toString());
        await this.redisService.set(this.MAX_STOCK_KEY, flashSale.max_stock.toString());
        await this.redisService.set(this.START_TIME_KEY, flashSale.start_time.toISOString());
        await this.redisService.set(this.END_TIME_KEY, flashSale.end_time.toISOString());
        
        // Set current flash sale ID
        await this.redisService.set(this.CURRENT_FLASH_SALE_KEY, flashSale.id);
        
        await this.redisService.del(this.STATUS_CACHE_KEY);
        console.info('Stock reset to max stock value from database');
      } else {
        // Fallback to default values
        await this.redisService.set(this.STOCK_KEY, '5');
        await this.redisService.set(this.MAX_STOCK_KEY, '5');
        await this.redisService.set(this.CURRENT_FLASH_SALE_KEY, 'default');
        await this.redisService.del(this.STATUS_CACHE_KEY);
        console.info('Stock reset to default value (5)');
      }
    } catch (error) {
      console.error('Failed to reset stock:', error);
      throw error;
    }
  }

  async resetPurchases(): Promise<void> {
    try {
      // Clear all purchase data from Redis
      await this.redisService.del(this.PURCHASES_KEY);
      await this.redisService.del(this.USER_PURCHASES_KEY);
      
      // Clear all flash sale specific user purchase keys
      // Get current flash sale ID to clear specific keys
      let currentFlashSaleId = await this.redisService.get(this.CURRENT_FLASH_SALE_KEY);
      if (!currentFlashSaleId) {
        // Fallback to database to get active flash sale
        const flashSale = await this.dataSource.getRepository(FlashSale).findOne({
          where: { is_active: true },
          order: { created_at: 'DESC' }
        });
        
        if (flashSale) {
          currentFlashSaleId = flashSale.id;
        }
      }
      
      if (currentFlashSaleId && currentFlashSaleId !== 'default') {
        // Clear the specific flash sale user purchases key
        const specificUserPurchaseKey = `${this.USER_PURCHASES_KEY}:${currentFlashSaleId}`;
        await this.redisService.del(specificUserPurchaseKey);
        console.info(`Cleared specific user purchases key: ${specificUserPurchaseKey}`);
      }
      
      // Clear status cache to force refresh
      await this.redisService.del(this.STATUS_CACHE_KEY);
      
      // Clear purchases from database
      const purchaseRepository = this.dataSource.getRepository('Purchase');
      const purchases = await purchaseRepository.find();
      if (purchases.length > 0) {
        await purchaseRepository.remove(purchases);
      }
      
      // Reset stock to fresh value from database (this will also set CURRENT_FLASH_SALE_KEY)
      await this.resetStock();
      
      console.info('All purchases reset and stock refreshed');
    } catch (error) {
      console.error('Failed to reset purchases:', error);
      throw error;
    }
  }

  async setCurrentFlashSale(flashSaleId: string): Promise<void> {
    try {
      await this.redisService.set(this.CURRENT_FLASH_SALE_KEY, flashSaleId);
    } catch (error) {
      console.error('Failed to set current flash sale:', error);
      throw error;
    }
  }

  private async getCurrentFlashSaleId(): Promise<string> {
    try {
      const flashSale = await this.dataSource.getRepository(FlashSale).findOne({
        where: { is_active: true },
        order: { created_at: 'DESC' }
      });
      
      if (flashSale) {
        // Set the key in Redis for future use
        await this.redisService.set(this.CURRENT_FLASH_SALE_KEY, flashSale.id);
        return flashSale.id;
      }
      
      return 'default';
    } catch (error) {
      return 'default';
    }
  }

  async resetSystem(): Promise<void> {
    try {
      // Get fresh data from database
      const flashSale = await this.dataSource.getRepository(FlashSale).findOne({
        where: { is_active: true },
        order: { created_at: 'DESC' }
      });

      if (flashSale) {
        // Update Redis with fresh data from database
        await this.redisService.set(this.STOCK_KEY, flashSale.current_stock.toString());
        await this.redisService.set(this.MAX_STOCK_KEY, flashSale.max_stock.toString());
        await this.redisService.set(this.START_TIME_KEY, flashSale.start_time.toISOString());
        await this.redisService.set(this.END_TIME_KEY, flashSale.end_time.toISOString());
        
        // Set current flash sale ID
        await this.redisService.set(this.CURRENT_FLASH_SALE_KEY, flashSale.id);
        
        console.info('Redis reset with fresh data from database');
      } else {
        // Fallback to default values if no flash sale found
        await this.redisService.set(this.STOCK_KEY, '5');
        await this.redisService.set(this.MAX_STOCK_KEY, '5');
        await this.redisService.set(this.START_TIME_KEY, new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
        await this.redisService.set(this.END_TIME_KEY, new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString());
        
        // Set a default flash sale ID
        await this.redisService.set(this.CURRENT_FLASH_SALE_KEY, 'default');
        
        console.info('Redis reset with default values (5 stock)');
      }

      // Clear all purchase data from Redis
      await this.redisService.del(this.PURCHASES_KEY);
      await this.redisService.del(this.USER_PURCHASES_KEY);
      
      // Clear all flash sale specific user purchase keys
      let currentFlashSaleId = await this.redisService.get(this.CURRENT_FLASH_SALE_KEY);
      if (currentFlashSaleId && currentFlashSaleId !== 'default') {
        // Clear the specific flash sale user purchases key
        const specificUserPurchaseKey = `${this.USER_PURCHASES_KEY}:${currentFlashSaleId}`;
        await this.redisService.del(specificUserPurchaseKey);
        console.info(`Cleared specific user purchases key: ${specificUserPurchaseKey}`);
      }
      
      // Clear status cache to force refresh
      await this.redisService.del(this.STATUS_CACHE_KEY);
      
      console.info('System reset completed: Redis cleared and refreshed with database data');
    } catch (error) {
      console.error('Failed to reset system:', error);
      throw error;
    }
  }
}
