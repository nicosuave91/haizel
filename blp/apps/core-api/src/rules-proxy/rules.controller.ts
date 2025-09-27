import { Body, Controller, HttpCode, Param, Post, Req } from '@nestjs/common';
import { IsNotEmpty, IsString } from 'class-validator';
import { Request } from 'express';
import { RulesProxyService } from './rules.service';
import { getRequestContext } from '../common/utils';

class RulesEvaluationRequest {
  @IsString()
  @IsNotEmpty()
  trigger!: string;
}

@Controller('loans/:loanId/rules')
export class RulesController {
  constructor(private readonly rules: RulesProxyService) {}

  @Post('evaluate')
  @HttpCode(200)
  evaluate(@Param('loanId') loanId: string, @Body() body: RulesEvaluationRequest, @Req() req: Request) {
    return this.rules.evaluate(getRequestContext(req), loanId, body);
  }
}
