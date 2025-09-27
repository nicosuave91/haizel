import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { IsNotEmpty, IsNumber, IsPositive, IsString } from 'class-validator';
import { Request } from 'express';
import { LoansService } from './loans.service';
import { getRequestContext } from '../common/utils';

class CreateLoanRequest {
  @IsString()
  @IsNotEmpty()
  borrowerName!: string;

  @IsNumber()
  @IsPositive()
  amount!: number;
}

@Controller('loans')
export class LoansController {
  constructor(private readonly loans: LoansService) {}

  @Post()
  create(@Body() body: CreateLoanRequest, @Req() req: Request) {
    return this.loans.create(getRequestContext(req), body);
  }

  @Get(':id')
  get(@Param('id') id: string, @Req() req: Request) {
    return this.loans.get(getRequestContext(req), id);
  }

  @Get()
  list(@Req() req: Request) {
    return this.loans.list(getRequestContext(req));
  }
}
