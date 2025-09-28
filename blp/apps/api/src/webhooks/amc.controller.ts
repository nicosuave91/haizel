import { VendorEventEmitter } from '../providers/base';
import {
  DocumentAttachmentService,
  NormalizedWebhookEvent,
  VendorWebhookController,
  WorkflowTransitioner,
} from './common';
import { VerifiedWebhook, WebhookVerifier } from './security';

export interface AmcWebhookPayload {
  loanId: string;
  orderId: string;
  status: 'ordered' | 'in_review' | 'delivered';
  eta?: string;
  documents?: Array<{
    code: string;
    url: string;
    checksum?: string;
    version?: number;
    title?: string;
  }>;
}

export function createAmcWebhookController(
  verifier: WebhookVerifier,
  emitter: VendorEventEmitter,
  transitioner: WorkflowTransitioner,
  attachments: DocumentAttachmentService,
): VendorWebhookController<AmcWebhookPayload> {
  return new VendorWebhookController<AmcWebhookPayload>({
    verifier,
    emitter,
    transitioner,
    attachments,
    normalize: async (webhook) => normalizeAmcPayload(webhook),
  });
}

async function normalizeAmcPayload(webhook: VerifiedWebhook<AmcWebhookPayload>): Promise<NormalizedWebhookEvent> {
  const { body, tenantId } = webhook;
  const documents = (body.documents ?? []).map((doc) => ({
    code: doc.code ?? 'APPRAISAL_REPORT',
    url: doc.url,
    checksum: doc.checksum,
    version: doc.version,
    title: doc.title ?? 'Appraisal Report',
  }));

  const status = body.status === 'delivered' ? 'complete' : body.status === 'in_review' ? 'in_progress' : 'in_progress';

  return {
    transition: {
      tenantId,
      loanId: body.loanId,
      stepCode: 'APPRAISAL',
      status,
      metadata: {
        orderId: body.orderId,
        eta: body.eta,
      },
    },
    documents,
    events: [
      {
        name: 'order.status.changed',
        payload: {
          tenantId,
          loanId: body.loanId,
          vendor: 'amc',
          orderId: body.orderId,
          status: body.status,
          eta: body.eta,
        },
      },
    ],
  };
}
