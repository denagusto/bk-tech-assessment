export interface FlashSaleStatus {
  status: 'upcoming' | 'active' | 'ended' | 'sold-out';
  startTime: Date;
  endTime: Date;
  currentStock: number;
  maxStock: number;
  timeUntilStart?: number;
  timeUntilEnd?: number;
}

export interface PurchaseResult {
  success: boolean;
  message: string;
  purchaseId?: string;
  timestamp: Date;
  userId: string;
}

export interface UserPurchase {
  userId: string;
  purchaseId: string;
  timestamp: Date;
}

export interface FlashSaleConfig {
  startTime: Date;
  endTime: Date;
  maxStock: number;
}

export class FlashSale {
  constructor(
    private readonly config: FlashSaleConfig,
    private currentStock: number
  ) {}

  getStatus(currentTime: Date = new Date()): FlashSaleStatus {
    let status: FlashSaleStatus['status'];
    let timeUntilStart: number | undefined;
    let timeUntilEnd: number | undefined;

    if (currentTime < this.config.startTime) {
      status = 'upcoming';
      timeUntilStart = this.config.startTime.getTime() - currentTime.getTime();
    } else if (currentTime >= this.config.startTime && currentTime <= this.config.endTime) {
      status = this.currentStock > 0 ? 'active' : 'sold-out';
      timeUntilEnd = this.config.endTime.getTime() - currentTime.getTime();
    } else {
      status = 'ended';
    }

    return {
      status,
      startTime: this.config.startTime,
      endTime: this.config.endTime,
      currentStock: this.currentStock,
      maxStock: this.config.maxStock,
      timeUntilStart,
      timeUntilEnd
    };
  }

  canPurchase(currentTime: Date = new Date()): boolean {
    const status = this.getStatus(currentTime);
    return status.status === 'active';
  }

  getCurrentStock(): number {
    return this.currentStock;
  }

  updateStock(newStock: number): void {
    this.currentStock = Math.max(0, newStock);
  }
}
