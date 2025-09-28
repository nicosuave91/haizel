import { VendorEventEmitter } from '../providers/base';
import {
  NormalizedWebhookEvent,
  VendorWebhookController,
  WorkflowTransitioner,
} from './common';
import { VerifiedWebhook, WebhookVerifier } from './security';

export interface IncomeEmploymentWebhookPayload {
  loanId: string;
  vendorCallId: string;
  employmentStatus: 'verified' | 'unable_to_verify' | 'manual_review';
  incomeStreams: Array<{
    employerName: string;
    annualIncomeCents: number;
  }>;
}

export function createIncomeEmploymentWebhookController(
  verifier: WebhookVerifier,
  emitter: VendorEventEmitter,
  transitioner: WorkflowTransitioner,
): VendorWebhookController<IncomeEmploymentWebhookPayload> {
  return new VendorWebhookController<IncomeEmploymentWebhookPayload>({
    verifier,
    emitter,
    transitioner,
    normalize: async (webhook) => normalizeIncomePayload(webhook),
  });
}

async function normalizeIncomePayload(
  webhook: VerifiedWebhook<IncomeEmploymentWebhookPayload>,
): Promise<NormalizedWebhookEvent> {
  const { tenantId, body } = webhook;
  const status = body.employmentStatus === 'verified' ? 'complete' : body.employmentStatus === 'unable_to_verify' ? 'failed' : 'in_progress';
  return {
    transition: {
      tenantId,
      loanId: body.loanId,
      stepCode: 'INCOME_EMPLOYMENT',
      status,
      metadata: {
        vendorCallId: body.vendorCallId,
        employmentStatus: body.employmentStatus,
        incomeStreams: body.incomeStreams,
      },
      reason:
        body.employmentStatus === 'unable_to_verify'
          ? 'Vendor unable to verify employment automatically'
          : undefined,
    },
    events: [
      {
        name: 'verification.completed',
        payload: {
          tenantId,
          loanId: body.loanId,
          vendor: 'income_employment',
          vendorCallId: body.vendorCallId,
          employmentStatus: body.employmentStatus,
          incomeStreams: body.incomeStreams,
        },
      },
    ],
  };
}
