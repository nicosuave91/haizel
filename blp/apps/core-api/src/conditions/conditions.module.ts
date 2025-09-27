import { Module } from '@nestjs/common';
import { ConditionsService } from './conditions.service';

@Module({
  providers: [ConditionsService],
  exports: [ConditionsService],
})
export class ConditionsModule {}
