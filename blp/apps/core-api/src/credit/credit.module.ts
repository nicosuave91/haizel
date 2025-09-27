import { Module } from '@nestjs/common';
import { CreditService } from './credit.service';
import { CreditController } from './credit.controller';
import { CommonModule } from '../common/common.module';
import { OpaModule } from '../opa/opa.module';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [CommonModule, OpaModule, EventsModule],
  providers: [CreditService],
  controllers: [CreditController],
})
export class CreditModule {}
