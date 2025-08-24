import { Controller, Get, Post, Delete } from '@nestjs/common';
import { UserService } from './user.service';
import { UserResponseDto } from './dto/user-response.dto';

@Controller('api/users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  async getAllUsers(): Promise<UserResponseDto[]> {
    return await this.userService.getAllUsers();
  }

  @Post('seed')
  async seedDummyUsers(): Promise<{ message: string; usersCreated: number }> {
    const users = await this.userService.createDummyUsers();
    return {
      message: 'Dummy users created successfully',
      usersCreated: users.length
    };
  }

  @Delete('reset')
  async resetUsers(): Promise<{ message: string }> {
    await this.userService.resetUsers();
    return { message: 'Users reset successfully' };
  }
}
