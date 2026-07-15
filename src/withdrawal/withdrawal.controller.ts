import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { WithdrawalService } from './withdrawal.service';
import { IsUUID, IsNotEmpty, IsPositive, IsNumber } from 'class-validator';

// Strict validation DTO to protect our financial interface
export class CreateWithdrawalBodyDto {
  @IsUUID()
  @IsNotEmpty()
  employeeId: string;

  @IsUUID()
  @IsNotEmpty()
  payCycleId: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount: number;

  @IsNotEmpty()
  idempotencyKey: string;
}

@Controller('v1/withdrawal-requests')
export class WithdrawalController {
  constructor(private readonly withdrawalService: WithdrawalService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async createWithdrawal(@Body() body: CreateWithdrawalBodyDto) {
    // Map HTTP body clean variables directly to our application service
    const result = await this.withdrawalService.processWithdrawal({
      employeeId: body.employeeId,
      payCycleId: body.payCycleId,
      amount: body.amount,
      idempotencyKey: body.idempotencyKey,
    });

    return {
      success: true,
      data: result,
    };
  }
}
