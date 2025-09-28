import { VendorEventEmitter } from '../providers/base';
import {
  DocumentAttachmentService,
  NormalizedWebhookEvent,
  VendorWebhookController,
  WorkflowTransitioner,
} from './common';
import { VerifiedWebhook, WebhookVerifier } from './security';

export interface AusWebhookPayload {
  loanId: string;
  submissionId: string;
  decision: 'APPROVED_ELIGIBLE' | 'REFER_WITH_CAUTION' | 'OUT_OF_SCOPE';
  findingsUrl?: string;
  checksum?: string;
  conditions: Array<{
    code: string;
    description: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
  }>;
}

export function createAusWebhookController(
  verifier: WebhookVerifier,
  emitter: VendorEventEmitter,
  transitioner: WorkflowTransitioner,
  attachments: DocumentAttachmentService,
): VendorWebhookController<AusWebhookPayload> {
  return new VendorWebhookController<AusWebhookPayload>({
    verifier,
    emitter,
    transitioner,
    attachments,
    normalize: async (webhook) => normalizeAusPayload(webhook),
  });
}

async function normalizeAusPayload(
  webhook: VerifiedWebhook<AusWebhookPayload>,
): Promise<NormalizedWebhookEvent> {
  const { tenantId, body } = webhook;
  const status = body.decision === 'APPROVED_ELIGIBLE' ? 'complete' : 'in_progress';
  return {
    transition: {
      tenantId,
      loanId: body.loanId,
      stepCode: 'AUS',
      status,
      metadata: {
        submissionId: body.submissionId,
        decision: body.decision,
        conditions: body.conditions,
      },
      reason: body.decision === 'REFER_WITH_CAUTION' ? 'AUS returned cautionary findings' : undefined,
    },
    documents: body.findingsUrl
      ? [
          {
            code: 'AUS_FINDINGS',
            url: body.findingsUrl,
            checksum: body.checksum,
            title: 'AUS Findings',
          },
        ]
      : [],
    events: [
      {
        name: 'aus.findings.available',
        payload: {
          tenantId,
          loanId: body.loanId,
          vendor: 'aus',
          submissionId: body.submissionId,
          decision: body.decision,
          conditions: body.conditions,
        },
      },
    ],
  };
}
