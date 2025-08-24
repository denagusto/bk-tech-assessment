import { Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { FlashSale } from '../entities/flash-sale.entity';

@Injectable()
export class FlashSaleSeeder {
  private flashSaleRepository: Repository<FlashSale>;

  constructor(
    @Optional()
    @InjectRepository(FlashSale)
    flashSaleRepository?: Repository<FlashSale>,
    dataSource?: DataSource
  ) {
    if (flashSaleRepository) {
      this.flashSaleRepository = flashSaleRepository;
    } else if (dataSource) {
      this.flashSaleRepository = dataSource.getRepository(FlashSale);
    } else {
      throw new Error('FlashSaleSeeder requires either Repository<FlashSale> or DataSource');
    }
  }

  async seed(initialStock: number = 5): Promise<void> {
    // Check if flash sale already exists
    const existingFlashSale = await this.flashSaleRepository.findOne({
      where: { product_name: 'AirPods 3 Pro Release Edition' }
    });

    if (existingFlashSale) {
      // Update existing flash sale with new stock
      existingFlashSale.current_stock = initialStock;
      existingFlashSale.max_stock = initialStock;
      existingFlashSale.is_active = initialStock > 0;
      await this.flashSaleRepository.save(existingFlashSale);
      console.log(`Updated existing flash sale with ${initialStock} stock items`);
    } else {
      // Create new flash sale
      const flashSale = this.flashSaleRepository.create({
        product_name: 'AirPods 3 Pro Release Edition',
        description: 'Experience crystal-clear sound with our premium AirPods 3 Pro. Features include active noise cancellation, 30-hour battery life, and premium build quality. Perfect for music lovers and professionals.',
        details: {
          condition: 'New',
          warranty: '2 years',
          weight: '250g'
        },
        specification: {
          bluetooth: '5.2',
          battery_life: '30 hours',
          water_resistance: 'IPX4',
          driver_size: '10mm',
          frequency_response: '20Hz-20kHz'
        },
        important_info: {
          see_in_ui: `This is a limited edition product. Only ${initialStock} units available worldwide.`,
          highlights: ['Premium sound quality', 'Active noise cancellation', '30-hour battery life'],
          restrictions: ['Limit 1 per customer', 'While supplies last']
        },
        images: {
          main: '/images/airpods-1.jpeg',
          thumbnails: [
            '/images/airpods-1.jpeg',
            '/images/airpods-2.jpeg',
            '/images/airpods-3.jpeg',
            '/images/airpods-4.jpeg'
          ],
          gallery: [
            '/images/airpods-1.jpeg',
            '/images/airpods-2.jpeg',
            '/images/airpods-3.jpeg',
            '/images/airpods-4.jpeg'
          ]
        },
        current_stock: initialStock,
        max_stock: initialStock,
        start_time: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 hours ago
        end_time: new Date(Date.now() + 24 * 60 * 60 * 1000),   // 24 hours from now
        is_active: initialStock > 0,
        price: 499.00,
        currency_code: 'USD',
        currency_symbol: '$',
        discount: 200.00,
        price_after_discount: 299.00
      });

      await this.flashSaleRepository.save(flashSale);
      console.log(`Created new flash sale with ${initialStock} stock items`);
    }
  }

  async seedForStressTest(stockAmount: number = 100): Promise<void> {
    console.log(`Seeding flash sale for stress test with ${stockAmount} stock items`);
    await this.seed(stockAmount);
  }

  async seedForProductionTest(stockAmount: number = 1000): Promise<void> {
    console.log(`Seeding flash sale for production test with ${stockAmount} stock items`);
    await this.seed(stockAmount);
  }

  async reset(): Promise<void> {
    await this.flashSaleRepository.clear();
    console.log('Flash sale data cleared');
  }
}
