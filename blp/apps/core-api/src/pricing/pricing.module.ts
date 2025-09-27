import { Module } from '@nestjs/common';
import { PricingService } from './pricing.service';
import { PricingController } from './pricing.controller';
import { CommonModule } from '../common/common.module';
import { OpaModule } from '../opa/opa.module';
import { TemporalModule } from '../temporal/temporal.module';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [CommonModule, OpaModule, TemporalModule, EventsModule],
  providers: [PricingService],
  controllers: [PricingController],
  exports: [PricingService],
})
export class PricingModule {}
