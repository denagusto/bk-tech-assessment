import { IFlashSaleService } from '../../domain/services/iflash-sale.service';
import { IFlashSaleRepository } from '../../domain/repositories/iflash-sale.repository';
import { FlashSaleStatus, PurchaseResult } from '../../domain/entities/flash-sale.entity';
import { PurchaseId } from '../../domain/value-objects/purchase-id.vo';
import { UserId } from '../../domain/value-objects/user-id.vo';
import { logger } from '../../utils/logger';

export class FlashSaleService implements IFlashSaleService {
  constructor(
    private readonly flashSaleRepository: IFlashSaleRepository
  ) {}

  async getStatus(): Promise<FlashSaleStatus> {
    try {
      return await this.flashSaleRepository.getStatus();
    } catch (error) {
      logger.error('Failed to get flash sale status:', error);
      throw new Error('Failed to retrieve flash sale status');
    }
  }

  async attemptPurchase(userId: string): Promise<PurchaseResult> {
    try {
      const validatedUserId = UserId.create(userId);
      const status = await this.flashSaleRepository.getStatus();
      
      if (status.status === 'upcoming') {
        return {
          success: false,
          message: 'Flash sale has not started yet',
          timestamp: new Date(),
          userId: validatedUserId.getValue()
        };
      }

      if (status.status === 'ended') {
        return {
          success: false,
          message: 'Flash sale has ended',
          timestamp: new Date(),
          userId: validatedUserId.getValue()
        };
      }

      if (status.status === 'sold-out') {
        return {
          success: false,
          message: 'Flash sale is sold out',
          timestamp: new Date(),
          userId: validatedUserId.getValue()
        };
      }

      const hasPurchased = await this.flashSaleRepository.hasUserPurchased(validatedUserId.getValue());
      if (hasPurchased) {
        return {
          success: false,
          message: 'You have already purchased an item',
          timestamp: new Date(),
          userId: validatedUserId.getValue()
        };
      }

      const purchaseResult = await this.processPurchase(validatedUserId.getValue());
      return purchaseResult;

    } catch (error) {
      logger.error('Purchase attempt failed:', error);
      return {
        success: false,
        message: 'An error occurred during purchase',
        timestamp: new Date(),
        userId
      };
    }
  }

  async checkUserPurchase(userId: string): Promise<{ hasPurchased: boolean; purchaseId?: string }> {
    try {
      const validatedUserId = UserId.create(userId);
      const hasPurchased = await this.flashSaleRepository.hasUserPurchased(validatedUserId.getValue());
      
      if (hasPurchased) {
        const purchase = await this.flashSaleRepository.getUserPurchase(validatedUserId.getValue());
        return { 
          hasPurchased: true, 
          purchaseId: purchase?.purchaseId 
        };
      }
      
      return { hasPurchased: false };
    } catch (error) {
      logger.error('Failed to check user purchase:', error);
      return { hasPurchased: false };
    }
  }

  async resetSystem(): Promise<void> {
    try {
      await this.flashSaleRepository.resetStock();
      await this.flashSaleRepository.resetPurchases();
      logger.info('Flash sale system reset successfully');
    } catch (error) {
      logger.error('Failed to reset flash sale system:', error);
      throw new Error('Failed to reset system');
    }
  }

  private async processPurchase(userId: string): Promise<PurchaseResult> {
    const purchaseId = PurchaseId.generate();
    const timestamp = new Date();

    try {
      // Final validation before processing purchase
      const status = await this.flashSaleRepository.getStatus();
      
      if (status.status !== 'active') {
        return {
          success: false,
          message: `Flash sale is ${status.status}`,
          timestamp,
          userId
        };
      }

      // Double-check user hasn't purchased already
      const hasPurchased = await this.flashSaleRepository.hasUserPurchased(userId);
      if (hasPurchased) {
        return {
          success: false,
          message: 'You have already purchased an item',
          timestamp,
          userId
        };
      }

      // Use atomic stock decrease operation
      const stockDecreased = await this.flashSaleRepository.decreaseStock(1);
      if (!stockDecreased) {
        return {
          success: false,
          message: 'Item is sold out',
          timestamp,
          userId
        };
      }

      // Record purchase
      await this.flashSaleRepository.recordPurchase(userId, purchaseId.toString());

      logger.info(`Purchase successful for user ${userId}, purchase ID: ${purchaseId.toString()}`);
      
      return {
        success: true,
        message: 'Purchase successful!',
        purchaseId: purchaseId.toString(),
        timestamp,
        userId
      };

    } catch (error) {
      logger.error('Purchase processing failed:', error);
      throw new Error('Failed to process purchase');
    }
  }
}
