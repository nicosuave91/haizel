import { VendorEventEmitter } from '../providers/base';
import {
  DocumentAttachmentService,
  NormalizedWebhookEvent,
  VendorWebhookController,
  WorkflowTransitioner,
} from './common';
import { VerifiedWebhook, WebhookVerifier } from './security';

export interface EsignWebhookPayload {
  loanId: string;
  envelopeId: string;
  status: 'created' | 'sent' | 'completed' | 'declined';
  completedDocuments?: Array<{ code: string; url: string; checksum?: string }>;
}

export function createEsignWebhookController(
  verifier: WebhookVerifier,
  emitter: VendorEventEmitter,
  transitioner: WorkflowTransitioner,
  attachments: DocumentAttachmentService,
): VendorWebhookController<EsignWebhookPayload> {
  return new VendorWebhookController<EsignWebhookPayload>({
    verifier,
    emitter,
    transitioner,
    attachments,
    normalize: async (webhook) => normalizeEsignPayload(webhook),
  });
}

async function normalizeEsignPayload(
  webhook: VerifiedWebhook<EsignWebhookPayload>,
): Promise<NormalizedWebhookEvent> {
  const { tenantId, body } = webhook;
  let status: 'complete' | 'failed' | 'in_progress' = 'in_progress';
  if (body.status === 'completed') {
    status = 'complete';
  } else if (body.status === 'declined') {
    status = 'failed';
  }

  return {
    transition: {
      tenantId,
      loanId: body.loanId,
      stepCode: 'DISCLOSURES',
      status,
      metadata: {
        envelopeId: body.envelopeId,
        status: body.status,
      },
      reason: body.status === 'declined' ? 'Signer declined the envelope' : undefined,
    },
    documents: (body.completedDocuments ?? []).map((doc) => ({
      code: doc.code,
      url: doc.url,
      checksum: doc.checksum,
      title: 'Executed Disclosure',
    })),
    events: [
      {
        name: 'order.status.changed',
        payload: {
          tenantId,
          loanId: body.loanId,
          vendor: 'esign',
          envelopeId: body.envelopeId,
          status: body.status,
        },
      },
    ],
  };
}
