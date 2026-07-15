import { Module } from '@nestjs/common';
import { WithdrawalService } from './withdrawal.service';
import { WithdrawalController } from './withdrawal.controller';
import { RedisModule } from '../redis/redis.module';
import { AccrualModule } from '../accrual/accrual.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [RedisModule, AccrualModule, PrismaModule],
  controllers: [WithdrawalController],
  providers: [WithdrawalService],
  exports: [WithdrawalService],
})
export class WithdrawalModule {}
