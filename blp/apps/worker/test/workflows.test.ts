import { describe, expect, it } from 'vitest';
import {
  EsignWorkflowInput,
  LockWorkflowInput,
  TridWorkflowInput,
  esignWorkflow,
  lockLifecycleWorkflow,
  tridWorkflow,
} from '../src/workflows';

describe('workflows', () => {
  it('approves TRID when compliant', async () => {
    const input: TridWorkflowInput = {
      loanId: 'loan-1',
      disclosureDelivered: true,
      waitingPeriodDays: 3,
      borrowerAcknowledged: true,
    };

    // Should not throw when compliant
    await expect(tridWorkflow(input)).resolves.toMatchObject({ compliant: true });
  });

  it('creates an e-sign envelope', async () => {
    const input: EsignWorkflowInput = {
      envelopeId: 'env-1',
      documentUrl: 'https://example.com/doc.pdf',
      participants: [{ name: 'Borrower', email: 'borrower@example.com' }],
    };

    const result = await esignWorkflow(input);
    expect(result.envelopeId).toBe('env-1');
  });

  it('persists lock state', async () => {
    const input: LockWorkflowInput = {
      lockId: 'lock-1',
      expiresAt: new Date(Date.now() + 60_000),
    };

    const result = await lockLifecycleWorkflow(input);
    expect(result.status).toBe('ACTIVE');
  });
});
