import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from './modules/health/health.module';
import { FlashSaleModule } from './modules/flash-sale/flash-sale.module';
import { DatabaseModule } from './database/database.module';
import { typeOrmConfig } from './config/typeorm.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [() => require('./config')],
    }),
    TypeOrmModule.forRoot(typeOrmConfig),
    DatabaseModule,
    HealthModule,
    FlashSaleModule,
  ],
  providers: [],
})
export class AppModule {}
