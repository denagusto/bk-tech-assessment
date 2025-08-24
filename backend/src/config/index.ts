import { registerAs } from '@nestjs/config';

export const config = () => ({
  port: parseInt(process.env.PORT, 10) || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres123',
    name: process.env.DB_NAME || 'flash_sale',
  },
  
  kafka: {
    clientId: process.env.KAFKA_CLIENT_ID || 'flash-sale-service',
    brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
    groupId: process.env.KAFKA_GROUP_ID || 'flash-sale-group',
  },
  
  flashSale: {
    startTime: process.env.FLASH_SALE_START_TIME || '2024-01-15T10:00:00Z',
    endTime: process.env.FLASH_SALE_END_TIME || '2024-01-15T12:00:00Z',
    maxStock: parseInt(process.env.MAX_STOCK, 10) || 5,
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info',
    host: process.env.LOG_HOST || 'localhost',
    file: {
      dir: process.env.LOG_FILE_DIR || 'logs',
      maxSize: process.env.LOG_FILE_MAX_SIZE || '20m',
      maxFiles: process.env.LOG_FILE_MAX_FILES || '14d',
    },
    graylog: {
      host: process.env.GRAYLOG_HOST || 'localhost',
      port: parseInt(process.env.GRAYLOG_PORT, 10) || 12201,
      enabled: process.env.GRAYLOG_ENABLED === 'true',
    },
    console: {
      enabled: process.env.LOG_CONSOLE_ENABLED !== 'false',
      colors: process.env.LOG_CONSOLE_COLORS !== 'false',
    },
  },
});

export const databaseConfig = registerAs('database', () => config().database);
export const redisConfig = registerAs('redis', () => config().redis);
export const kafkaConfig = registerAs('kafka', () => config().kafka);
export const flashSaleConfig = registerAs('flashSale', () => config().flashSale);
export const loggingConfig = registerAs('logging', () => config().logging);
