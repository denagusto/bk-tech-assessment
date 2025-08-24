import { FlashSaleService } from '../application/services/flash-sale.service';
import { IFlashSaleRepository } from '../domain/repositories/iflash-sale.repository';
import { FlashSaleStatus, PurchaseResult } from '../domain/entities/flash-sale.entity';

describe('FlashSaleService', () => {
  let service: FlashSaleService;
  let mockRepository: jest.Mocked<IFlashSaleRepository>;

  beforeEach(async () => {
    mockRepository = {
      getStatus: jest.fn(),
      getCurrentStock: jest.fn(),
      updateStock: jest.fn(),
      decreaseStock: jest.fn(),
      hasUserPurchased: jest.fn(),
      recordPurchase: jest.fn(),
      getUserPurchase: jest.fn(),
      getAllPurchases: jest.fn(),
      resetStock: jest.fn(),
      resetPurchases: jest.fn(),
      setCurrentFlashSale: jest.fn(),
      processPurchase: jest.fn(),
    } as jest.Mocked<IFlashSaleRepository>;
    service = new FlashSaleService(mockRepository);
  });

  describe('getStatus', () => {
    it('should return status from repository', async () => {
      const mockStatus: FlashSaleStatus = {
        status: 'active',
        startTime: new Date('2024-01-01T10:00:00Z'),
        endTime: new Date('2024-01-01T12:00:00Z'),
        currentStock: 50,
        maxStock: 100,
        timeUntilEnd: 3600000
      };

      mockRepository.getStatus.mockResolvedValue(mockStatus);

      const result = await service.getStatus();
      
      expect(result).toEqual(mockStatus);
      expect(mockRepository.getStatus).toHaveBeenCalledTimes(1);
    });

    it('should handle repository errors gracefully', async () => {
      mockRepository.getStatus.mockRejectedValue(new Error('Database error'));

      await expect(service.getStatus()).rejects.toThrow('Failed to retrieve flash sale status');
    });
  });

  describe('attemptPurchase', () => {
    beforeEach(() => {
      const mockDate = new Date('2024-01-01T11:00:00Z');
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any);
    });

    it('should reject purchase when flash sale is upcoming', async () => {
      const mockStatus: FlashSaleStatus = {
        status: 'upcoming',
        startTime: new Date('2024-01-01T12:00:00Z'),
        endTime: new Date('2024-01-01T14:00:00Z'),
        currentStock: 100,
        maxStock: 100,
        timeUntilStart: 3600000
      };

      mockRepository.getStatus.mockResolvedValue(mockStatus);

      const result = await service.attemptPurchase('user1');
      
      expect(result.success).toBe(false);
      expect(result.message).toBe('Flash sale has not started yet');
      expect(result.userId).toBe('user1');
    });

    it('should reject purchase when flash sale has ended', async () => {
      const mockStatus: FlashSaleStatus = {
        status: 'ended',
        startTime: new Date('2024-01-01T08:00:00Z'),
        endTime: new Date('2024-01-01T10:00:00Z'),
        currentStock: 25,
        maxStock: 100
      };

      mockRepository.getStatus.mockResolvedValue(mockStatus);

      const result = await service.attemptPurchase('user1');
      
      expect(result.success).toBe(false);
      expect(result.message).toBe('Flash sale has ended');
    });

    it('should reject purchase when user has already purchased', async () => {
      const mockStatus: FlashSaleStatus = {
        status: 'active',
        startTime: new Date('2024-01-01T10:00:00Z'),
        endTime: new Date('2024-01-01T12:00:00Z'),
        currentStock: 50,
        maxStock: 100,
        timeUntilEnd: 3600000
      };

      mockRepository.getStatus.mockResolvedValue(mockStatus);
      mockRepository.hasUserPurchased.mockResolvedValue(true);

      const result = await service.attemptPurchase('user1');
      
      expect(result.success).toBe(false);
      expect(result.message).toBe('You have already purchased an item');
    });

    it('should process successful purchase', async () => {
      const mockStatus: FlashSaleStatus = {
        status: 'active',
        startTime: new Date('2024-01-01T10:00:00Z'),
        endTime: new Date('2024-01-01T12:00:00Z'),
        currentStock: 50,
        maxStock: 100,
        timeUntilEnd: 3600000
      };

      mockRepository.getStatus.mockResolvedValue(mockStatus);
      mockRepository.hasUserPurchased.mockResolvedValue(false);
      mockRepository.decreaseStock.mockResolvedValue(true);
      mockRepository.recordPurchase.mockResolvedValue(undefined);

      const result = await service.attemptPurchase('user1');
      
      expect(result.success).toBe(true);
      expect(result.message).toBe('Purchase successful!');
      expect(result.purchaseId).toBeDefined();
      expect(result.userId).toBe('user1');
      expect(mockRepository.decreaseStock).toHaveBeenCalledWith(1);
      expect(mockRepository.recordPurchase).toHaveBeenCalled();
    });

    it('should reject purchase when stock is 0', async () => {
      const mockStatus: FlashSaleStatus = {
        status: 'active',
        startTime: new Date('2024-01-01T10:00:00Z'),
        endTime: new Date('2024-01-01T12:00:00Z'),
        currentStock: 0,
        maxStock: 100,
        timeUntilEnd: 3600000
      };

      mockRepository.getStatus.mockResolvedValue(mockStatus);
      mockRepository.hasUserPurchased.mockResolvedValue(false);
      mockRepository.getCurrentStock.mockResolvedValue(0);

      const result = await service.attemptPurchase('user1');
      
      expect(result.success).toBe(false);
      expect(result.message).toBe('Item is sold out');
    });
  });

  describe('checkUserPurchase', () => {
    it('should return true when user has purchased', async () => {
      mockRepository.hasUserPurchased.mockResolvedValue(true);
      mockRepository.getUserPurchase.mockResolvedValue({
        userId: 'user1',
        purchaseId: 'purchase123',
        timestamp: new Date()
      });

      const result = await service.checkUserPurchase('user1');
      
      expect(result.hasPurchased).toBe(true);
      expect(result.purchaseId).toBe('purchase123');
    });

    it('should return false when user has not purchased', async () => {
      mockRepository.hasUserPurchased.mockResolvedValue(false);

      const result = await service.checkUserPurchase('user1');
      
      expect(result.hasPurchased).toBe(false);
      expect(result.purchaseId).toBeUndefined();
    });
  });

  describe('resetSystem', () => {
    it('should reset stock and purchases', async () => {
      mockRepository.resetStock.mockResolvedValue(undefined);
      mockRepository.resetPurchases.mockResolvedValue(undefined);

      await service.resetSystem();
      
      expect(mockRepository.resetStock).toHaveBeenCalled();
      expect(mockRepository.resetPurchases).toHaveBeenCalled();
    });

    it('should handle reset errors', async () => {
      mockRepository.resetStock.mockRejectedValue(new Error('Reset failed'));

      await expect(service.resetSystem()).rejects.toThrow('Failed to reset system');
    });
  });
});
