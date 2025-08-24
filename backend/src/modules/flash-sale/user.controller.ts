import { Controller, Get, Post, Delete, Query, Body } from '@nestjs/common';
import { UserService } from './user.service';
import { UserResponseDto } from './dto/user-response.dto';

@Controller('api/users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  async getAllUsers(@Query('page') page: number = 1, @Query('limit') limit: number = 20): Promise<{ users: UserResponseDto[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> {
    return await this.userService.getAllUsersWithPagination(page, limit);
  }

  @Post('seed')
  async seedDummyUsers(@Body() body: { userCount?: number } = {}): Promise<{ message: string; usersCreated: number }> {
    const { userCount = 10 } = body;
    const users = await this.userService.createDummyUsers(userCount);
    return {
      message: `Dummy users created successfully (${userCount} users)`,
      usersCreated: users.length
    };
  }

  @Delete('reset')
  async resetUsers(): Promise<{ message: string }> {
    await this.userService.resetUsers();
    return { message: 'Users reset successfully' };
  }
}
