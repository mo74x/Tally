import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class SettlementService {
  private readonly logger = new Logger(SettlementService.name);

  constructor(
    @InjectQueue('settlement-queue') private readonly settlementQueue: Queue,
  ) {}

  async dispatchBatchJob(
    employerId: string,
    payCycleId: string,
  ): Promise<void> {
    this.logger.log(
      `Dispatching settlement job for employer ${employerId} and cycle ${payCycleId}`,
    );

    await this.settlementQueue.add(
      'process-settlement',
      { employerId, payCycleId },
      {
        jobId: `settlement-${employerId}-${payCycleId}`, // Idempotency key for BullMQ
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      },
    );
  }
}
