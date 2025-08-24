import { config } from 'dotenv';

config({ path: '.env.test' });

process.env.NODE_ENV = 'test';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.FLASH_SALE_START_TIME = '2024-01-01T00:00:00Z';
process.env.FLASH_SALE_END_TIME = '2024-12-31T23:59:59Z';
process.env.MAX_STOCK = '100';
