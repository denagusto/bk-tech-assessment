import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { config } from './index';
import { User } from '../database/entities/user.entity';
import { Purchase } from '../database/entities/purchase.entity';
import { FlashSale } from '../database/entities/flash-sale.entity';

export const typeOrmConfig: TypeOrmModuleOptions = {
  type: 'postgres',
  host: config().database.host,
  port: config().database.port,
  username: config().database.username,
  password: config().database.password,
  database: config().database.name,
  entities: [User, Purchase, FlashSale],
  synchronize: true, // Auto-sync schema for development
  logging: config().nodeEnv === 'development',
  ssl: config().nodeEnv === 'production' ? { rejectUnauthorized: false } : false,
};
