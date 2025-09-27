import { Module } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { DocumentsController } from './documents.controller';
import { EventsModule } from '../events/events.module';
import { CommonModule } from '../common/common.module';
import { OpaModule } from '../opa/opa.module';

@Module({
  imports: [EventsModule, CommonModule, OpaModule],
  providers: [DocumentsService],
  controllers: [DocumentsController],
  exports: [DocumentsService],
})
export class DocumentsModule {}
