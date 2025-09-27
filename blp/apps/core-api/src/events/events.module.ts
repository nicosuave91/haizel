import { Module } from '@nestjs/common';
import { EventsProducerService } from './producer.service';

@Module({
  providers: [EventsProducerService],
  exports: [EventsProducerService],
})
export class EventsModule {}
