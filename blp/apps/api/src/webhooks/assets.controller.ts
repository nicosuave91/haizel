import { VendorEventEmitter } from '../providers/base';
import {
  DocumentAttachmentService,
  NormalizedWebhookEvent,
  VendorWebhookController,
  WorkflowTransitioner,
} from './common';
import { VerifiedWebhook, WebhookVerifier } from './security';

export interface AssetsWebhookPayload {
  loanId: string;
  vendorCallId: string;
  accounts: Array<{
    institution: string;
    accountType: string;
    currentBalanceCents: number;
    statements: Array<{ url: string; checksum?: string; month?: string }>;
  }>;
}

export function createAssetsWebhookController(
  verifier: WebhookVerifier,
  emitter: VendorEventEmitter,
  transitioner: WorkflowTransitioner,
  attachments: DocumentAttachmentService,
): VendorWebhookController<AssetsWebhookPayload> {
  return new VendorWebhookController<AssetsWebhookPayload>({
    verifier,
    emitter,
    transitioner,
    attachments,
    normalize: async (webhook) => normalizeAssetsPayload(webhook),
  });
}

async function normalizeAssetsPayload(
  webhook: VerifiedWebhook<AssetsWebhookPayload>,
): Promise<NormalizedWebhookEvent> {
  const { tenantId, body } = webhook;
  const documents = body.accounts.flatMap((account) =>
    account.statements.map((statement, statementIndex) => ({
      code: 'ASSET_STATEMENT',
      url: statement.url,
      checksum: statement.checksum,
      title: `${account.institution} ${account.accountType} statement`,
      version: statementIndex + 1,
    })),
  );

  return {
    transition: {
      tenantId,
      loanId: body.loanId,
      stepCode: 'ASSETS',
      status: 'complete',
      metadata: {
        vendorCallId: body.vendorCallId,
        accountCount: body.accounts.length,
      },
    },
    documents,
    events: [
      {
        name: 'verification.completed',
        payload: {
          tenantId,
          loanId: body.loanId,
          vendor: 'assets',
          vendorCallId: body.vendorCallId,
          accountCount: body.accounts.length,
        },
      },
    ],
  };
}
