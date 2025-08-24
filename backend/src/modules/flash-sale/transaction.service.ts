import { Injectable, Logger, Inject } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { RedisService } from '../redis/redis.service';
import { KafkaService } from '../kafka/kafka.service';
import { IFlashSaleRepository } from '../../domain/repositories/iflash-sale.repository';
import { FlashSale } from '../../database/entities/flash-sale.entity';


export interface TransactionResult {
  success: boolean;
  transactionId: string;
  message: string;
  stockDecreased?: boolean;
}

@Injectable()
export class TransactionService {
  private readonly logger = new Logger(TransactionService.name);
  private readonly TRANSACTION_TIMEOUT = 30000; // 30 seconds
  private readonly STOCK_LOCK_PREFIX = 'stock_lock:';
  private readonly TRANSACTION_PREFIX = 'transaction:';

  constructor(
    private readonly redisService: RedisService,
    private readonly kafkaService: KafkaService,
    @Inject('IFlashSaleRepository')
    private readonly flashSaleRepository: IFlashSaleRepository,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * High-throughput transaction processing:
   * 1. Use Redis repository for fast transaction processing
   * 2. Return immediate response to user
   * Note: Redis repository already publishes to Kafka for async database sync
   */
  async processPurchaseTransaction(
    username: string,
    flashSaleId: string,
    amount: number = 1,
  ): Promise<TransactionResult> {
    const transactionId = this.generateTransactionId();
    
    try {
      // Step 1: Use Redis repository for fast transaction processing
      const redisResult = await this.flashSaleRepository.processPurchase(username, amount);

      if (!redisResult.success) {
        return {
          success: false,
          transactionId,
          message: redisResult.message,
        };
      }

      // Step 2: Return immediate success response
      // Note: Redis repository already publishes to Kafka for async database sync
      return {
        success: true,
        transactionId,
        message: 'Purchase transaction processed successfully',
        stockDecreased: true,
      };

    } catch (error) {
      this.logger.error(`Transaction failed: ${error.message}`, error.stack);
      
      return {
        success: false,
        transactionId,
        message: 'Transaction processing failed',
      };
    }
  }

  /**
   * Redis-first transaction processing with atomic operations
   */
  private async processRedisTransaction(
    transactionId: string,
    username: string,
    flashSaleId: string,
    amount: number,
  ): Promise<{ success: boolean; message: string; redisTransactionId?: string; stockDecreased?: boolean }> {
    const lockKey = `${this.STOCK_LOCK_PREFIX}${flashSaleId}`;
    const transactionKey = `${this.TRANSACTION_PREFIX}${transactionId}`;

    try {
      // Acquire distributed lock for stock management
      const lockAcquired = await this.redisService.setWithOptions(
        lockKey,
        transactionId,
        ['PX', this.TRANSACTION_TIMEOUT.toString(), 'NX']
      );

      if (!lockAcquired) {
        return {
          success: false,
          message: 'Flash sale is currently busy, please try again',
        };
      }

      // Check if user already purchased in this flash sale
      const hasPurchased = await this.redisService.sismember(`flash_sale:user_purchases`, username);
      if (hasPurchased) {
        await this.releaseLock(lockKey);
        return {
          success: false,
          message: 'User has already made a purchase in this flash sale',
        };
      }

      // Get current stock from Redis, fallback to database if not in Redis
      let currentStock = await this.redisService.get(`flash_sale:stock`);
      let stock = currentStock ? parseInt(currentStock) : 0;
      
      // If stock not in Redis, get from database and initialize Redis
      if (stock === 0) {
        try {
          const flashSale = await this.dataSource.getRepository(FlashSale).findOne({
            where: { is_active: true }
          });
          
          if (flashSale) {
            stock = flashSale.current_stock;
            // Initialize Redis with current stock
            await this.redisService.set(`flash_sale:stock`, stock.toString());
          } else {
            await this.releaseLock(lockKey);
            return {
              success: false,
              message: 'Flash sale not found',
            };
          }
        } catch (error) {
          this.logger.error(`Failed to get stock from database: ${error.message}`, error.stack);
          await this.releaseLock(lockKey);
          return {
            success: false,
            message: 'Failed to retrieve stock information',
          };
        }
      }

      if (stock < amount) {
        await this.releaseLock(lockKey);
        return {
          success: false,
          message: 'Insufficient stock available',
        };
      }

      // Atomic stock decrease
      const newStock = stock - amount;
      await this.redisService.set(`flash_sale:stock`, newStock.toString());

      // Record purchase in Redis
      const purchaseData = {
        username,
        flashSaleId,
        amount,
        timestamp: new Date().toISOString(),
        transactionId,
      };

      await this.redisService.setWithOptions(
        transactionKey,
        JSON.stringify(purchaseData),
        ['PX', this.TRANSACTION_TIMEOUT.toString()]
      );

      // Add to user purchases set
      await this.redisService.sadd(`flash_sale:user_purchases`, username);

      // Clear status cache to force refresh
      await this.redisService.del(`flash_sale:status_cache`);

      // Release lock
      await this.releaseLock(lockKey);

      return {
        success: true,
        message: 'Redis transaction completed successfully',
        redisTransactionId: transactionId,
        stockDecreased: true,
      };

    } catch (error) {
      this.logger.error(`Redis transaction failed: ${error.message}`, error.stack);
      await this.releaseLock(lockKey);
      throw error;
    }
  }

  /**
   * Publish transaction to Kafka for async database processing
   */
  private async publishTransactionToKafka(
    transactionId: string,
    transactionData: any,
  ): Promise<void> {
    try {
      await this.kafkaService.publish('flash-sale-transactions', {
        key: transactionId,
        value: {
          ...transactionData,
          kafkaTimestamp: new Date().toISOString(),
        },
        topic: 'flash-sale-transactions',
      });

      this.logger.log(`Transaction ${transactionId} published to Kafka successfully`);
    } catch (error) {
      this.logger.error(`Failed to publish transaction to Kafka: ${error.message}`, error.stack);
      // Don't throw - Kafka failure shouldn't affect user response
    }
  }

  /**
   * Rollback Redis transaction on failure
   */
  private async rollbackRedisTransaction(transactionId: string): Promise<void> {
    try {
      const transactionKey = `${this.TRANSACTION_PREFIX}${transactionId}`;
      const transactionData = await this.redisService.get(transactionKey);

      if (transactionData) {
        const data = JSON.parse(transactionData);
        
        // Restore stock
        const stockKey = `stock:${data.flashSaleId}`;
        const currentStock = await this.redisService.get(stockKey);
        if (currentStock) {
          const restoredStock = parseInt(currentStock) + data.amount;
          await this.redisService.set(stockKey, restoredStock.toString());
        }

        // Remove from user purchases
        await this.redisService.srem(`user_purchases:${data.flashSaleId}`, data.username);

        // Delete transaction record
        await this.redisService.del(transactionKey);
      }
    } catch (error) {
      this.logger.error(`Rollback failed: ${error.message}`, error.stack);
    }
  }

  /**
   * Release distributed lock
   */
  private async releaseLock(lockKey: string): Promise<void> {
    try {
      await this.redisService.del(lockKey);
    } catch (error) {
      this.logger.error(`Failed to release lock: ${error.message}`, error.stack);
    }
  }

  /**
   * Generate unique transaction ID
   */
  private generateTransactionId(): string {
    return `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get transaction status from Redis
   */
  async getTransactionStatus(transactionId: string): Promise<any> {
    try {
      const transactionKey = `${this.TRANSACTION_PREFIX}${transactionId}`;
      const transactionData = await this.redisService.get(transactionKey);
      
      if (transactionData) {
        return JSON.parse(transactionData);
      }
      
      return null;
    } catch (error) {
      this.logger.error(`Failed to get transaction status: ${error.message}`, error.stack);
      return null;
    }
  }

  /**
   * Health check for transaction service
   */
  async healthCheck(): Promise<{ status: string; redis: boolean; kafka: boolean }> {
    try {
      const redisHealth = await this.redisService.ping() === 'PONG';
      const kafkaHealth = await this.kafkaService.healthCheck();

      return {
        status: redisHealth && kafkaHealth ? 'healthy' : 'unhealthy',
        redis: redisHealth,
        kafka: kafkaHealth,
      };
    } catch (error) {
      this.logger.error(`Health check failed: ${error.message}`, error.stack);
      return {
        status: 'unhealthy',
        redis: false,
        kafka: false,
      };
    }
  }
}
