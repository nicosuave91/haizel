import { hmacSignature } from '../providers/base';

export interface VendorWebhookPayload {
  headers: Record<string, string>;
  body: unknown;
  tenantId: string;
  vendor: 'amc' | 'flood' | 'mi' | 'title' | 'esign';
  secret: string;
}

export interface WebhookProcessor {
  process(payload: VendorWebhookPayload): Promise<void>;
}

export class VendorWebhookHandler {
  constructor(private readonly processor: WebhookProcessor) {}

  async handle(payload: VendorWebhookPayload): Promise<void> {
    const signature = payload.headers['x-haizel-signature'];
    const expected = hmacSignature(payload.secret, payload.body);
    if (!signature || signature !== expected) {
      throw new Error('Invalid webhook signature');
    }

    await this.processor.process(payload);
  }
}
