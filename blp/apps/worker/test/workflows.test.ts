import { describe, expect, it, vi } from 'vitest';
import {
  EsignWorkflowInput,
  LockWorkflowInput,
  TridWorkflowInput,
  esignWorkflow,
  lockLifecycleWorkflow,
  tridWorkflow,
} from '../src/workflows';
import { recordEsignWebhook } from '../src/activities';

describe('workflows', () => {
  it('approves TRID timelines that meet waiting period and acknowledgement', async () => {
    const input: TridWorkflowInput = {
      loanId: 'loan-1',
      closingDate: new Date('2024-03-10T00:00:00Z'),
      timeline: [
        { type: 'DISCLOSURE_DELIVERED', at: new Date('2024-03-01T09:00:00Z') },
        { type: 'BORROWER_ACKNOWLEDGED', at: new Date('2024-03-02T16:00:00Z') },
      ],
    };

    await expect(tridWorkflow(input)).resolves.toMatchObject({ compliant: true });
  });

  it('requires redisclosure when a material change occurs after delivery', async () => {
    const input: TridWorkflowInput = {
      loanId: 'loan-redisclosure',
      closingDate: new Date('2024-03-10T00:00:00Z'),
      timeline: [
        { type: 'DISCLOSURE_DELIVERED', at: new Date('2024-03-01T09:00:00Z') },
        { type: 'MATERIAL_CHANGE', at: new Date('2024-03-05T10:00:00Z'), reason: 'APR increased by 0.25%' },
      ],
    };

    await expect(tridWorkflow(input)).rejects.toThrow(/Redisclosure required/);
  });

  it('waits for e-sign completion using webhook updates', async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2024-04-01T12:00:00Z'));

      const input: EsignWorkflowInput = {
        envelopeId: 'env-1',
        documentUrl: 'https://example.com/doc.pdf',
        participants: [{ name: 'Borrower', email: 'borrower@example.com' }],
        waitForCompletion: true,
        pollIntervalMs: 1_000,
      };

      const promise = esignWorkflow(input);

      setTimeout(() => {
        void recordEsignWebhook({
          envelopeId: input.envelopeId,
          participantEmail: 'borrower@example.com',
          status: 'COMPLETED',
          occurredAt: new Date(Date.now() + 3_000),
        });
      }, 2_000);

      await vi.advanceTimersByTimeAsync(5_000);

      const result = await promise;
      expect(result.status).toBe('COMPLETED');
    } finally {
      vi.useRealTimers();
    }
  });

  it('transitions locks to expired once the expiration passes', async () => {
    vi.useFakeTimers();
    try {
      const start = new Date('2024-04-10T08:00:00Z');
      vi.setSystemTime(start);

      const input: LockWorkflowInput = {
        lockId: 'lock-expiring',
        expiresAt: new Date(start.getTime() + 5_000),
        pollIntervalMs: 1_000,
      };

      const promise = lockLifecycleWorkflow(input);

      await vi.advanceTimersByTimeAsync(6_000);

      const result = await promise;
      expect(result.status).toBe('EXPIRED');
    } finally {
      vi.useRealTimers();
    }
  });
});
