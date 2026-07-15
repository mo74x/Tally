import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
//import { SettlementService } from './settlement.service';
import { SettlementProcessor } from './settlement.processor';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    //connection to our Redis instance for BullMQ
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
      },
    }),
    //queue specifically for settlement tasks
    BullModule.registerQueue({
      name: 'settlement-queue',
    }),
  ],
  providers: [SettlementProcessor],
  exports: [],
})
export class SettlementModule {}
