import { Body, Controller, Param, Post, Req } from '@nestjs/common';
import { IsNotEmpty, IsString } from 'class-validator';
import { Request } from 'express';
import { CreditService } from './credit.service';
import { getRequestContext } from '../common/utils';

class CreditPullRequest {
  @IsString()
  @IsNotEmpty()
  bureau!: string;
}

@Controller('loans/:loanId/credit')
export class CreditController {
  constructor(private readonly credit: CreditService) {}

  @Post('pull')
  pull(@Param('loanId') loanId: string, @Body() body: CreditPullRequest, @Req() req: Request) {
    return this.credit.pull(getRequestContext(req), loanId, body);
  }
}
