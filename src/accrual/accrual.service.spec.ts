import { Test, TestingModule } from '@nestjs/testing';
import { AccrualService } from './accrual.service';
//import { Decimal } from 'decimal.js';

describe('AccrualService', () => {
  let service: AccrualService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AccrualService],
    }).compile();

    service = module.get<AccrualService>(AccrualService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('calculateAvailableBalance', () => {
    it('should correctly calculate available balance for half a month with no previous withdrawals', () => {
      const balance = service.calculateAvailableBalance({
        monthlySalary: '3000.00',
        totalWorkingDaysInCycle: 20,
        workingDaysElapsed: 10, //worked 1/2 of the days
        maxWithdrawalPct: '50.00', // can access 50% of earned wages
        sumApprovedWithdrawals: 0, //hasn't withdrawn yet
      });

      expect(balance.toString()).toBe('750');
    });

    it('should correctly deduct previous withdrawals from the current available ceiling', () => {
      const balance = service.calculateAvailableBalance({
        monthlySalary: '3000.00',
        totalWorkingDaysInCycle: 20,
        workingDaysElapsed: 10, //worked 1/2 of the days
        maxWithdrawalPct: '50.00', // can access 50% of earned wages
        sumApprovedWithdrawals: '250.00', //already withdrew $250
      });

      expect(balance.toString()).toBe('500'); //remaining
    });
  });

  describe('getWorkingDaysElapsed', () => {
    it('should accurately calculate working days while skipping weekends', () => {
      const startDate = new Date('2026-07-01'); // Wed
      const endDate = new Date('2026-07-08'); // Next Wed

      const workingDays = service.getWorkingDaysElapsed(startDate, endDate);

      expect(workingDays).toBe(6);
    });
  });
});
