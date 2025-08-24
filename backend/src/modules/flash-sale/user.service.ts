import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { User } from '../../database/entities/user.entity';
import { Purchase } from '../../database/entities/purchase.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UserResponseDto } from './dto/user-response.dto';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Purchase)
    private readonly purchaseRepository: Repository<Purchase>,
    private readonly dataSource: DataSource,
  ) {}

  async createUser(createUserDto: CreateUserDto): Promise<User> {
    const user = this.userRepository.create(createUserDto);
    return await this.userRepository.save(user);
  }

  async createDummyUsers(userCount: number = 10): Promise<User[]> {
    const baseDummyUsers = [
      { username: 'john_doe', email: 'john.doe@example.com', canPurchase: true },
      { username: 'jane_smith', email: 'jane.smith@example.com', canPurchase: true },
      { username: 'bob_wilson', email: 'bob.wilson@example.com', canPurchase: false },
      { username: 'alice_brown', email: 'alice.brown@example.com', canPurchase: true },
      { username: 'charlie_davis', email: 'charlie.davis@example.com', canPurchase: false },
      { username: 'diana_miller', email: 'diana.miller@example.com', canPurchase: true },
      { username: 'edward_garcia', email: 'edward.garcia@example.com', canPurchase: true },
      { username: 'fiona_rodriguez', email: 'fiona.rodriguez@example.com', canPurchase: false },
      { username: 'george_martinez', email: 'george.martinez@example.com', canPurchase: true },
      { username: 'helen_anderson', email: 'helen.anderson@example.com', canPurchase: true },
    ];

    const users: User[] = [];
    const actualCount = Math.min(userCount, 15000); // Cap at 15,000 users for stress testing
    
    console.log(`Creating ${actualCount} users for stress testing...`);
    
    // For large counts, use more efficient approach
    if (actualCount > 100) {
      // Clear existing users first for clean seeding
      // Need to handle foreign key constraints properly
      await this.clearUsersWithConstraints();
      
      // Create users in smaller batches to avoid memory issues
      const batchSize = 100;
      const batches = Math.ceil(actualCount / batchSize);
      
      for (let batch = 0; batch < batches; batch++) {
        const batchUsers: any[] = [];
        const startIndex = batch * batchSize;
        const endIndex = Math.min(startIndex + batchSize, actualCount);
        
        for (let i = startIndex; i < endIndex; i++) {
          const baseUser = baseDummyUsers[i % baseDummyUsers.length];
          const username = `${baseUser.username}_${Math.floor(i / baseDummyUsers.length) + 1}`;
          const email = `${username}@example.com`;
          
          batchUsers.push(this.userRepository.create({
            username,
            email,
            canPurchase: baseUser.canPurchase
          }));
        }
        
        // Save batch
        const savedUsers = await this.userRepository.save(batchUsers);
        users.push(...savedUsers);
        
        if ((batch + 1) % 10 === 0 || batch === batches - 1) {
          console.log(`Created batch ${batch + 1}/${batches} (total: ${users.length} users)`);
        }
      }
    } else {
      // For small counts, use the original approach with existence check
      for (let i = 0; i < actualCount; i++) {
        const baseUser = baseDummyUsers[i % baseDummyUsers.length];
        const username = `${baseUser.username}_${Math.floor(i / baseDummyUsers.length) + 1}`;
        const email = `${username}@example.com`;
        
        const existingUser = await this.userRepository.findOne({
          where: [
            { username },
            { email }
          ]
        });

        if (!existingUser) {
          const user = this.userRepository.create({
            username,
            email,
            canPurchase: baseUser.canPurchase
          });
          users.push(await this.userRepository.save(user));
        }
      }
    }
    
    console.log(`Successfully created ${users.length} users`);

    return users;
  }

  async getAllUsers(): Promise<UserResponseDto[]> {
    const users = await this.userRepository.find({
      relations: ['purchases'],
      order: { createdAt: 'ASC' }
    });

    return users.map(user => ({
      id: user.id,
      username: user.username,
      email: user.email,
      canPurchase: user.canPurchase,
      hasPurchased: user.purchases.length > 0,
      purchaseId: user.purchases.length > 0 ? user.purchases[0].purchaseId : undefined,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    }));
  }

  private async clearUsersWithConstraints(): Promise<void> {
    try {
      // First, delete all purchases to remove foreign key constraints
      await this.dataSource.query('DELETE FROM purchases');
      
      // Then delete all users using remove() instead of clear() to handle constraints properly
      const allUsers = await this.userRepository.find();
      if (allUsers.length > 0) {
        await this.userRepository.remove(allUsers);
      }
      
      console.log('Users and purchases cleared successfully');
    } catch (error) {
      console.error('Error clearing users with constraints:', error);
      // Fallback: try to delete users one by one
      const allUsers = await this.userRepository.find();
      for (const user of allUsers) {
        try {
          await this.userRepository.remove(user);
        } catch (userError) {
          console.error(`Failed to remove user ${user.username}:`, userError);
        }
      }
      console.log('Users cleared using fallback method');
    }
  }

  async getAllUsersWithPagination(page: number = 1, limit: number = 20): Promise<{ users: UserResponseDto[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> {
    const skip = (page - 1) * limit;
    
    const [users, total] = await this.userRepository.findAndCount({
      relations: ['purchases'],
      order: { createdAt: 'ASC' },
      skip,
      take: limit
    });

    const userDtos = users.map(user => ({
      id: user.id,
      username: user.username,
      email: user.email,
      canPurchase: user.canPurchase,
      hasPurchased: user.purchases.length > 0,
      purchaseId: user.purchases.length > 0 ? user.purchases[0].purchaseId : undefined,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    }));

    const totalPages = Math.ceil(total / limit);

    return {
      users: userDtos,
      pagination: {
        page,
        limit,
        total,
        totalPages
      }
    };
  }

  async getUserByUsername(username: string): Promise<User | null> {
    return await this.userRepository.findOne({
      where: { username },
      relations: ['purchases']
    });
  }

  async getUserByEmail(email: string): Promise<User | null> {
    return await this.userRepository.findOne({
      where: { email },
      relations: ['purchases']
    });
  }

  async validateUserPurchase(username: string): Promise<{ canPurchase: boolean; message: string }> {
    const user = await this.getUserByUsername(username);
    
    if (!user) {
      return { canPurchase: false, message: 'User not found' };
    }

    if (!user.canPurchase) {
      return { canPurchase: false, message: 'User is not authorized to make purchases' };
    }

    if (user.purchases.length > 0) {
      return { canPurchase: false, message: 'User has already made a purchase' };
    }

    return { canPurchase: true, message: 'User can make a purchase' };
  }

  async resetUsers(): Promise<void> {
    try {
      // First delete all purchases to remove foreign key constraints
      const purchases = await this.purchaseRepository.find();
      if (purchases.length > 0) {
        await this.purchaseRepository.remove(purchases);
      }
      
      // Then delete all users
      const users = await this.userRepository.find();
      if (users.length > 0) {
        await this.userRepository.remove(users);
      }
      
      console.log('Users and purchases reset successfully');
    } catch (error) {
      console.error('Failed to reset users:', error);
      throw error;
    }
  }
}
