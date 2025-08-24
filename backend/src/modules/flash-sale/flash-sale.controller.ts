import { Controller, Get, Post, Body, Param, HttpException, HttpStatus } from '@nestjs/common';
import { FlashSaleService } from './flash-sale.service';
import { CreatePurchaseDto } from './dto/create-purchase.dto';

@Controller('api/flash-sale')
export class FlashSaleController {
  constructor(private readonly flashSaleService: FlashSaleService) {}

  @Get('status')
  async getStatus() {
    try {
      return await this.flashSaleService.getStatus();
    } catch (error) {
      throw new HttpException('Failed to get flash sale status', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('product')
  async getProduct() {
    try {
      return await this.flashSaleService.getProduct();
    } catch (error) {
      throw new HttpException('Failed to get product details', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('purchase')
  async attemptPurchase(@Body() createPurchaseDto: CreatePurchaseDto) {
    try {
      return await this.flashSaleService.attemptPurchase(createPurchaseDto.userIdentifier);
    } catch (error) {
      throw new HttpException('Purchase failed', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('purchase/:userIdentifier')
  async checkUserPurchase(@Param('userIdentifier') userIdentifier: string) {
    try {
      return await this.flashSaleService.checkUserPurchase(userIdentifier);
    } catch (error) {
      throw new HttpException('Failed to check user purchase', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('reset')
  async resetSystem(@Body() body: { resetToSmallStock?: boolean } = {}) {
    try {
      const { resetToSmallStock = true } = body;
      await this.flashSaleService.resetSystem(resetToSmallStock);
      return { 
        message: `System reset successfully${resetToSmallStock ? ' to small stock (5 items)' : ' maintaining current stock level'}`,
        resetToSmallStock
      };
    } catch (error) {
      throw new HttpException('Failed to reset system', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('debug/transaction')
  async debugTransaction() {
    try {
      // Test if TransactionService is accessible
      const transactionService = this.flashSaleService['transactionService'];
      if (!transactionService) {
        return { error: 'TransactionService not injected' };
      }
      
      // Test basic functionality
      return { 
        message: 'TransactionService is accessible',
        hasTransactionService: !!transactionService,
        methods: Object.getOwnPropertyNames(Object.getPrototypeOf(transactionService))
      };
    } catch (error) {
      return { error: error.message, stack: error.stack };
    }
  }

  @Post('debug/test-transaction')
  async testTransaction() {
    try {
      const transactionService = this.flashSaleService['transactionService'];
      
      // Test the transaction service with a simple purchase
      const result = await transactionService.processPurchaseTransaction(
        'jane_smith',
        '8e10560a-0cc5-4a77-8b92-c682c35d1deb',
        1
      );
      
      return { 
        message: 'Transaction test completed',
        result: result
      };
    } catch (error) {
      return { 
        error: error.message, 
        stack: error.stack,
        name: error.name
      };
    }
  }

  @Post('stress-test/setup')
  async setupStressTest(@Body() body: { stockAmount: number }) {
    try {
      const { stockAmount = 100 } = body;
      
      // Reset system first
      await this.flashSaleService.resetSystem();
      
      // For now, we'll use the default stock from reset
      // In a real implementation, you'd want to update the stock amount
      // This requires additional database operations
      
      return {
        success: true,
        message: `Stress test setup completed with default stock`,
        note: 'Stock amount will be set to default (5) after reset',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to setup stress test: ${error.message}`,
        timestamp: new Date().toISOString()
      };
    }
  }

  @Post('stress-test/bulk-purchase')
  async bulkPurchaseTest(@Body() body: { usernames: string[] }) {
    try {
      const { usernames = [] } = body;
      
      if (!usernames || usernames.length === 0) {
        return {
          success: false,
          message: 'No usernames provided for bulk purchase test',
          timestamp: new Date().toISOString()
        };
      }

      console.log(`Starting bulk purchase test with ${usernames.length} users`);
      const startTime = Date.now();
      
      // Execute purchases sequentially to avoid overwhelming the system
      const results = [];
      
      for (const username of usernames) {
        try {
          const result = await this.flashSaleService.attemptPurchase(username);
          results.push({
            username,
            success: result.success,
            message: result.message,
            timestamp: new Date().toISOString()
          });
        } catch (error) {
          results.push({
            username,
            success: false,
            message: error.message,
            timestamp: new Date().toISOString()
          });
        }
      }

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      // Process results
      const successfulPurchases = results.filter(r => r.success);
      const failedPurchases = results.filter(r => !r.success);

      return {
        success: true,
        message: 'Bulk purchase test completed',
        testResults: {
          executionTime,
          totalUsers: usernames.length,
          successfulPurchases: successfulPurchases.length,
          failedPurchases: failedPurchases.length,
          successRate: ((successfulPurchases.length / usernames.length) * 100).toFixed(2),
          throughput: (usernames.length / (executionTime / 1000)).toFixed(2)
        },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        message: `Bulk purchase test failed: ${error.message}`,
        timestamp: new Date().toISOString()
      };
    }
  }

  @Get('stress-test/status')
  async getStressTestStatus() {
    try {
      const status = await this.flashSaleService.getStatus();
      
      return {
        success: true,
        status,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to get stress test status: ${error.message}`,
        timestamp: new Date().toISOString()
      };
    }
  }

  @Post('update-stock')
  async updateStock(@Body() body: { stockAmount: number }) {
    try {
      const { stockAmount } = body;
      
      if (stockAmount < 0) {
        return {
          success: false,
          message: 'Stock amount must be non-negative',
          timestamp: new Date().toISOString()
        };
      }

      await this.flashSaleService.updateStock(stockAmount);
      
      return {
        success: true,
        message: `Stock updated successfully to ${stockAmount} items`,
        stockAmount,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to update stock: ${error.message}`,
        timestamp: new Date().toISOString()
      };
    }
  }

  @Post('stock-preset/:preset')
  async setStockPreset(@Param('preset') preset: string) {
    try {
      let stockAmount: number;
      let userCount: number;
      
      switch (preset) {
        case 'small':
          stockAmount = 5;
          userCount = 15; // Extra users for testing
          break;
        case 'medium':
          stockAmount = 100;
          userCount = 150; // 1.5x stock for concurrent testing
          break;
        case 'large':
          stockAmount = 1000;
          userCount = 1500; // 1.5x stock for stress testing
          break;
        case 'extreme':
          stockAmount = 10000;
          userCount = 10000; // Match stock for full stress test
          break;
        default:
          return {
            success: false,
            message: `Invalid preset: ${preset}. Available presets: small, medium, large, extreme`,
            timestamp: new Date().toISOString()
          };
      }

      await this.flashSaleService.updateStock(stockAmount);
      
      return {
        success: true,
        message: `Stock preset '${preset}' applied successfully with ${userCount} users`,
        preset,
        stockAmount,
        userCount,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to apply stock preset: ${error.message}`,
        timestamp: new Date().toISOString()
      };
    }
  }
}
