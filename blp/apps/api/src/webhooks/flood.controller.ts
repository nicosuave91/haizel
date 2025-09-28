import { VendorEventEmitter } from '../providers/base';
import {
  DocumentAttachmentService,
  NormalizedWebhookEvent,
  VendorWebhookController,
  WorkflowTransitioner,
} from './common';
import { VerifiedWebhook, WebhookVerifier } from './security';

export interface FloodWebhookPayload {
  loanId: string;
  determination: 'zone_a' | 'zone_x' | 'zone_unknown';
  reportUrl: string;
  checksum?: string;
}

export function createFloodWebhookController(
  verifier: WebhookVerifier,
  emitter: VendorEventEmitter,
  transitioner: WorkflowTransitioner,
  attachments: DocumentAttachmentService,
): VendorWebhookController<FloodWebhookPayload> {
  return new VendorWebhookController<FloodWebhookPayload>({
    verifier,
    emitter,
    transitioner,
    attachments,
    normalize: async (webhook) => normalizeFloodPayload(webhook),
  });
}

async function normalizeFloodPayload(
  webhook: VerifiedWebhook<FloodWebhookPayload>,
): Promise<NormalizedWebhookEvent> {
  const { tenantId, body } = webhook;
  return {
    transition: {
      tenantId,
      loanId: body.loanId,
      stepCode: 'FLOOD',
      status: 'complete',
      metadata: {
        determination: body.determination,
      },
    },
    documents: [
      {
        code: 'FLOOD_DETERMINATION',
        url: body.reportUrl,
        checksum: body.checksum,
        title: 'Flood Determination',
        version: 1,
      },
    ],
    events: [
      {
        name: 'order.status.changed',
        payload: {
          tenantId,
          loanId: body.loanId,
          vendor: 'flood',
          status: 'delivered',
          determination: body.determination,
          reportUrl: body.reportUrl,
        },
      },
    ],
  };
}
