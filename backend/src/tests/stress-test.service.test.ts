import { Test, TestingModule } from '@nestjs/testing';
import { FlashSaleService } from '../modules/flash-sale/flash-sale.service';
import { AppModule } from '../app.module';
import { INestApplication } from '@nestjs/common';

describe('Flash Sale System - Stress Test Suite', () => {
  let app: INestApplication;
  let flashSaleService: FlashSaleService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    flashSaleService = moduleFixture.get<FlashSaleService>(FlashSaleService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Reset system before each test
    await flashSaleService.resetSystem();
  });

  describe('Basic Stress Tests', () => {
    it('should handle multiple sequential purchases correctly', async () => {
      const testUsers = ['user1', 'user2', 'user3', 'user4', 'user5'];
      
      console.log('Starting sequential purchase test with 5 users');
      
      // Make purchases one by one
      for (const username of testUsers) {
        const result = await flashSaleService.attemptPurchase(username);
        console.log(`${username}: ${result.success ? 'Success' : 'Failed'} - ${result.message}`);
      }
      
      // Verify final status
      const finalStatus = await flashSaleService.getStatus();
      expect(finalStatus.currentStock).toBe(0);
      expect(finalStatus.status).toBe('sold-out');
      
      console.log('Sequential purchase test completed');
      console.log(`Final stock: ${finalStatus.currentStock}`);
      console.log(`Final status: ${finalStatus.status}`);
    }, 30000);

    it('should handle duplicate purchase attempts correctly', async () => {
      const username = 'duplicate_test_user';
      
      // First purchase should succeed
      const firstResult = await flashSaleService.attemptPurchase(username);
      expect(firstResult.success).toBe(true);
      
      // Second purchase should fail
      const secondResult = await flashSaleService.attemptPurchase(username);
      expect(secondResult.success).toBe(false);
      expect(secondResult.message).toContain('already purchased');
      
      console.log('Duplicate purchase prevention working correctly');
    });

    it('should handle insufficient stock correctly', async () => {
      // Reset to 1 stock
      await flashSaleService.resetSystem();
      
      // First purchase should succeed
      const firstResult = await flashSaleService.attemptPurchase('user1');
      expect(firstResult.success).toBe(true);
      
      // Second purchase should fail
      const secondResult = await flashSaleService.attemptPurchase('user2');
      expect(secondResult.success).toBe(false);
      expect(secondResult.message).toContain('Insufficient stock');
      
      console.log('Insufficient stock handling working correctly');
    });
  });

  describe('Concurrency Tests', () => {
    it('should handle concurrent purchase attempts', async () => {
      const testUsers = [
        'concurrent_user_1', 'concurrent_user_2', 'concurrent_user_3',
        'concurrent_user_4', 'concurrent_user_5', 'concurrent_user_6',
        'concurrent_user_7', 'concurrent_user_8', 'concurrent_user_9',
        'concurrent_user_10'
      ];
      
      console.log('Starting concurrent purchase test with 10 users');
      
      // Create concurrent purchase promises
      const purchasePromises = testUsers.map(async (username) => {
        try {
          const result = await flashSaleService.attemptPurchase(username);
          return {
            username,
            success: result.success,
            message: result.message
          };
        } catch (error) {
          return {
            username,
            success: false,
            message: error.message
          };
        }
      });

      // Execute all purchases concurrently
      const results = await Promise.allSettled(purchasePromises);
      
      // Process results
      const successfulPurchases = results
        .filter(r => r.status === 'fulfilled' && r.value.success)
        .map(r => (r as any).value);
      
      const failedPurchases = results
        .filter(r => r.status === 'fulfilled' && !r.value.success)
        .map(r => (r as any).value);

      console.log(`Concurrent test results: ${successfulPurchases.length} successful, ${failedPurchases.length} failed`);
      
      // Should have exactly 5 successful and 5 failed
      expect(successfulPurchases.length).toBe(5);
      expect(failedPurchases.length).toBe(5);
      
      // Verify final stock is 0
      const finalStatus = await flashSaleService.getStatus();
      expect(finalStatus.currentStock).toBe(0);
      expect(finalStatus.status).toBe('sold-out');
      
      console.log('Concurrent purchase test completed successfully');
    }, 60000);
  });

  describe('System Integrity Tests', () => {
    it('should maintain data consistency under load', async () => {
      const testUsers = [];
      for (let i = 1; i <= 20; i++) {
        testUsers.push(`integrity_user_${i.toString().padStart(2, '0')}`);
      }
      
      console.log('Starting data integrity test with 20 users');
      
      // Execute purchases in batches
      const BATCH_SIZE = 5;
      const results = [];
      
      for (let i = 0; i < testUsers.length; i += BATCH_SIZE) {
        const batch = testUsers.slice(i, i + BATCH_SIZE);
        const batchPromises = batch.map(async (username) => {
          try {
            const result = await flashSaleService.attemptPurchase(username);
            return {
              username,
              success: result.success,
              message: result.message
            };
          } catch (error) {
            return {
              username,
              success: false,
              message: error.message
            };
          }
        });

        const batchResults = await Promise.allSettled(batchPromises);
        batchResults.forEach(result => {
          if (result.status === 'fulfilled') {
            results.push(result.value);
          }
        });
      }

      const successfulPurchases = results.filter(r => r.success);
      const failedPurchases = results.filter(r => !r.success);

      console.log(`Integrity test results: ${successfulPurchases.length} successful, ${failedPurchases.length} failed`);
      
      // Should have exactly 5 successful and 15 failed
      expect(successfulPurchases.length).toBe(5);
      expect(failedPurchases.length).toBe(15);
      
      // Verify no duplicate purchases
      const uniqueSuccessfulUsers = new Set(successfulPurchases.map(p => p.username));
      expect(uniqueSuccessfulUsers.size).toBe(5);
      
      // Verify final stock is 0
      const finalStatus = await flashSaleService.getStatus();
      expect(finalStatus.currentStock).toBe(0);
      expect(finalStatus.status).toBe('sold-out');
      
      console.log('Data integrity test completed successfully');
      console.log('No duplicate purchases detected');
      console.log('System maintained data consistency');
    }, 90000);
  });
});
