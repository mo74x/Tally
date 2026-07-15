import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AccrualService } from '../accrual/accrual.service';
import { RedisLockService } from '../redis/redis-lock.service';
import { Decimal } from 'decimal.js';

export interface WithdrawalRequestDto {
  employeeId: string;
  payCycleId: string;
  amount: number;
  idempotencyKey: string;
}

@Injectable()
export class WithdrawalService {
  private readonly logger = new Logger(WithdrawalService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly accrual: AccrualService,
    private readonly redisLock: RedisLockService,
  ) {}

  async processWithdrawal(dto: WithdrawalRequestDto) {
    const lockKey = `tally:lock:employee:${dto.employeeId}:withdrawal`;

    // 5-second TTL to prevent deadlocks
    const lockId = await this.redisLock.acquireLock(lockKey, 5000);
    if (!lockId) {
      this.logger.warn(
        `Concurrency block: Employee ${dto.employeeId} attempted parallel withdrawal.`,
      );
      throw new HttpException(
        'A withdrawal is already processing. Please try again in a moment.',
        HttpStatus.CONFLICT,
      );
    }

    try {
      // dempotency Check
      const existingRequest = await this.prisma.withdrawalRequest.findUnique({
        where: {
          employeeId_idempotencyKey: {
            employeeId: dto.employeeId,
            idempotencyKey: dto.idempotencyKey,
          },
        },
      });

      if (existingRequest) {
        this.logger.log(`Idempotent return for key ${dto.idempotencyKey}`);
        return existingRequest; // Return previous outcome safely without double-charging
      }

      //Fetch Fresh Context from the Database
      const employee = await this.prisma.employee.findUnique({
        where: { id: dto.employeeId },
        include: { employer: true },
      });

      const payCycle = await this.prisma.payCycle.findUnique({
        where: { id: dto.payCycleId },
        include: {
          withdrawalRequests: {
            where: { status: 'approved' },
          },
        },
      });

      if (!employee || !payCycle || payCycle.status !== 'open') {
        throw new HttpException(
          'Invalid employee or pay cycle is not open',
          HttpStatus.BAD_REQUEST,
        );
      }

      //Calculate Live Accrual Balance
      const sumApproved = payCycle.withdrawalRequests.reduce(
        (acc, req) => acc.plus(req.amount).plus(req.feeAmount), // Deduct both amount and previously paid fees
        new Decimal(0),
      );

      const workingDaysElapsed = this.accrual.getWorkingDaysElapsed(
        payCycle.periodStart,
        new Date(), // Evaluate against the current real-world date
      );

      //standard 22 working days per month
      const availableBalance = this.accrual.calculateAvailableBalance({
        monthlySalary: employee.monthlySalary,
        totalWorkingDaysInCycle: 22,
        workingDaysElapsed,
        maxWithdrawalPct: employee.employer.maxWithdrawalPct,
        sumApprovedWithdrawals: sumApproved,
      });

      const requestedAmount = new Decimal(dto.amount);
      const feeAmount = new Decimal(2.5); // Flat transaction fee for the Tally platform
      const totalDeduction = requestedAmount.plus(feeAmount);

      if (totalDeduction.greaterThan(availableBalance)) {
        throw new HttpException(
          `Insufficient balance. Available: ${availableBalance.toFixed(2)}`,
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }

      //Double-Entry Database Transaction
      // If ANY of these steps fail, PostgreSQL rolls back the entire block instantly.
      const successfulWithdrawal = await this.prisma.$transaction(
        async (tx) => {
          //Insert the approved withdrawal request
          const request = await tx.withdrawalRequest.create({
            data: {
              employeeId: employee.id,
              payCycleId: payCycle.id,
              amount: requestedAmount,
              feeAmount: feeAmount,
              status: 'approved',
              idempotencyKey: dto.idempotencyKey,
            },
          });

          //Debit the Employee's accrued balance ledger
          await tx.ledgerEntry.create({
            data: {
              withdrawalRequestId: request.id,
              accountType: 'employee_balance',
              accountRefId: employee.id,
              entryType: 'debit',
              amount: totalDeduction,
            },
          });

          //Credit the Employer's payable ledger
          await tx.ledgerEntry.create({
            data: {
              withdrawalRequestId: request.id,
              accountType: 'employer_payable',
              accountRefId: employee.employerId,
              entryType: 'credit',
              amount: totalDeduction,
            },
          });

          return request;
        },
      );

      this.logger.log(
        `Withdrawal ${successfulWithdrawal.id} processed for employee ${employee.id}`,
      );
      return successfulWithdrawal;
    } finally {
      //Guarantee Lock Release
      // The finally block ensures the lock is released even if an exception is thrown
      await this.redisLock.releaseLock(lockKey, lockId);
    }
  }
}
