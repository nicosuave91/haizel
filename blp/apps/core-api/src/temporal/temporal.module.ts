import { Module } from '@nestjs/common';
import { ConfigModule } from '../config';
import { WorkflowsClient } from './workflows.client';

@Module({
  imports: [ConfigModule],
  providers: [WorkflowsClient],
  exports: [WorkflowsClient],
})
export class TemporalModule {}
