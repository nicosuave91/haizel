import { Injectable } from '@nestjs/common';

export interface DomainEvent<TPayload = Record<string, unknown>> {
  type: string;
  tenantId: string;
  payload: TPayload;
  timestamp: Date;
}

@Injectable()
export class EventsProducerService {
  private readonly events: DomainEvent[] = [];

  emit<TPayload extends Record<string, unknown>>(event: DomainEvent<TPayload>): void {
    this.events.push(event);
  }

  getEmittedEvents(): DomainEvent[] {
    return [...this.events];
  }
}
