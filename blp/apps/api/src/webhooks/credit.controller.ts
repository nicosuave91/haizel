import { VendorEventEmitter } from '../providers/base';
import {
  DocumentAttachmentService,
  NormalizedWebhookEvent,
  VendorWebhookController,
  WorkflowTransitioner,
} from './common';
import { VerifiedWebhook, WebhookVerifier } from './security';

export interface CreditWebhookPayload {
  loanId: string;
  vendorCallId: string;
  summary: {
    fico: number;
    inquiries: number;
    tradelines: number;
  };
  documents: Array<{
    bureau: 'equifax' | 'experian' | 'transunion';
    url: string;
    checksum?: string;
  }>;
}

export function createCreditWebhookController(
  verifier: WebhookVerifier,
  emitter: VendorEventEmitter,
  transitioner: WorkflowTransitioner,
  attachments: DocumentAttachmentService,
): VendorWebhookController<CreditWebhookPayload> {
  return new VendorWebhookController<CreditWebhookPayload>({
    verifier,
    emitter,
    transitioner,
    attachments,
    normalize: async (webhook) => normalizeCreditPayload(webhook),
  });
}

async function normalizeCreditPayload(
  webhook: VerifiedWebhook<CreditWebhookPayload>,
): Promise<NormalizedWebhookEvent> {
  const { tenantId, body } = webhook;
  return {
    transition: {
      tenantId,
      loanId: body.loanId,
      stepCode: 'CREDIT',
      status: 'complete',
      metadata: {
        vendorCallId: body.vendorCallId,
        fico: body.summary.fico,
      },
    },
    documents: body.documents.map((doc) => ({
      code: `TRI_MERGE_${doc.bureau.toUpperCase()}`,
      url: doc.url,
      checksum: doc.checksum,
      title: `${doc.bureau.toUpperCase()} credit file`,
    })),
    events: [
      {
        name: 'verification.completed',
        payload: {
          tenantId,
          loanId: body.loanId,
          vendor: 'credit',
          vendorCallId: body.vendorCallId,
          summary: body.summary,
        },
      },
    ],
  };
}
