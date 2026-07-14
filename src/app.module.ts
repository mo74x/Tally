import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AccrualModule } from './accrual/accrual.module';
import { WithdrawalModule } from './withdrawal/withdrawal.module';
import { SettlementModule } from './settlement/settlement.module';

@Module({
  imports: [PrismaModule, AccrualModule, WithdrawalModule, SettlementModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
