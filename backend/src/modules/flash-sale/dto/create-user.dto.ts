import { IsString, IsEmail, MinLength, MaxLength } from 'class-validator';

export class CreateUserDto {
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  username: string;

  @IsEmail()
  @MaxLength(255)
  email: string;

  @IsString()
  canPurchase: boolean = false;
}
