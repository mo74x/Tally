import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { Decimal } from 'decimal.js';

@Processor('settlement-queue')
@Injectable()
export class SettlementProcessor extends WorkerHost {
  private readonly logger = new Logger(SettlementProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  /**
   * The core work loop. BullMQ automatically triggers this process
   * when a new settlement event is dispatched.
   */
  async process(
    job: Job<{ employerId: string; payCycleId: string }>,
  ): Promise<any> {
    const { employerId, payCycleId } = job.data;
    this.logger.log(
      `Starting month-end settlement batch for Employer: ${employerId}, Pay Cycle: ${payCycleId}`,
    );

    // Fetch the targets of this specific cycle
    const payCycle = await this.prisma.payCycle.findFirst({
      where: { id: payCycleId, employerId, status: 'open' },
      include: {
        withdrawalRequests: {
          where: { status: 'approved' },
        },
      },
    });

    if (!payCycle) {
      this.logger.warn(`Pay Cycle ${payCycleId} already closed or invalid.`);
      return { status: 'SKIPPED', message: 'Cycle is not in an open state.' };
    }

    // Aggregate total amounts and service fees
    let totalWithdrawn = new Decimal(0);
    let totalFees = new Decimal(0);

    for (const request of payCycle.withdrawalRequests) {
      totalWithdrawn = totalWithdrawn.plus(request.amount);
      totalFees = totalFees.plus(request.feeAmount);
    }

    //Update states and create report aggregate inside an atomic transaction
    const batch = await this.prisma.$transaction(async (tx) => {
      //Create the completed settlement batch
      const settlementBatch = await tx.settlementBatch.create({
        data: {
          payCycleId: payCycle.id,
          totalWithdrawn,
          totalFees,
          reportGeneratedAt: new Date(),
          status: 'reconciled',
        },
      });

      //Close out the completed cycle
      await tx.payCycle.update({
        where: { id: payCycle.id },
        data: { status: 'closed' },
      });

      // Open up the next payroll cycle automatically
      const nextStart = new Date(payCycle.periodEnd);
      nextStart.setDate(nextStart.getDate() + 1);
      const nextEnd = new Date(
        nextStart.getFullYear(),
        nextStart.getMonth() + 1,
        0,
      );

      await tx.payCycle.create({
        data: {
          employerId,
          periodStart: nextStart,
          periodEnd: nextEnd,
          status: 'open',
        },
      });

      return settlementBatch;
    });

    this.logger.log(
      `Successfully finalized settlement batch ${batch.id}. Total: $${totalWithdrawn.toFixed(2)}`,
    );
    return { status: 'COMPLETED', batchId: batch.id };
  }
}
