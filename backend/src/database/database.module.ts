import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Purchase } from './entities/purchase.entity';
import { FlashSale } from './entities/flash-sale.entity';
import { User } from './entities/user.entity';
import { DatabaseInitService } from './database-init.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Purchase, FlashSale, User]),
  ],
  providers: [DatabaseInitService],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
