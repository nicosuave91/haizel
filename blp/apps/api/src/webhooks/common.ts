import { VendorEventEmitter, VendorEventName } from '../providers/base';
import { RawWebhookRequest, VerifiedWebhook, WebhookVerifier } from './security';

export interface WorkflowTransitionInput {
  tenantId: string;
  loanId: string;
  stepCode: string;
  status: 'complete' | 'failed' | 'in_progress';
  reason?: string;
  metadata?: Record<string, unknown>;
  attachments?: DocumentAttachment[];
}

export interface DocumentAttachment {
  code: string;
  url: string;
  checksum?: string;
  version?: number;
  redacted?: boolean;
  title?: string;
}

export interface WorkflowTransitioner {
  transition(input: WorkflowTransitionInput): Promise<void>;
}

export interface DocumentAttachmentService {
  attach(tenantId: string, loanId: string, attachment: DocumentAttachment): Promise<void>;
}

export class NoopWorkflowTransitioner implements WorkflowTransitioner {
  async transition(): Promise<void> {
    // noop transition for local development
  }
}

export class NoopDocumentAttachmentService implements DocumentAttachmentService {
  async attach(): Promise<void> {
    // noop attachment handler
  }
}

export interface VendorWebhookHandlerOptions<TBody> {
  verifier: WebhookVerifier;
  emitter: VendorEventEmitter;
  transitioner?: WorkflowTransitioner;
  attachments?: DocumentAttachmentService;
  normalize: (payload: VerifiedWebhook<TBody>) => Promise<NormalizedWebhookEvent>;
}

export interface NormalizedWebhookEvent {
  transition?: WorkflowTransitionInput;
  documents?: DocumentAttachment[];
  events?: Array<{ name: VendorEventName; payload: Record<string, unknown> }>;
}

export class VendorWebhookController<TBody = any> {
  private readonly transitioner: WorkflowTransitioner;
  private readonly attachments: DocumentAttachmentService;

  constructor(private readonly options: VendorWebhookHandlerOptions<TBody>) {
    this.transitioner = options.transitioner ?? new NoopWorkflowTransitioner();
    this.attachments = options.attachments ?? new NoopDocumentAttachmentService();
  }

  async handle(request: RawWebhookRequest): Promise<{ status: 'accepted' }> {
    const verified = await this.options.verifier.verify<TBody>(request);
    const normalized = await this.options.normalize(verified);

    if (normalized.documents) {
      await Promise.all(
        normalized.documents.map((doc) =>
          this.attachments.attach(verified.tenantId, (verified.body as any).loanId ?? '', doc),
        ),
      );
    }

    if (normalized.transition) {
      await this.transitioner.transition({
        ...normalized.transition,
        tenantId: verified.tenantId,
      });
    }

    if (normalized.events) {
      await Promise.all(
        normalized.events.map((event) => this.options.emitter.emit(event.name, event.payload)),
      );
    }

    return { status: 'accepted' };
  }
}
