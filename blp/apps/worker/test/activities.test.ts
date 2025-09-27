import { describe, expect, it } from 'vitest';
import {
  createEsignEnvelope,
  fetchEsignEnvelope,
  upsertLockState,
  validateTridCompliance,
} from '../src/activities';

describe('worker activities', () => {
  it('validates TRID compliance', async () => {
    const compliant = await validateTridCompliance({
      disclosureDelivered: true,
      waitingPeriodDays: 3,
      borrowerAcknowledged: true,
    });
    expect(compliant.compliant).toBe(true);
  });

  it('creates and fetches envelopes', async () => {
    await createEsignEnvelope({
      envelopeId: 'env-123',
      documentUrl: 'https://example.com/doc.pdf',
      participants: [{ name: 'Borrower', email: 'borrower@example.com' }],
    });

    const envelope = await fetchEsignEnvelope('env-123');
    expect(envelope?.envelopeId).toBe('env-123');
  });

  it('updates lock state', async () => {
    const result = await upsertLockState({
      lockId: 'lock-1',
      expiresAt: new Date(Date.now() + 10_000),
    });
    expect(result.status).toBe('ACTIVE');
  });
});
