export interface FlashSaleStatus {
  status: 'upcoming' | 'active' | 'ended' | 'sold-out';
  startTime: string;
  endTime: string;
  currentStock: number;
  maxStock: number;
  timeUntilStart?: number;
  timeUntilEnd?: number;
}

export interface PurchaseResult {
  success: boolean;
  message: string;
  purchaseId?: string;
  timestamp: string;
}

export interface UserPurchaseStatus {
  hasPurchased: boolean;
  purchaseId?: string;
}

export interface User {
  id: string;
  username: string;
  email: string;
  canPurchase: boolean;
  hasPurchased: boolean;
  purchaseId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserSeedResponse {
  message: string;
  usersCreated: number;
}

export interface ProductDetails {
  condition: string;
  warranty: string;
  weight: string;
}

export interface ProductSpecification {
  bluetooth: string;
  battery_life: string;
  water_resistance: string;
  driver_size: string;
  frequency_response: string;
}

export interface ImportantInfo {
  see_in_ui: string;
  compatibility: string;
  shipping: string;
  security: string;
}

export interface ProductImages {
  main: string;
  thumbnails: string[];
  gallery: string[];
}

export interface Product {
  id: string;
  product_name: string;
  description: string;
  details: ProductDetails;
  specification: ProductSpecification;
  important_info: ImportantInfo;
  images: ProductImages;
  price: number;
  currency_code: string;
  currency_symbol: string;
  discount: number;
  price_after_discount: number;
  current_stock: number;
  max_stock: number;
  start_time: string;
  end_time: string;
}
