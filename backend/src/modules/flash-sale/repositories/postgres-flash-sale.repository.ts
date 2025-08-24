import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { IFlashSaleRepository } from '../../../domain/repositories/iflash-sale.repository';
import { FlashSaleStatus, UserPurchase } from '../../../domain/entities/flash-sale.entity';
import { Purchase } from '../../../database/entities/purchase.entity';
import { FlashSale } from '../../../database/entities/flash-sale.entity';
import { User } from '../../../database/entities/user.entity';
import { ConfigService } from '@nestjs/config';
import { logger } from '../../../utils/logger';

@Injectable()
export class PostgresFlashSaleRepository implements IFlashSaleRepository {
  constructor(
    @InjectRepository(Purchase)
    private purchaseRepository: Repository<Purchase>,
    @InjectRepository(FlashSale)
    private flashSaleRepository: Repository<FlashSale>,
    private configService: ConfigService,
    @InjectDataSource()
    private dataSource: DataSource,
  ) {}

  async getStatus(): Promise<FlashSaleStatus> {
    try {
      const flashSale = await this.flashSaleRepository.findOne({ 
        where: { is_active: true },
        order: { created_at: 'DESC' }
      });

      if (!flashSale) {
        throw new Error('No active flash sale found');
      }

      const stock = flashSale.current_stock;
      const now = new Date();
      const startTime = flashSale.start_time;
      const endTime = flashSale.end_time;
      
      let status: FlashSaleStatus['status'];
      let timeUntilStart: number | undefined;
      let timeUntilEnd: number | undefined;

      if (now < startTime) {
        status = 'upcoming';
        timeUntilStart = startTime.getTime() - now.getTime();
      } else if (now >= startTime && now <= endTime) {
        status = stock > 0 ? 'active' : 'sold-out';
        timeUntilEnd = endTime.getTime() - now.getTime();
      } else {
        status = 'ended';
      }

      return {
        status,
        startTime: startTime,
        endTime: endTime,
        currentStock: stock,
        maxStock: flashSale.max_stock,
        timeUntilStart,
        timeUntilEnd
      };
    } catch (error) {
      logger.error('Failed to get flash sale status:', error);
      // Return default status if no flash sale found
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

  async getCurrentStock(): Promise<number> {
    try {
      let flashSale = await this.flashSaleRepository.findOne({ 
        where: { is_active: true },
        order: { created_at: 'DESC' }
      });
      
      if (!flashSale) {
        // Create default flash sale if none exists
        flashSale = this.flashSaleRepository.create({
          product_name: 'Default Product',
          description: 'Default description',
          details: { condition: 'New', warranty: '1 year', weight: '100g' },
          specification: {},
          important_info: { see_in_ui: 'Default info' },
          images: { main: '', thumbnails: [], gallery: [] },
          current_stock: this.configService.get('flashSale.maxStock') || 5,
          max_stock: this.configService.get('flashSale.maxStock') || 5,
          start_time: new Date(),
          end_time: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
          is_active: true,
          price: 0,
          currency_code: 'USD',
          currency_symbol: '$',
          discount: 0,
          price_after_discount: 0
        });
        await this.flashSaleRepository.save(flashSale);
      }
      
      return flashSale.current_stock;
    } catch (error) {
      logger.error('Failed to get current stock:', error);
      return 0;
    }
  }

  async updateStock(newStock: number): Promise<void> {
    try {
      const flashSale = await this.flashSaleRepository.findOne({ 
        where: { is_active: true },
        order: { created_at: 'DESC' }
      });
      
      if (flashSale) {
        await this.flashSaleRepository.update(
          { id: flashSale.id },
          { current_stock: Math.max(0, newStock) }
        );
      }
    } catch (error) {
      logger.error('Failed to update stock:', error);
      throw error;
    }
  }

  async decreaseStock(amount: number = 1): Promise<boolean> {
    try {
      // First get the active flash sale
      const flashSale = await this.flashSaleRepository.findOne({
        where: { is_active: true },
        order: { created_at: 'DESC' }
      });
      
      if (!flashSale) {
        return false;
      }

      // Check if we have enough stock
      if (flashSale.current_stock < amount) {
        return false;
      }

      // Update stock atomically
      const result = await this.flashSaleRepository.update(
        { id: flashSale.id },
        { current_stock: flashSale.current_stock - amount }
      );

      // Check if any rows were affected (stock was decreased)
      return result.affected > 0;
    } catch (error) {
      logger.error('Failed to decrease stock atomically:', error);
      throw error;
    }
  }

  async hasUserPurchased(username: string): Promise<boolean> {
    try {
      // First find the user by username to get their UUID
      const user = await this.dataSource.getRepository('User').findOne({
        where: { username }
      });
      
      if (!user) {
        return false;
      }

      // Get the active flash sale
      const activeFlashSale = await this.flashSaleRepository.findOne({
        where: { is_active: true },
        order: { created_at: 'DESC' }
      });

      if (!activeFlashSale) {
        return false; // No active flash sale, so user hasn't purchased
      }

      // Check if user has purchased in the CURRENT active flash sale only
      const purchase = await this.purchaseRepository.findOne({
        where: { 
          userId: user.id,
          flash_sale_id: activeFlashSale.id // Only check current flash sale
        }
      });
      return !!purchase;
    } catch (error) {
      logger.error('Failed to check if user has purchased:', error);
      return false;
    }
  }

  async recordPurchase(username: string, purchaseId: string): Promise<void> {
    try {
      // First find the user by username to get their UUID
      const user = await this.dataSource.getRepository('User').findOne({
        where: { username }
      });
      
      if (!user) {
        throw new Error(`User not found: ${username}`);
      }

      // Get the active flash sale
      const flashSale = await this.flashSaleRepository.findOne({
        where: { is_active: true },
        order: { created_at: 'DESC' }
      });

      if (!flashSale) {
        throw new Error('No active flash sale found');
      }

      const purchase = this.purchaseRepository.create({
        userId: user.id, // Use the UUID from the user entity
        purchaseId,
        flash_sale_id: flashSale.id,
        timestamp: new Date(),
      });
      await this.purchaseRepository.save(purchase);
    } catch (error) {
      logger.error('Failed to record purchase:', error);
      throw error;
    }
  }

  async getUserPurchase(username: string): Promise<UserPurchase | null> {
    try {
      // First find the user by username to get their UUID
      const user = await this.dataSource.getRepository('User').findOne({
        where: { username }
      });
      
      if (!user) {
        return null;
      }

      // Get the active flash sale
      const activeFlashSale = await this.flashSaleRepository.findOne({
        where: { is_active: true },
        order: { created_at: 'DESC' }
      });

      if (!activeFlashSale) {
        return null; // No active flash sale
      }

      // Check if user has purchased in the CURRENT active flash sale only
      const purchase = await this.purchaseRepository.findOne({
        where: { 
          userId: user.id,
          flash_sale_id: activeFlashSale.id // Only check current flash sale
        }
      });
      
      if (!purchase) return null;
      
      return {
        userId: username, // Return the username, not the UUID
        purchaseId: purchase.purchaseId,
        timestamp: purchase.timestamp,
      };
    } catch (error) {
      logger.error('Failed to get user purchase:', error);
      return null;
    }
  }

  async getAllPurchases(): Promise<UserPurchase[]> {
    try {
      const purchases = await this.purchaseRepository.find({
        relations: ['user']
      });
      return purchases.map(p => ({
        userId: p.user?.username || p.userId, // Use username if available, fallback to UUID
        purchaseId: p.purchaseId,
        timestamp: p.timestamp,
      }));
    } catch (error) {
      logger.error('Failed to get all purchases:', error);
      return [];
    }
  }

  async resetStock(): Promise<void> {
    try {
      const flashSale = await this.flashSaleRepository.findOne({ 
        where: { is_active: true },
        order: { created_at: 'DESC' }
      });
      
      if (flashSale) {
        await this.flashSaleRepository.update(
          { id: flashSale.id },
          { current_stock: this.configService.get('flashSale.maxStock') || 5 }
        );
        logger.info('Stock reset to initial value');
      }
    } catch (error) {
      logger.error('Failed to reset stock:', error);
      throw error;
    }
  }

  async resetPurchases(): Promise<void> {
    try {
      // Use delete instead of clear to avoid TRUNCATE issues
      const purchases = await this.purchaseRepository.find();
      if (purchases.length > 0) {
        await this.purchaseRepository.remove(purchases);
      }
      logger.info('All purchases reset');
    } catch (error) {
      logger.error('Failed to reset purchases:', error);
      throw error;
    }
  }

  async setCurrentFlashSale(flashSaleId: string): Promise<void> {
    try {
      // For PostgreSQL, we don't need to track current flash sale ID
      // as it's handled by the is_active flag in the flash_sales table
      logger.info('Current flash sale set (PostgreSQL handles this via is_active flag)');
    } catch (error) {
      logger.error('Failed to set current flash sale:', error);
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
      
      // Record purchase
      await this.recordPurchase(username, transactionId);
      
      return { 
        success: true, 
        transactionId,
        message: 'Purchase successful'
      };
    } catch (error) {
      logger.error('Failed to process purchase:', error);
      return { success: false, message: 'Purchase failed' };
    }
  }
}
