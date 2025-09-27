export interface EnvelopeParticipant {
  name: string;
  email: string;
  role: 'BORROWER' | 'COBORROWER';
  status?: 'PENDING' | 'SIGNED';
}

export interface CreateEnvelopeRequest {
  envelopeId: string;
  documentUrl: string;
  participants: EnvelopeParticipant[];
  callbackUrl: string;
}

export interface EnvelopeSummary {
  envelopeId: string;
  status: 'CREATED' | 'SENT' | 'COMPLETED';
  participants: EnvelopeParticipant[];
}

export interface WebhookEvent {
  envelopeId: string;
  status: 'COMPLETED' | 'DECLINED';
  reason?: string;
}

export interface ESignAdapter {
  createEnvelope(request: CreateEnvelopeRequest): Promise<EnvelopeSummary>;
  getEnvelope(envelopeId: string): Promise<EnvelopeSummary | undefined>;
  acknowledgeWebhook(event: WebhookEvent): Promise<void>;
}

class MockESignAdapter implements ESignAdapter {
  private readonly envelopes = new Map<string, EnvelopeSummary>();

  async createEnvelope(request: CreateEnvelopeRequest): Promise<EnvelopeSummary> {
    const summary: EnvelopeSummary = {
      envelopeId: request.envelopeId,
      status: 'SENT',
      participants: request.participants.map((participant) => ({
        ...participant,
        status: 'PENDING',
      })),
    };
    this.envelopes.set(summary.envelopeId, summary);
    return summary;
  }

  async getEnvelope(envelopeId: string): Promise<EnvelopeSummary | undefined> {
    return this.envelopes.get(envelopeId);
  }

  async acknowledgeWebhook(event: WebhookEvent): Promise<void> {
    const envelope = this.envelopes.get(event.envelopeId);
    if (!envelope) {
      return;
    }

    envelope.status = event.status === 'COMPLETED' ? 'COMPLETED' : 'SENT';
    envelope.participants = envelope.participants.map((participant) => ({
      ...participant,
      status: event.status === 'COMPLETED' ? 'SIGNED' : participant.status,
    }));
    this.envelopes.set(event.envelopeId, envelope);
  }
}

export class ESignService {
  constructor(private readonly adapter: ESignAdapter = new MockESignAdapter()) {}

  createEnvelope(request: CreateEnvelopeRequest): Promise<EnvelopeSummary> {
    return this.adapter.createEnvelope(request);
  }

  getEnvelope(envelopeId: string): Promise<EnvelopeSummary | undefined> {
    return this.adapter.getEnvelope(envelopeId);
  }

  acknowledgeWebhook(event: WebhookEvent): Promise<void> {
    return this.adapter.acknowledgeWebhook(event);
  }
}
