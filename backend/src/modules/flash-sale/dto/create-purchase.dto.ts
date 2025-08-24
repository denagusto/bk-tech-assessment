import { IsString, IsNotEmpty, Length } from 'class-validator';

export class CreatePurchaseDto {
  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  userIdentifier: string; // Username or email
}
