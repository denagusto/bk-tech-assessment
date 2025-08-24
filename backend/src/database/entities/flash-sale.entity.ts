import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { Purchase } from './purchase.entity';

export interface ProductDetails {
  condition: string;
  warranty: string;
  weight: string;
}

export interface ProductSpecification {
  bluetooth?: string;
  battery_life?: string;
  water_resistance?: string;
  driver_size?: string;
  frequency_response?: string;
  [key: string]: any;
}

export interface ImportantInfo {
  see_in_ui: string;
  highlights?: string[];
  restrictions?: string[];
  [key: string]: any;
}

export interface ProductImages {
  main: string;
  thumbnails: string[];
  gallery: string[];
}

@Entity('flash_sales')
export class FlashSale {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  product_name: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'json' })
  details: ProductDetails;

  @Column({ type: 'json' })
  specification: ProductSpecification;

  @Column({ type: 'json' })
  important_info: ImportantInfo;

  @Column({ type: 'json' })
  images: ProductImages;

  @Column({ type: 'int', default: 0 })
  current_stock: number;

  @Column({ type: 'int', default: 1000 })
  max_stock: number;

  @Column({ type: 'timestamp' })
  start_time: Date;

  @Column({ type: 'timestamp' })
  end_time: Date;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  price: number;

  @Column({ type: 'varchar', length: 10, default: 'USD' })
  currency_code: string;

  @Column({ type: 'varchar', length: 5, default: '$' })
  currency_symbol: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  discount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  price_after_discount: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany(() => Purchase, purchase => purchase.flash_sale)
  purchases: Purchase[];
}
