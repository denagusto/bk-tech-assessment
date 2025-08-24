import { Injectable, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { User } from './entities/user.entity';
import { Purchase } from './entities/purchase.entity';
import { FlashSale } from './entities/flash-sale.entity';
import { FlashSaleSeeder } from './seeders/flash-sale.seeder';
import { UserSeeder } from './seeders/user.seeder';

@Injectable()
export class DatabaseInitService implements OnModuleInit {
  constructor(private dataSource: DataSource) {}

  async onModuleInit() {
    try {
      console.log('Initializing database...');
      
      // Check if database is already initialized
      const userRepository = this.dataSource.getRepository(User);
      const existingUsers = await userRepository.count();
      
      if (existingUsers === 0) {
        console.log('Database is empty, running initial setup...');
        await this.initializeDatabase();
      } else {
        console.log(`Database already initialized with ${existingUsers} users`);
      }
    } catch (error) {
      console.error('Database initialization failed:', error);
      // Don't exit the application, just log the error
    }
  }

  private async initializeDatabase() {
    try {
      // Create tables (this should already be done by TypeORM)
      await this.dataSource.synchronize();
      console.log('Database tables created');

      // Seed flash sale using dedicated seeder
      const flashSaleSeeder = new FlashSaleSeeder(undefined, this.dataSource);
      await flashSaleSeeder.seed();

      // Seed users using dedicated seeder
      const userSeeder = new UserSeeder(this.dataSource);
      await userSeeder.seed();
      console.log('Database initialization completed');
    } catch (error) {
      console.error('Database initialization error:', error);
      throw error;
    }
  }
}
