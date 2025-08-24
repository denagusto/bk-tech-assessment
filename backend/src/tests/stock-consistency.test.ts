import { Test, TestingModule } from '@nestjs/testing';
import { FlashSaleService } from '../modules/flash-sale/flash-sale.service';
import { UserService } from '../modules/flash-sale/user.service';
import { TransactionService } from '../modules/flash-sale/transaction.service';
import { DataSource } from 'typeorm';

describe('Stock Consistency Tests', () => {
  let service: FlashSaleService;
  let mockRepository: any;
  let mockUserService: any;
  let mockTransactionService: any;
  let mockDataSource: any;

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
    };

    mockUserService = {
      getUserByEmail: jest.fn(),
      getUserByUsername: jest.fn(),
      validateUserPurchase: jest.fn(),
    };

    mockTransactionService = {
      processPurchaseTransaction: jest.fn().mockResolvedValue({
        success: true,
        transactionId: 'test-transaction-id',
        message: 'Purchase successful',
        stockDecreased: true
      }),
    };

    mockDataSource = {
      createQueryRunner: jest.fn(() => ({
        connect: jest.fn(),
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        rollbackTransaction: jest.fn(),
        release: jest.fn(),
      })),
      getRepository: jest.fn(() => ({
        findOne: jest.fn().mockResolvedValue({
          id: 'flash-sale-1',
          is_active: true,
          current_stock: 50,
          max_stock: 100,
          start_time: new Date('2024-01-01T10:00:00Z'),
          end_time: new Date('2024-01-01T12:00:00Z'),
        }),
      })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FlashSaleService,
        {
          provide: 'IFlashSaleRepository',
          useValue: mockRepository,
        },
        {
          provide: UserService,
          useValue: mockUserService,
        },
        {
          provide: TransactionService,
          useValue: mockTransactionService,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<FlashSaleService>(FlashSaleService);
  });

  describe('Stock should not decrease on failed purchase', () => {
    it('should not decrease stock when user validation fails', async () => {
      // Mock successful status check
      mockRepository.getStatus.mockResolvedValue({
        status: 'active',
        startTime: new Date('2024-01-01T10:00:00Z'),
        endTime: new Date('2024-01-01T12:00:00Z'),
        currentStock: 50,
        maxStock: 100,
        timeUntilEnd: 3600000
      });

      // Mock user found
      mockUserService.getUserByUsername.mockResolvedValue({
        username: 'testuser',
        email: 'test@example.com',
        canPurchase: false,
        purchases: []
      });

      // Mock user validation fails
      mockUserService.validateUserPurchase.mockResolvedValue({
        canPurchase: false,
        message: 'User is blocked'
      });

      // Mock stock operations
      mockRepository.getCurrentStock.mockResolvedValue(50);
      mockRepository.decreaseStock.mockResolvedValue(true);

      const result = await service.attemptPurchase('testuser');

      // Verify purchase failed
      expect(result.success).toBe(false);
      expect(result.message).toBe('User is blocked');

      // Verify stock was NOT decreased
      expect(mockRepository.decreaseStock).not.toHaveBeenCalled();
      expect(mockRepository.updateStock).not.toHaveBeenCalled();
    });

    it('should not decrease stock when user already purchased', async () => {
      // Mock successful status check
      mockRepository.getStatus.mockResolvedValue({
        status: 'active',
        startTime: new Date('2024-01-01T10:00:00Z'),
        endTime: new Date('2024-01-01T12:00:00Z'),
        currentStock: 50,
        maxStock: 100,
        timeUntilEnd: 3600000
      });

      // Mock user found and can purchase
      mockUserService.getUserByUsername.mockResolvedValue({
        username: 'testuser',
        email: 'test@example.com',
        canPurchase: true,
        purchases: []
      });

      // Mock user validation succeeds
      mockUserService.validateUserPurchase.mockResolvedValue({
        canPurchase: true,
        message: 'User can purchase'
      });

      // Mock user already purchased
      mockRepository.hasUserPurchased.mockResolvedValue(true);

      // Mock TransactionService to return failure for duplicate purchase
      mockTransactionService.processPurchaseTransaction.mockResolvedValue({
        success: false,
        transactionId: 'test-transaction-id',
        message: 'You have already purchased an item',
        stockDecreased: false
      });

      const result = await service.attemptPurchase('testuser');

      // Verify purchase failed
      expect(result.success).toBe(false);
      expect(result.message).toBe('You have already purchased an item');

      // Verify stock was NOT decreased
      expect(mockRepository.decreaseStock).not.toHaveBeenCalled();
      expect(mockRepository.updateStock).not.toHaveBeenCalled();
    });

    it('should decrease stock only on successful purchase', async () => {
      // Mock successful status check
      mockRepository.getStatus.mockResolvedValue({
        status: 'active',
        startTime: new Date('2024-01-01T10:00:00Z'),
        endTime: new Date('2024-01-01T12:00:00Z'),
        currentStock: 50,
        maxStock: 100,
        timeUntilEnd: 3600000
      });

      // Mock user found and can purchase
      mockUserService.getUserByUsername.mockResolvedValue({
        username: 'testuser',
        email: 'test@example.com',
        canPurchase: true,
        purchases: []
      });

      // Mock user validation succeeds
      mockUserService.validateUserPurchase.mockResolvedValue({
        canPurchase: true,
        message: 'User can purchase'
      });

      // Mock user not purchased yet
      mockRepository.hasUserPurchased.mockResolvedValue(false);

      // Mock TransactionService to return success
      mockTransactionService.processPurchaseTransaction.mockResolvedValue({
        success: true,
        transactionId: 'test-transaction-id',
        message: 'Purchase successful!',
        stockDecreased: true
      });

      const result = await service.attemptPurchase('testuser');

      // Verify purchase succeeded
      expect(result.success).toBe(true);
      expect(result.message).toBe('Purchase successful!');

      // Verify the result has the expected structure
      expect(result.purchaseId).toBeDefined();
      expect(result.userId).toBe('testuser');
    });
  });
});
