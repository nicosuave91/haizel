import { HaizelOutboxEvent } from './topics';

export interface OutboxRepository {
  dequeueBatch(limit: number): Promise<HaizelOutboxEvent[]>;
  markSent(ids: string[]): Promise<void>;
  markFailed(id: string, reason: string): Promise<void>;
}

export interface WebhookPublisher {
  publish(event: HaizelOutboxEvent): Promise<void>;
}

export class SampleOutboxDispatcher {
  constructor(private readonly repo: OutboxRepository, private readonly publisher: WebhookPublisher) {}

  async dispatchOnce(): Promise<void> {
    const events = await this.repo.dequeueBatch(25);
    if (events.length === 0) {
      return;
    }

    const succeeded: string[] = [];
    await Promise.all(
      events.map(async (event) => {
        try {
          await this.publisher.publish(event);
          succeeded.push(event.id);
        } catch (error) {
          await this.repo.markFailed(event.id, (error as Error).message);
        }
      }),
    );

    if (succeeded.length > 0) {
      await this.repo.markSent(succeeded);
    }
  }
}
