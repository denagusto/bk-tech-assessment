import { FlashSaleStatus, PurchaseResult, UserPurchase } from '../entities/flash-sale.entity';

export interface IFlashSaleRepository {
  getStatus(): Promise<FlashSaleStatus>;
  getCurrentStock(): Promise<number>;
  updateStock(newStock: number): Promise<void>;
  decreaseStock(amount?: number): Promise<boolean>;
  hasUserPurchased(userId: string): Promise<boolean>;
  recordPurchase(userId: string, purchaseId: string): Promise<void>;
  getUserPurchase(userId: string): Promise<UserPurchase | null>;
  getAllPurchases(): Promise<UserPurchase[]>;
  resetStock(): Promise<void>;
  resetPurchases(): Promise<void>;
  setCurrentFlashSale(flashSaleId: string): Promise<void>;
  processPurchase(username: string, amount?: number): Promise<{ success: boolean; transactionId?: string; message?: string }>;
}

export interface IPurchaseRepository {
  createPurchase(userId: string, purchaseId: string): Promise<UserPurchase>;
  findPurchaseByUserId(userId: string): Promise<UserPurchase | null>;
  findPurchaseById(purchaseId: string): Promise<UserPurchase | null>;
  getAllPurchases(): Promise<UserPurchase[]>;
  deletePurchase(purchaseId: string): Promise<void>;
}
