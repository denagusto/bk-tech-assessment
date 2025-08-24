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
  async resetSystem() {
    try {
      await this.flashSaleService.resetSystem();
      return { message: 'System reset successfully' };
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
}
