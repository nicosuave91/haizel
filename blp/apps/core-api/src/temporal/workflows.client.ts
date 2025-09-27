import { Injectable } from '@nestjs/common';
import { ConfigService } from '../config';

export interface ScheduledWorkflow {
  workflow: string;
  referenceId: string;
  runAt: Date;
  namespace: string;
}

@Injectable()
export class WorkflowsClient {
  private readonly scheduled: ScheduledWorkflow[] = [];

  constructor(private readonly config: ConfigService) {}

  schedule(workflow: string, referenceId: string, runAt: Date): void {
    this.scheduled.push({ workflow, referenceId, runAt, namespace: this.config.temporal.namespace });
  }

  getScheduled(): ScheduledWorkflow[] {
    return [...this.scheduled];
  }
}
