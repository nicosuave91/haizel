import { Body, Controller, Param, Post, Req } from '@nestjs/common';
import { IsNotEmpty, IsString } from 'class-validator';
import { Request } from 'express';
import { AusService } from './aus.service';
import { getRequestContext } from '../common/utils';

class AusRunRequest {
  @IsString()
  @IsNotEmpty()
  engine!: string;
}

@Controller('loans/:loanId/aus')
export class AusController {
  constructor(private readonly aus: AusService) {}

  @Post('run')
  run(@Param('loanId') loanId: string, @Body() body: AusRunRequest, @Req() req: Request) {
    return this.aus.run(getRequestContext(req), loanId, body);
  }
}
