import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FlashSaleController } from './flash-sale.controller';
import { FlashSaleService } from './flash-sale.service';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { TransactionService } from './transaction.service';
import { PostgresFlashSaleRepository } from './repositories/postgres-flash-sale.repository';
import { RedisFlashSaleRepository } from './repositories/redis-flash-sale.repository';
import { User } from '../../database/entities/user.entity';
import { Purchase } from '../../database/entities/purchase.entity';
import { FlashSale } from '../../database/entities/flash-sale.entity';
import { RedisModule } from '../redis/redis.module';
import { DatabaseModule } from '../../database/database.module';
import { KafkaModule } from '../kafka/kafka.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Purchase, FlashSale]),
    RedisModule,
    DatabaseModule,
    KafkaModule,
  ],
  controllers: [FlashSaleController, UserController],
  providers: [
    FlashSaleService,
    UserService,
    TransactionService,
    {
      provide: 'IFlashSaleRepository',
      useClass: RedisFlashSaleRepository, // Use Redis as primary, with database fallback
    },
    PostgresFlashSaleRepository,
    RedisFlashSaleRepository,
  ],
  exports: [FlashSaleService, UserService, TransactionService],
})
export class FlashSaleModule {}
