import { describe, expect, it } from 'vitest';
import {
  createEsignEnvelope,
  fetchEsignEnvelope,
  recordEsignWebhook,
  upsertLockState,
  validateTridCompliance,
} from '../src/activities';

describe('worker activities', () => {
  it('flags redisclosure when a material change occurs after disclosure', async () => {
    const closingDate = new Date('2024-03-10T00:00:00Z');
    const result = await validateTridCompliance({
      closingDate,
      timeline: [
        { type: 'DISCLOSURE_DELIVERED', at: new Date('2024-03-01T12:00:00Z') },
        { type: 'BORROWER_ACKNOWLEDGED', at: new Date('2024-03-02T12:00:00Z') },
        { type: 'MATERIAL_CHANGE', at: new Date('2024-03-05T10:30:00Z'), reason: 'APR increased by 0.25%' },
      ],
    });

    expect(result.compliant).toBe(false);
    expect(result.redisclosureRequired).toBe(true);
    expect(result.message).toContain('Redisclosure required');
  });

  it('creates and fetches envelopes', async () => {
    const created = await createEsignEnvelope({
      envelopeId: 'env-123',
      documentUrl: 'https://example.com/doc.pdf',
      participants: [{ name: 'Borrower', email: 'borrower@example.com' }],
    });

    const envelope = await fetchEsignEnvelope('env-123');
    expect(envelope?.envelopeId).toBe('env-123');
    expect(created.status).toBe('SENT');
    expect(envelope?.history).toHaveLength(1);
  });

  it('applies webhook updates to the envelope state', async () => {
    await createEsignEnvelope({
      envelopeId: 'env-456',
      documentUrl: 'https://example.com/doc.pdf',
      participants: [{ name: 'Borrower', email: 'borrower@example.com' }],
    });

    const completion = await recordEsignWebhook({
      envelopeId: 'env-456',
      participantEmail: 'borrower@example.com',
      status: 'COMPLETED',
      occurredAt: new Date('2024-03-04T14:00:00Z'),
    });

    expect(completion.status).toBe('COMPLETED');
    expect(completion.history).toHaveLength(2);
    expect(completion.recipients[0].completedAt).toBeInstanceOf(Date);
  });

  it('updates lock state', async () => {
    const result = await upsertLockState({
      lockId: 'lock-1',
      expiresAt: new Date(Date.now() + 10_000),
    });
    expect(result.status).toBe('ACTIVE');
    expect(result.updatedAt).toBeInstanceOf(Date);
  });
});
