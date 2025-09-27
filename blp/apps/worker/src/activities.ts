export interface TridComplianceInput {
  disclosureDelivered: boolean;
  waitingPeriodDays: number;
  borrowerAcknowledged: boolean;
}

export interface TridComplianceResult {
  compliant: boolean;
  message?: string;
}

export interface EsignEnvelopeInput {
  envelopeId: string;
  participants: Array<{ name: string; email: string }>;
  documentUrl: string;
}

export interface EsignEnvelopeResult {
  envelopeId: string;
  sent: boolean;
  recipients: Array<{ name: string; email: string }>;
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
}

const inMemoryEnvelopes = new Map<string, EsignEnvelopeResult>();
const lockStore = new Map<string, LockLifecycleResult>();

export async function validateTridCompliance(
  input: TridComplianceInput,
): Promise<TridComplianceResult> {
  if (!input.disclosureDelivered) {
    return { compliant: false, message: 'Closing disclosure not delivered' };
  }

  if (input.waitingPeriodDays < 3) {
    return { compliant: false, message: 'Mandatory waiting period not satisfied' };
  }

  if (!input.borrowerAcknowledged) {
    return { compliant: false, message: 'Borrower acknowledgement missing' };
  }

  return { compliant: true };
}

export async function createEsignEnvelope(
  input: EsignEnvelopeInput,
): Promise<EsignEnvelopeResult> {
  const envelope: EsignEnvelopeResult = {
    envelopeId: input.envelopeId,
    sent: true,
    recipients: input.participants,
  };
  inMemoryEnvelopes.set(envelope.envelopeId, envelope);
  return envelope;
}

export async function fetchEsignEnvelope(envelopeId: string): Promise<EsignEnvelopeResult | undefined> {
  return inMemoryEnvelopes.get(envelopeId);
}

export async function upsertLockState(input: LockLifecycleInput): Promise<LockLifecycleResult> {
  let status: LockLifecycleResult['status'] = 'ACTIVE';

  if (input.expiresAt.getTime() < Date.now()) {
    status = 'EXPIRED';
  } else if (input.repriceRequired) {
    status = 'REPRICE_REQUIRED';
  }

  const result: LockLifecycleResult = {
    lockId: input.lockId,
    status,
    expiresAt: input.expiresAt,
  };
  lockStore.set(result.lockId, result);
  return result;
}

export async function readLockState(lockId: string): Promise<LockLifecycleResult | undefined> {
  return lockStore.get(lockId);
}
