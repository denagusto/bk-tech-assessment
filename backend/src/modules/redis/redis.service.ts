import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { createClient, RedisClientType } from 'redis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private redis: RedisClientType;

  constructor() {}

  async onModuleInit() {
    this.redis = createClient({
      url: 'redis://localhost:6379', // Hardcoded for now
    });

    this.redis.on('error', (err) => {
      console.error('Redis Client Error:', err);
    });

    this.redis.on('connect', () => {
      console.log('Connected to Redis');
    });

    await this.redis.connect();
  }

  async onModuleDestroy() {
    if (this.redis) {
      await this.redis.quit();
    }
  }

  getClient(): RedisClientType {
    return this.redis;
  }

  async get(key: string): Promise<string | null> {
    return await this.redis.get(key);
  }

  async set(key: string, value: string): Promise<void> {
    await this.redis.set(key, value);
  }

  async setex(key: string, seconds: number, value: string): Promise<void> {
    await this.redis.setEx(key, seconds, value);
  }

  async del(key: string): Promise<void> {
    await this.redis.del(key);
  }

  async exists(key: string): Promise<number> {
    return await this.redis.exists(key);
  }

  async incr(key: string): Promise<number> {
    return await this.redis.incr(key);
  }

  async decr(key: string): Promise<number> {
    return await this.redis.decr(key);
  }

  async decrBy(key: string, amount: number): Promise<number> {
    return await this.redis.decrBy(key, amount);
  }

  async sismember(key: string, member: string): Promise<boolean> {
    return await this.redis.sIsMember(key, member);
  }

  async hset(key: string, field: string, value: string): Promise<void> {
    await this.redis.hSet(key, field, value);
  }

  async hget(key: string, field: string): Promise<string | null> {
    return await this.redis.hGet(key, field);
  }

  async hexists(key: string, field: string): Promise<boolean> {
    return await this.redis.hExists(key, field);
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    return await this.redis.hGetAll(key);
  }

  async multi() {
    return this.redis.multi();
  }

  async setWithOptions(key: string, value: string, options: string[]): Promise<boolean> {
    try {
      let result: string | null;
      
      if (options.includes('NX') && options.includes('PX')) {
        const pxIndex = options.indexOf('PX');
        const timeout = parseInt(options[pxIndex + 1]);
        result = await this.redis.set(key, value, { NX: true, PX: timeout });
      } else if (options.includes('PX')) {
        const pxIndex = options.indexOf('PX');
        const timeout = parseInt(options[pxIndex + 1]);
        result = await this.redis.set(key, value, { PX: timeout });
      } else if (options.includes('NX')) {
        result = await this.redis.set(key, value, { NX: true });
      } else {
        result = await this.redis.set(key, value);
      }
      
      return result === 'OK';
    } catch (error) {
      console.error('Redis setWithOptions error:', error);
      return false;
    }
  }

  async sadd(key: string, member: string): Promise<number> {
    return await this.redis.sAdd(key, member);
  }

  async srem(key: string, member: string): Promise<number> {
    return await this.redis.sRem(key, member);
  }

  async ping(): Promise<string> {
    return await this.redis.ping();
  }
}
