export class UserResponseDto {
  id: string;
  username: string;
  email: string;
  canPurchase: boolean;
  hasPurchased: boolean;
  purchaseId?: string;
  createdAt: Date;
  updatedAt: Date;
}
