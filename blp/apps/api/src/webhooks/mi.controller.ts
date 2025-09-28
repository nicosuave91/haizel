import { VendorEventEmitter } from '../providers/base';
import {
  NormalizedWebhookEvent,
  VendorWebhookController,
  WorkflowTransitioner,
} from './common';
import { VerifiedWebhook, WebhookVerifier } from './security';

export interface MiWebhookPayload {
  loanId: string;
  quoteId: string;
  premiumCents: number;
  status: 'issued' | 'pending' | 'declined';
}

export function createMiWebhookController(
  verifier: WebhookVerifier,
  emitter: VendorEventEmitter,
  transitioner: WorkflowTransitioner,
): VendorWebhookController<MiWebhookPayload> {
  return new VendorWebhookController<MiWebhookPayload>({
    verifier,
    emitter,
    transitioner,
    normalize: async (webhook) => normalizeMiPayload(webhook),
  });
}

async function normalizeMiPayload(
  webhook: VerifiedWebhook<MiWebhookPayload>,
): Promise<NormalizedWebhookEvent> {
  const { tenantId, body } = webhook;
  const status = body.status === 'issued' ? 'complete' : body.status === 'declined' ? 'failed' : 'in_progress';
  return {
    transition: {
      tenantId,
      loanId: body.loanId,
      stepCode: 'MI',
      status,
      metadata: {
        quoteId: body.quoteId,
        premiumCents: body.premiumCents,
      },
      reason: body.status === 'declined' ? 'Vendor declined MI quote' : undefined,
    },
    events: [
      {
        name: 'order.status.changed',
        payload: {
          tenantId,
          loanId: body.loanId,
          vendor: 'mi',
          quoteId: body.quoteId,
          status: body.status,
        },
      },
    ],
  };
}
