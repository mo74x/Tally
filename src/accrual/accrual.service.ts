import { Injectable } from '@nestjs/common';
import { Decimal } from 'decimal.js';

export interface AccrualParams {
  monthlySalary: number | string | Decimal;
  totalWorkingDaysInCycle: number;
  workingDaysElapsed: number;
  maxWithdrawalPct: number | string | Decimal;
  sumApprovedWithdrawals: number | string | Decimal;
}

@Injectable()
export class AccrualService {
  //Computes the available earned-wage balance using high-precision decimal math.
  calculateAvailableBalance(params: AccrualParams): Decimal {
    const salary = new Decimal(params.monthlySalary);
    const maxPct = new Decimal(params.maxWithdrawalPct).dividedBy(100);
    const approvedWithdrawals = new Decimal(params.sumApprovedWithdrawals);

    // Calculate base earned entitlement to date
    const dailyRate = salary.dividedBy(params.totalWorkingDaysInCycle);
    const earnedToDate = dailyRate.times(params.workingDaysElapsed);

    // Calculate the maximum ceiling allowed to be withdrawn
    const accessibleCeiling = earnedToDate.times(maxPct);

    // Subtract previously approved withdrawals in this cycle
    const availableBalance = accessibleCeiling.minus(approvedWithdrawals);

    // Guard against negative balances
    return Decimal.max(0, availableBalance);
  }

  //utility to compute total working days excluding weekends
  //from the start of a pay cycle up to a specific date.
  getWorkingDaysElapsed(cycleStartDate: Date, currentDate: Date): number {
    let count = 0;
    const curDate = new Date(cycleStartDate.getTime());

    // Loop through each day from start to current date
    while (curDate <= currentDate) {
      const dayOfWeek = curDate.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        count++;
      }
      curDate.setDate(curDate.getDate() + 1);
    }

    return count;
  }
}
