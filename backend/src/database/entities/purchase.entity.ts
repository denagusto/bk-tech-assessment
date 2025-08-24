import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';
import { FlashSale } from './flash-sale.entity';

@Entity('purchases')
export class Purchase {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  userId: string;

  @Column({ type: 'varchar', length: 100 })
  purchaseId: string;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  timestamp: Date;

  @Column({ type: 'uuid' })
  flash_sale_id: string;

  @ManyToOne(() => User, user => user.purchases)
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToOne(() => FlashSale, flashSale => flashSale.purchases)
  @JoinColumn({ name: 'flash_sale_id' })
  flash_sale: FlashSale;
}
