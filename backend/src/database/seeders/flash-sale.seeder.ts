import { DataSource } from 'typeorm';
import { FlashSale } from '../entities/flash-sale.entity';

export class FlashSaleSeeder {
  constructor(private dataSource: DataSource) {}

  async seed(): Promise<void> {
    const flashSaleRepository = this.dataSource.getRepository(FlashSale);
    const existingFlashSale = await flashSaleRepository.count();
    
    if (existingFlashSale === 0) {
      const flashSale = flashSaleRepository.create({
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
          see_in_ui: 'This is a limited edition product. Only 100 units available worldwide.',
          compatibility: 'Compatible with all devices supporting Bluetooth 5.0+',
          shipping: 'Free worldwide shipping included',
          security: 'Secure payment processing guaranteed'
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
        current_stock: 5,
        max_stock: 5,
        start_time: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 hours ago
        end_time: new Date(Date.now() + 24 * 60 * 60 * 1000),   // 24 hours from now
        is_active: true,
        price: 499.00,
        currency_code: 'USD',
        currency_symbol: '$',
        discount: 200.00,
        price_after_discount: 299.00
      });
      
      await flashSaleRepository.save(flashSale);
      console.log('Created flash sale: AirPods 3 Pro');
    } else {
      console.log(`Flash sale already exists (${existingFlashSale} found)`);
    }
  }
}
