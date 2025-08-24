import { Injectable, Inject } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { IFlashSaleRepository } from '../../domain/repositories/iflash-sale.repository';
import { FlashSaleStatus, PurchaseResult } from '../../domain/entities/flash-sale.entity';
import { PurchaseId } from '../../domain/value-objects/purchase-id.vo';
import { UserId } from '../../domain/value-objects/user-id.vo';
import { UserService } from './user.service';
import { TransactionService } from './transaction.service';
import { FlashSale } from '../../database/entities/flash-sale.entity';

@Injectable()
export class FlashSaleService {
  constructor(
    @Inject('IFlashSaleRepository')
    private readonly flashSaleRepository: IFlashSaleRepository,
    private readonly userService: UserService,
    private readonly transactionService: TransactionService,
    private readonly dataSource: DataSource,
  ) {}

  async getStatus(): Promise<FlashSaleStatus> {
    try {
      const status = await this.flashSaleRepository.getStatus();
      console.log('Flash sale status retrieved:', {
        status: status.status,
        currentStock: status.currentStock,
        maxStock: status.maxStock,
      });
      return status;
    } catch (error) {
      console.error('Failed to retrieve flash sale status:', error);
      throw new Error('Failed to retrieve flash sale status');
    }
  }

  async getProduct() {
    try {
      // Get the first active flash sale
      const flashSale = await this.dataSource.getRepository(FlashSale).findOne({
        where: { is_active: true },
        order: { created_at: 'DESC' }
      });

      if (!flashSale) {
        throw new Error('No active flash sale found');
      }

      return {
        id: flashSale.id,
        product_name: flashSale.product_name,
        description: flashSale.description,
        details: flashSale.details,
        specification: flashSale.specification,
        important_info: flashSale.important_info,
        images: flashSale.images,
        price: flashSale.price,
        currency_code: flashSale.currency_code,
        currency_symbol: flashSale.currency_symbol,
        discount: flashSale.discount,
        price_after_discount: flashSale.price_after_discount,
        current_stock: flashSale.current_stock,
        max_stock: flashSale.max_stock,
        start_time: flashSale.start_time,
        end_time: flashSale.end_time
      };
    } catch (error) {
      console.error('Failed to get product details:', error);
      throw new Error('Failed to get product details');
    }
  }

  async attemptPurchase(userIdentifier: string): Promise<PurchaseResult> {
    const startTime = Date.now();
    
    try {
      // Determine if userIdentifier is username or email
      let user;
      if (userIdentifier.includes('@')) {
        user = await this.userService.getUserByEmail(userIdentifier);
      } else {
        user = await this.userService.getUserByUsername(userIdentifier);
      }

      if (!user) {
        return {
          success: false,
          message: 'User not found',
          timestamp: new Date(),
          userId: userIdentifier
        };
      }

      // Validate user can purchase
      const userValidation = await this.userService.validateUserPurchase(user.username);
      if (!userValidation.canPurchase) {
        return {
          success: false,
          message: userValidation.message,
          timestamp: new Date(),
          userId: user.username
        };
      }

      const status = await this.flashSaleRepository.getStatus();
      
      if (status.status === 'upcoming') {
        console.warn('Purchase attempt rejected - sale not started', {
          userId: user.username,
          status: status.status,
        });
        
        return {
          success: false,
          message: 'Flash sale has not started yet',
          timestamp: new Date(),
          userId: user.username
        };
      }

      if (status.status === 'ended') {
        console.warn('Purchase attempt rejected - sale ended', {
          userId: user.username,
          status: status.status,
        });
        
        return {
          success: false,
          message: 'Flash sale has ended',
          timestamp: new Date(),
          userId: user.username
        };
      }

      if (status.status === 'sold-out') {
        console.warn('Purchase attempt rejected - sold out', {
          userId: user.username,
          status: status.status,
          currentStock: status.currentStock,
        });
        
        return {
          success: false,
          message: 'Flash sale is sold out',
          timestamp: new Date(),
          userId: user.username
        };
      }

      // Process the purchase
      return await this.processPurchase(user.username);
    } catch (error) {
      console.error('Purchase attempt failed:', error);
      throw new Error('Purchase attempt failed');
    }
  }

  async checkUserPurchase(userIdentifier: string): Promise<{ hasPurchased: boolean; purchaseId?: string }> {
    try {
      // Determine if userIdentifier is username or email
      let user;
      if (userIdentifier.includes('@')) {
        user = await this.userService.getUserByEmail(userIdentifier);
      } else {
        user = await this.userService.getUserByUsername(userIdentifier);
      }

      if (!user) {
        return { hasPurchased: false };
      }
      
      const hasPurchased = user.purchases.length > 0;
      
      console.log('User purchase status checked:', {
        userId: user.username,
        hasPurchased,
      });
      
      if (hasPurchased) {
        const purchase = user.purchases[0];
        return { 
          hasPurchased: true, 
          purchaseId: purchase?.purchaseId 
        };
      }
      
      return { hasPurchased: false };
    } catch (error) {
      console.error('Failed to check user purchase status:', error);
      return { hasPurchased: false };
    }
  }

  async resetSystem(resetToSmallStock: boolean = true): Promise<void> {
    try {
      if (resetToSmallStock) {
        // Reset to small stock (5 items)
        await this.flashSaleRepository.resetStock();
        console.log('System reset to small stock (5 items)');
      } else {
        // Maintain current stock level but clear purchases
        const currentStatus = await this.flashSaleRepository.getStatus();
        console.log(`System reset maintaining current stock level: ${currentStatus.currentStock} items`);
      }
      
      await this.flashSaleRepository.resetPurchases();
      await this.userService.resetUsers();
      
      console.log('System reset completed');
      
    } catch (error) {
      console.error('Failed to reset system:', error);
      throw new Error('Failed to reset system');
    }
  }

  async updateStock(stockAmount: number): Promise<void> {
    try {
      console.log(`Updating flash sale stock to ${stockAmount} items...`);
      
      // Update stock in Redis repository
      await this.flashSaleRepository.updateStock(stockAmount);
      
      // Update stock in database
      const flashSale = await this.dataSource.getRepository(FlashSale).findOne({
        where: { is_active: true },
        order: { created_at: 'DESC' }
      });

      if (flashSale) {
        flashSale.current_stock = stockAmount;
        flashSale.max_stock = stockAmount;
        flashSale.is_active = stockAmount > 0;
        await this.dataSource.getRepository(FlashSale).save(flashSale);
        console.log(`Database stock updated to ${stockAmount} items`);
      } else {
        throw new Error('No active flash sale found');
      }

      // Clear existing purchases when updating stock
      await this.flashSaleRepository.resetPurchases();
      console.log('Existing purchases cleared');
      
      console.log('Stock update completed successfully');
    } catch (error) {
      console.error('Failed to update flash sale stock:', error);
      throw new Error('Failed to update flash sale stock');
    }
  }

  /**
   * High-throughput purchase processing using Redis-first transactions
   * with Kafka pub/sub for async database updates
   */
  private async processPurchase(username: string): Promise<PurchaseResult> {
    const startTime = Date.now();
    const timestamp = new Date();

    try {
      console.log('Starting processPurchase for user:', username);
      
      // Get active flash sale ID
      const activeFlashSale = await this.dataSource.getRepository(FlashSale).findOne({
        where: { is_active: true },
        order: { created_at: 'DESC' }
      });

      console.log('Active flash sale found:', activeFlashSale ? activeFlashSale.id : 'none');

      if (!activeFlashSale) {
        return {
          success: false,
          message: 'No active flash sale found',
          timestamp,
          userId: username
        };
      }

      console.log('Calling TransactionService with flash sale ID:', activeFlashSale.id);

      // Use high-throughput transaction service
      const transactionResult = await this.transactionService.processPurchaseTransaction(
        username,
        activeFlashSale.id,
        1 // amount
      );

      console.log('Transaction result:', transactionResult);

      if (!transactionResult.success) {
        return {
          success: false,
          message: transactionResult.message,
          timestamp,
          userId: username
        };
      }

      // Log successful transaction
      const duration = Date.now() - startTime;
      console.log('High-throughput purchase processed successfully:', {
        userId: username,
        transactionId: transactionResult.transactionId,
        duration,
        stockDecreased: transactionResult.stockDecreased,
      });

      return {
        success: true,
        message: 'Purchase successful!',
        purchaseId: transactionResult.transactionId, // Use transaction ID as purchase ID
        timestamp,
        userId: username
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      console.error('High-throughput purchase processing failed:', {
        userId: username,
        duration,
        operation: 'processPurchase',
      }, error);
      
      throw new Error('Failed to process purchase');
    }
  }
}
