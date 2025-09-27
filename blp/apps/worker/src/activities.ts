export type TridTimelineEvent =
  | { type: 'DISCLOSURE_DELIVERED'; at: Date; redisclosure?: boolean }
  | { type: 'BORROWER_ACKNOWLEDGED'; at: Date }
  | { type: 'MATERIAL_CHANGE'; at: Date; reason: string }
  | { type: 'CLOSING_SCHEDULED'; at: Date; closingDate: Date }
  | { type: 'CLOSING_COMPLETED'; at: Date };

export interface TridComplianceInput {
  disclosureDelivered?: boolean;
  waitingPeriodDays?: number;
  borrowerAcknowledged?: boolean;
  closingDate?: Date;
  timeline?: TridTimelineEvent[];
}

export interface TridComplianceResult {
  compliant: boolean;
  message?: string;
  waitingPeriodDays?: number;
  redisclosureRequired?: boolean;
  redisclosureReason?: string;
  lastDisclosureAt?: Date;
}

export interface EsignParticipant {
  name: string;
  email: string;
  consented?: boolean;
  completedAt?: Date;
}

export interface EsignEnvelopeInput {
  envelopeId: string;
  participants: EsignParticipant[];
  documentUrl: string;
}

export type EsignEnvelopeStatus = 'SENT' | 'COMPLETED' | 'DECLINED' | 'VOIDED';

export interface EsignEnvelopeHistoryEvent {
  status: EsignEnvelopeStatus;
  at: Date;
  participantEmail?: string;
  reason?: string;
}

export interface EsignEnvelopeResult {
  envelopeId: string;
  sent: boolean;
  status: EsignEnvelopeStatus;
  recipients: EsignParticipant[];
  sentAt: Date;
  completedAt?: Date;
  history: EsignEnvelopeHistoryEvent[];
}

export interface EsignWebhookInput {
  envelopeId: string;
  status: EsignEnvelopeStatus;
  participantEmail?: string;
  reason?: string;
  occurredAt: Date;
}

export interface LockLifecycleInput {
  lockId: string;
  expiresAt: Date;
  repriceRequired?: boolean;
}

export interface LockLifecycleResult {
  lockId: string;
  status: 'ACTIVE' | 'EXPIRED' | 'REPRICE_REQUIRED';
  expiresAt: Date;
  updatedAt: Date;
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const inMemoryEnvelopes = new Map<string, EsignEnvelopeResult>();
const lockStore = new Map<string, LockLifecycleResult>();

function sortTimeline(events: TridTimelineEvent[]): TridTimelineEvent[] {
  return [...events].sort((a, b) => a.at.getTime() - b.at.getTime());
}

function closingDateFromTimeline(events: TridTimelineEvent[]): Date | undefined {
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const event = events[i];
    if (event.type === 'CLOSING_COMPLETED') {
      return event.at;
    }
    if (event.type === 'CLOSING_SCHEDULED') {
      return event.closingDate;
    }
  }
  return undefined;
}

export async function validateTridCompliance(
  input: TridComplianceInput,
): Promise<TridComplianceResult> {
  const timeline = input.timeline?.length ? sortTimeline(input.timeline) : undefined;

  if (!timeline) {
    if (!input.disclosureDelivered) {
      return { compliant: false, message: 'Closing disclosure not delivered' };
    }

    if ((input.waitingPeriodDays ?? 0) < 3) {
      return { compliant: false, message: 'Mandatory waiting period not satisfied' };
    }

    if (!input.borrowerAcknowledged) {
      return { compliant: false, message: 'Borrower acknowledgement missing' };
    }

    return { compliant: true, waitingPeriodDays: input.waitingPeriodDays };
  }

  const closingDate = input.closingDate ?? closingDateFromTimeline(timeline);
  if (!closingDate) {
    return { compliant: false, message: 'Closing date not scheduled' };
  }

  let lastDisclosureAt: Date | undefined;
  let borrowerAcknowledged = false;
  let redisclosureReason: string | undefined;
  let pendingRedisclosureSince: Date | undefined;

  for (const event of timeline) {
    if (event.at.getTime() > closingDate.getTime()) {
      break;
    }

    switch (event.type) {
      case 'DISCLOSURE_DELIVERED': {
        lastDisclosureAt = event.at;
        borrowerAcknowledged = false;
        pendingRedisclosureSince = undefined;
        redisclosureReason = undefined;
        break;
      }
      case 'BORROWER_ACKNOWLEDGED': {
        if (lastDisclosureAt && event.at.getTime() >= lastDisclosureAt.getTime()) {
          borrowerAcknowledged = true;
        }
        break;
      }
      case 'MATERIAL_CHANGE': {
        if (!lastDisclosureAt || event.at.getTime() >= lastDisclosureAt.getTime()) {
          pendingRedisclosureSince = event.at;
          redisclosureReason = event.reason;
          borrowerAcknowledged = false;
        }
        break;
      }
      default:
        break;
    }
  }

  if (!lastDisclosureAt) {
    return { compliant: false, message: 'Closing disclosure not delivered' };
  }

  const waitingPeriodMs = closingDate.getTime() - lastDisclosureAt.getTime();
  const waitingPeriodDays = Math.floor(waitingPeriodMs / ONE_DAY_MS);

  if (waitingPeriodDays < 3) {
    return {
      compliant: false,
      message: 'Mandatory waiting period not satisfied',
      waitingPeriodDays,
      lastDisclosureAt,
    };
  }

  if (pendingRedisclosureSince) {
    return {
      compliant: false,
      message: redisclosureReason
        ? `Redisclosure required: ${redisclosureReason}`
        : 'Redisclosure required',
      waitingPeriodDays,
      redisclosureRequired: true,
      redisclosureReason,
      lastDisclosureAt,
    };
  }

  const acknowledged = borrowerAcknowledged || !!input.borrowerAcknowledged;
  if (!acknowledged) {
    return {
      compliant: false,
      message: 'Borrower acknowledgement missing',
      waitingPeriodDays,
      lastDisclosureAt,
    };
  }

  return {
    compliant: true,
    waitingPeriodDays,
    lastDisclosureAt,
  };
}

export async function createEsignEnvelope(
  input: EsignEnvelopeInput,
): Promise<EsignEnvelopeResult> {
  const now = new Date();
  const envelope: EsignEnvelopeResult = {
    envelopeId: input.envelopeId,
    sent: true,
    status: 'SENT',
    recipients: input.participants,
    sentAt: now,
    history: [{ status: 'SENT', at: now }],
  };
  inMemoryEnvelopes.set(envelope.envelopeId, envelope);
  return envelope;
}

export async function recordEsignWebhook(input: EsignWebhookInput): Promise<EsignEnvelopeResult> {
  const existing = inMemoryEnvelopes.get(input.envelopeId);
  if (!existing) {
    throw new Error(`Envelope ${input.envelopeId} not found`);
  }

  const updatedRecipients = existing.recipients.map((recipient) => {
    if (input.participantEmail && recipient.email === input.participantEmail) {
      return {
        ...recipient,
        consented: true,
        completedAt: input.status === 'COMPLETED' ? input.occurredAt : recipient.completedAt,
      };
    }
    return recipient;
  });

  const updated: EsignEnvelopeResult = {
    ...existing,
    sent: existing.sent || input.status !== 'SENT',
    status: input.status,
    completedAt: input.status === 'COMPLETED' ? input.occurredAt : existing.completedAt,
    recipients: updatedRecipients,
    history: [
      ...existing.history,
      {
        status: input.status,
        at: input.occurredAt,
        participantEmail: input.participantEmail,
        reason: input.reason,
      },
    ],
  };

  inMemoryEnvelopes.set(updated.envelopeId, updated);
  return updated;
}

export async function fetchEsignEnvelope(envelopeId: string): Promise<EsignEnvelopeResult | undefined> {
  return inMemoryEnvelopes.get(envelopeId);
}

export async function upsertLockState(input: LockLifecycleInput): Promise<LockLifecycleResult> {
  let status: LockLifecycleResult['status'] = 'ACTIVE';
  const now = Date.now();

  if (input.expiresAt.getTime() <= now) {
    status = 'EXPIRED';
  } else if (input.repriceRequired) {
    status = 'REPRICE_REQUIRED';
  }

  const result: LockLifecycleResult = {
    lockId: input.lockId,
    status,
    expiresAt: input.expiresAt,
    updatedAt: new Date(now),
  };
  lockStore.set(result.lockId, result);
  return result;
}

export async function readLockState(lockId: string): Promise<LockLifecycleResult | undefined> {
  const existing = lockStore.get(lockId);
  if (!existing) {
    return undefined;
  }

  if (existing.status === 'ACTIVE' && existing.expiresAt.getTime() <= Date.now()) {
    const expired: LockLifecycleResult = {
      ...existing,
      status: 'EXPIRED',
      updatedAt: new Date(),
    };
    lockStore.set(lockId, expired);
    return expired;
  }

  return existing;
}
