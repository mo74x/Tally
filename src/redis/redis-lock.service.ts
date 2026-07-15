import { Injectable, Inject } from '@nestjs/common';
import Redis from 'ioredis';
import { randomUUID } from 'crypto';

@Injectable()
export class RedisLockService {
  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {}

  async acquireLock(key: string, ttlMs: number = 5000): Promise<string | null> {
    const lockId = randomUUID();
    const result = await this.redis.set(key, lockId, 'PX', ttlMs, 'NX');
    return result === 'OK' ? lockId : null;
  }

  async releaseLock(key: string, lockId: string): Promise<boolean> {
    const luaScript = `
      if redis.call("GET", KEYS[1]) == ARGV[1] then
        return redis.call("DEL", KEYS[1])
      else
        return 0
      end
    `;
    const result = await this.redis.eval(luaScript, 1, key, lockId);
    return result === 1;
  }
}
