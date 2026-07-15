import { Global, Module } from '@nestjs/common';
import Redis from 'ioredis';
import { RedisLockService } from './redis-lock.service';

@Global()
@Module({
  providers: [
    {
      provide: 'REDIS_CLIENT',
      useFactory: () => {
        return new Redis({
          host: process.env.REDIS_HOST || '127.0.0.1',
          port: parseInt(process.env.REDIS_PORT || '6379', 10),
          keyPrefix: 'tally:lock:', //for Tally locks
        });
      },
    },
    RedisLockService,
  ],
  exports: ['REDIS_CLIENT', RedisLockService],
})
export class RedisModule {}
