import { FlashSaleStatus, PurchaseResult } from '../entities/flash-sale.entity';

export interface IFlashSaleService {
  getStatus(): Promise<FlashSaleStatus>;
  attemptPurchase(userId: string): Promise<PurchaseResult>;
  checkUserPurchase(userId: string): Promise<{ hasPurchased: boolean; purchaseId?: string }>;
  resetSystem(): Promise<void>;
}
