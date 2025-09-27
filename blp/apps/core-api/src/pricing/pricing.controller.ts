import { Body, Controller, Param, Post, Req } from '@nestjs/common';
import { IsNumber, IsPositive } from 'class-validator';
import { PricingService } from './pricing.service';
import { Request } from 'express';
import { getRequestContext } from '../common/utils';

class CreateLockRequest {
  @IsNumber()
  rate!: number;

  @IsNumber()
  @IsPositive()
  durationMinutes!: number;
}

@Controller('loans/:loanId/pricing')
export class PricingController {
  constructor(private readonly pricing: PricingService) {}

  @Post('lock')
  lock(@Param('loanId') loanId: string, @Body() body: CreateLockRequest, @Req() req: Request) {
    return this.pricing.lock(getRequestContext(req), loanId, body);
  }
}
