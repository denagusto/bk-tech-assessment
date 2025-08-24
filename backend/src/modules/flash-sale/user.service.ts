import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
  ) {}

  async createUser(createUserDto: CreateUserDto): Promise<User> {
    const user = this.userRepository.create(createUserDto);
    return await this.userRepository.save(user);
  }

  async createDummyUsers(): Promise<User[]> {
    const dummyUsers = [
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
    for (const dummyUser of dummyUsers) {
      const existingUser = await this.userRepository.findOne({
        where: [
          { username: dummyUser.username },
          { email: dummyUser.email }
        ]
      });

      if (!existingUser) {
        const user = this.userRepository.create(dummyUser);
        users.push(await this.userRepository.save(user));
      }
    }

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
