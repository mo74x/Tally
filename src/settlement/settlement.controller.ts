/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  Controller,
  Post,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { EmployerIsolationGuard } from '../auth/guards/employer-isolation.guard';
import { SettlementService } from './settlement.service';

@Controller('v1/employers/:id/settlements')
@UseGuards(EmployerIsolationGuard)
export class SettlementController {
  constructor(private readonly settlementService: SettlementService) {}

  @Post('cycles/:cycleId/run')
  @HttpCode(HttpStatus.ACCEPTED)
  async triggerSettlementBatch(
    @Param('id') employerId: string,
    @Param('cycleId') payCycleId: string,
  ) {
    await this.settlementService.dispatchBatchJob(employerId, payCycleId);

    return {
      success: true,
      message:
        'Settlement batch job successfully dispatched to the processing queue.',
      employerId,
      payCycleId,
    };
  }
}
