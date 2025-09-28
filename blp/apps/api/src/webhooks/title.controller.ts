import { VendorEventEmitter } from '../providers/base';
import {
  DocumentAttachmentService,
  NormalizedWebhookEvent,
  VendorWebhookController,
  WorkflowTransitioner,
} from './common';
import { VerifiedWebhook, WebhookVerifier } from './security';
import type { TitleCurativeTask } from '../providers/title';

export interface TitleWebhookPayload {
  loanId: string;
  orderId: string;
  status: 'opened' | 'in_curative' | 'clear';
  curativeTasks: TitleCurativeTask[];
  documents?: Array<{
    code: string;
    url: string;
    checksum?: string;
    version?: number;
  }>;
}

export function createTitleWebhookController(
  verifier: WebhookVerifier,
  emitter: VendorEventEmitter,
  transitioner: WorkflowTransitioner,
  attachments: DocumentAttachmentService,
): VendorWebhookController<TitleWebhookPayload> {
  return new VendorWebhookController<TitleWebhookPayload>({
    verifier,
    emitter,
    transitioner,
    attachments,
    normalize: async (webhook) => normalizeTitlePayload(webhook),
  });
}

async function normalizeTitlePayload(
  webhook: VerifiedWebhook<TitleWebhookPayload>,
): Promise<NormalizedWebhookEvent> {
  const { tenantId, body } = webhook;
  return {
    transition: {
      tenantId,
      loanId: body.loanId,
      stepCode: 'TITLE',
      status: body.status === 'clear' ? 'complete' : 'in_progress',
      metadata: {
        orderId: body.orderId,
        outstandingTasks: body.curativeTasks.filter((task) => task.status !== 'met').length,
      },
      reason: body.status === 'in_curative' ? 'Curative tasks outstanding' : undefined,
    },
    documents: (body.documents ?? []).map((doc) => ({
      code: doc.code ?? 'TITLE_COMMITMENT',
      url: doc.url,
      checksum: doc.checksum,
      version: doc.version,
    })),
    events: [
      {
        name: 'order.status.changed',
        payload: {
          tenantId,
          loanId: body.loanId,
          vendor: 'title',
          orderId: body.orderId,
          status: body.status,
        },
      },
    ],
  };
}
