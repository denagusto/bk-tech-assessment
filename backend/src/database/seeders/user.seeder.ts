import { DataSource } from 'typeorm';
import { User } from '../entities/user.entity';

export class UserSeeder {
  constructor(private dataSource: DataSource) {}

  async seed(): Promise<void> {
    const userRepository = this.dataSource.getRepository(User);
    const existingUsers = await userRepository.count();
    
    if (existingUsers === 0) {
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

      for (const dummyUser of dummyUsers) {
        const user = userRepository.create(dummyUser);
        await userRepository.save(user);
        console.log(`Created user: ${dummyUser.username}`);
      }
      
      console.log(`Successfully seeded ${dummyUsers.length} users`);
    } else {
      console.log(`Users already exist (${existingUsers} users found)`);
    }
  }
}
