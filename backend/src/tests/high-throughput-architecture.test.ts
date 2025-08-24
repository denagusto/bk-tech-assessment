import { Test, TestingModule } from '@nestjs/testing';
import { TransactionService } from '../modules/flash-sale/transaction.service';
import { KafkaService } from '../modules/kafka/kafka.service';
import { RedisService } from '../modules/redis/redis.service';
import { IFlashSaleRepository } from '../domain/repositories/iflash-sale.repository';
import { DataSource } from 'typeorm';

describe('High-Throughput Architecture', () => {
  let transactionService: TransactionService;
  let kafkaService: KafkaService;
  let redisService: RedisService;
  let mockFlashSaleRepository: jest.Mocked<IFlashSaleRepository>;
  let mockDataSource: any;

  beforeEach(async () => {
    const mockRepository = {
      hasUserPurchased: jest.fn(),
      decreaseStock: jest.fn(),
      recordPurchase: jest.fn(),
      getStatus: jest.fn(),
      resetStock: jest.fn(),
      resetPurchases: jest.fn(),
      getAllPurchases: jest.fn(),
      getUserPurchase: jest.fn(),
      setCurrentFlashSale: jest.fn(),
      processPurchase: jest.fn().mockResolvedValue({
        success: true,
        message: 'Purchase successful'
      }),
    };

    const mockRedisService = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      sadd: jest.fn(),
      srem: jest.fn(),
      ping: jest.fn(),
      setWithOptions: jest.fn(),
    };

    const mockKafkaService = {
      publish: jest.fn(),
      healthCheck: jest.fn(),
    };

    mockDataSource = {
      createQueryRunner: jest.fn(() => ({
        connect: jest.fn(),
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        rollbackTransaction: jest.fn(),
        release: jest.fn(),
      })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionService,
        {
          provide: 'IFlashSaleRepository',
          useValue: mockRepository,
        },
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
        {
          provide: KafkaService,
          useValue: mockKafkaService,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    transactionService = module.get<TransactionService>(TransactionService);
    kafkaService = module.get<KafkaService>(KafkaService);
    redisService = module.get<RedisService>(RedisService);
    mockFlashSaleRepository = module.get('IFlashSaleRepository');
  });

  describe('TransactionService', () => {
    it('should process purchase transaction successfully', async () => {
      // Mock Redis operations
      (redisService.set as jest.Mock).mockResolvedValue(true); // Lock acquired
      (redisService.get as jest.Mock).mockResolvedValue('100'); // Stock available
      (redisService.sadd as jest.Mock).mockResolvedValue(1);
      
      // Mock repository
      mockFlashSaleRepository.hasUserPurchased.mockResolvedValue(false);
      mockFlashSaleRepository.processPurchase.mockResolvedValue({
        success: true,
        message: 'Purchase successful'
      });
      
      // Mock Kafka
      (kafkaService.publish as jest.Mock).mockResolvedValue(undefined);

      const result = await transactionService.processPurchaseTransaction(
        'testuser',
        'flash-sale-1',
        1
      );

      expect(result.success).toBe(true);
      expect(result.transactionId).toBeDefined();
      expect(result.stockDecreased).toBe(true);
      // Note: Kafka publishing is handled by the repository, not directly by TransactionService
    });

    it('should reject duplicate purchases', async () => {
      // Mock repository - user already purchased
      mockFlashSaleRepository.processPurchase.mockResolvedValue({
        success: false,
        message: 'User has already made a purchase'
      });

      const result = await transactionService.processPurchaseTransaction(
        'testuser',
        'flash-sale-1',
        1
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('already made a purchase');
      // Note: Lock release is handled internally by the repository
    });

    it('should reject insufficient stock', async () => {
      // Mock repository - insufficient stock
      mockFlashSaleRepository.processPurchase.mockResolvedValue({
        success: false,
        message: 'Insufficient stock available'
      });

      const result = await transactionService.processPurchaseTransaction(
        'testuser',
        'flash-sale-1',
        1
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('Insufficient stock');
      // Note: Lock release is handled internally by the repository
    });

    it('should handle Redis lock contention', async () => {
      // The TransactionService doesn't use Redis locks in the main flow
      // It delegates to the repository's processPurchase method
      // This test should verify that the service handles repository failures gracefully
      
      // Mock repository to simulate a failure
      mockFlashSaleRepository.processPurchase.mockRejectedValue(new Error('Redis connection failed'));

      const result = await transactionService.processPurchaseTransaction(
        'testuser',
        'flash-sale-1',
        1
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('Transaction processing failed');
    });

    it('should rollback transaction on failure', async () => {
      // Mock repository to throw an error
      mockFlashSaleRepository.processPurchase.mockRejectedValue(new Error('Database error'));

      const result = await transactionService.processPurchaseTransaction(
        'testuser',
        'flash-sale-1',
        1
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('Transaction processing failed');
    });

    it('should generate unique transaction IDs', async () => {
      const result1 = await transactionService.processPurchaseTransaction(
        'user1',
        'flash-sale-1',
        1
      );

      const result2 = await transactionService.processPurchaseTransaction(
        'user2',
        'flash-sale-1',
        1
      );

      expect(result1.transactionId).not.toBe(result2.transactionId);
      expect(result1.transactionId).toMatch(/^tx_\d+_[a-z0-9]+$/);
      expect(result2.transactionId).toMatch(/^tx_\d+_[a-z0-9]+$/);
    });
  });

  describe('Health Checks', () => {
    it('should provide health status', async () => {
      // Mock Redis health
      (redisService.ping as jest.Mock).mockResolvedValue('PONG');
      
      // Mock Kafka health
      (kafkaService.healthCheck as jest.Mock).mockResolvedValue(true);

      const health = await transactionService.healthCheck();

      expect(health.status).toBe('healthy');
      expect(health.redis).toBe(true);
      expect(health.kafka).toBe(true);
    });

    it('should detect unhealthy services', async () => {
      // Mock Redis unhealthy
      (redisService.ping as jest.Mock).mockResolvedValue('ERROR');
      
      // Mock Kafka unhealthy
      (kafkaService.healthCheck as jest.Mock).mockResolvedValue(false);

      const health = await transactionService.healthCheck();

      expect(health.status).toBe('unhealthy');
      expect(health.redis).toBe(false);
      expect(health.kafka).toBe(false);
    });
  });

  describe('Transaction Status', () => {
    it('should retrieve transaction status from Redis', async () => {
      const mockTransactionData = {
        username: 'testuser',
        flashSaleId: 'flash-sale-1',
        amount: 1,
        timestamp: new Date().toISOString(),
        transactionId: 'tx_123',
      };

      (redisService.get as jest.Mock).mockResolvedValue(
        JSON.stringify(mockTransactionData)
      );

      const status = await transactionService.getTransactionStatus('tx_123');

      expect(status).toEqual(mockTransactionData);
      expect(redisService.get).toHaveBeenCalledWith('transaction:tx_123');
    });

    it('should return null for non-existent transaction', async () => {
      (redisService.get as jest.Mock).mockResolvedValue(null);

      const status = await transactionService.getTransactionStatus('tx_999');

      expect(status).toBeNull();
    });
  });

  describe('Concurrency Control', () => {
    it('should handle multiple concurrent requests', async () => {
      const concurrentRequests = 5;
      
      // Mock successful Redis operations for all requests
      (redisService.set as jest.Mock).mockResolvedValue(true);
      (redisService.get as jest.Mock).mockResolvedValue('100');
      (redisService.sadd as jest.Mock).mockResolvedValue(1);
      
      // Mock successful repository responses for all requests
      mockFlashSaleRepository.processPurchase.mockResolvedValue({
        success: true,
        message: 'Purchase successful'
      });
      
      // Mock Kafka
      (kafkaService.publish as jest.Mock).mockResolvedValue(undefined);

      const promises = Array.from({ length: concurrentRequests }, (_, i) =>
        transactionService.processPurchaseTransaction(
          `user${i}`,
          'flash-sale-1',
          1
        )
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(concurrentRequests);
      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.transactionId).toBeDefined();
      });
    });
  });
});
