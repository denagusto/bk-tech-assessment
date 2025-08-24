import { DataSource } from 'typeorm';
import { config } from '../src/config';
import { User } from '../src/database/entities/user.entity';
import { Purchase } from '../src/database/entities/purchase.entity';
import { FlashSale } from '../src/database/entities/flash-sale.entity';

const dataSource = new DataSource({
  type: 'postgres',
  host: config().database.host,
  port: config().database.port,
  username: config().database.username,
  password: config().database.password,
  database: config().database.name,
  entities: [User, Purchase, FlashSale],
  synchronize: true, // This will create tables automatically
  logging: true,
});

async function setupDatabase() {
  try {
    await dataSource.initialize();
    console.log('Database connection established');
    
    // Create tables
    await dataSource.synchronize();
    console.log('Database tables created');
    
    // Seed users
    const userRepository = dataSource.getRepository(User);
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
    
    await dataSource.destroy();
    console.log('Database connection closed');
    console.log('Database setup completed successfully!');
    
  } catch (error) {
    console.error('Database setup failed:', error);
    process.exit(1);
  }
}

setupDatabase();
