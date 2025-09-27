import { Module } from '@nestjs/common';
import { LoansService } from './loans.service';
import { LoansController } from './loans.controller';
import { CommonModule } from '../common/common.module';
import { EventsModule } from '../events/events.module';
import { OpaModule } from '../opa/opa.module';

@Module({
  imports: [CommonModule, EventsModule, OpaModule],
  providers: [LoansService],
  controllers: [LoansController],
  exports: [LoansService],
})
export class LoansModule {}
