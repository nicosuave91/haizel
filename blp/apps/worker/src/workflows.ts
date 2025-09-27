import { ApplicationFailure, proxyActivities, sleep as workflowSleep } from '@temporalio/workflow';
import type {
  EsignEnvelopeInput,
  EsignEnvelopeResult,
  EsignWebhookInput,
  LockLifecycleInput,
  LockLifecycleResult,
  TridComplianceInput,
  TridComplianceResult,
} from './activities';

type ActivityProxy = {
  validateTridCompliance(input: TridComplianceInput): Promise<TridComplianceResult>;
  createEsignEnvelope(input: EsignEnvelopeInput): Promise<EsignEnvelopeResult>;
  fetchEsignEnvelope(envelopeId: string): Promise<EsignEnvelopeResult | undefined>;
  recordEsignWebhook(input: EsignWebhookInput): Promise<EsignEnvelopeResult>;
  upsertLockState(input: LockLifecycleInput): Promise<LockLifecycleResult>;
  readLockState(lockId: string): Promise<LockLifecycleResult | undefined>;
};

function fallbackProxy(): ActivityProxy {
  return {
    validateTridCompliance: async (input) =>
      (await import('./activities')).validateTridCompliance(input),
    createEsignEnvelope: async (input) =>
      (await import('./activities')).createEsignEnvelope(input),
    fetchEsignEnvelope: async (envelopeId) =>
      (await import('./activities')).fetchEsignEnvelope(envelopeId),
    recordEsignWebhook: async (input) =>
      (await import('./activities')).recordEsignWebhook(input),
    upsertLockState: async (input) =>
      (await import('./activities')).upsertLockState(input),
    readLockState: async (lockId) => (await import('./activities')).readLockState(lockId),
  };
}

function inWorkflowRuntime(): boolean {
  return typeof (globalThis as { __TEMPORAL__?: unknown }).__TEMPORAL__ !== 'undefined';
}

function createProxy(): ActivityProxy {
  if (!inWorkflowRuntime()) {
    return fallbackProxy();
  }

  try {
    return proxyActivities<ActivityProxy>({
      startToCloseTimeout: '30 seconds',
    });
  } catch (error) {
    return fallbackProxy();
  }
}

export const activities: ActivityProxy = createProxy();

async function safeSleep(ms: number): Promise<void> {
  if (ms <= 0) {
    return;
  }
  try {
    await workflowSleep(ms);
  } catch (error) {
    if (error instanceof Error && /Workflow\.sleep/.test(error.message)) {
      await new Promise((resolve) => setTimeout(resolve, ms));
      return;
    }
    throw error;
  }
}

export interface TridWorkflowInput extends TridComplianceInput {
  loanId: string;
}

export function ensureTridCompliant(result: TridComplianceResult): TridComplianceResult {
  if (!result.compliant) {
    const message = result.message ?? 'TRID compliance failed';
    throw ApplicationFailure.nonRetryable(message, 'TRID_COMPLIANCE');
  }
  return result;
}

export async function tridWorkflow(input: TridWorkflowInput): Promise<TridComplianceResult> {
  const result = await activities.validateTridCompliance(input);
  return ensureTridCompliant(result);
}

export interface EsignWorkflowInput extends EsignEnvelopeInput {
  waitForCompletion?: boolean;
  pollIntervalMs?: number;
  completionTimeoutMs?: number;
}

export function ensureEnvelopePersisted(
  envelopeId: string,
  persisted?: EsignEnvelopeResult,
): EsignEnvelopeResult {
  if (!persisted) {
    throw ApplicationFailure.nonRetryable('Envelope not found after creation');
  }
  return persisted;
}

export async function esignWorkflow(input: EsignWorkflowInput): Promise<EsignEnvelopeResult> {
  const envelope = await activities.createEsignEnvelope(input);

  if (input.waitForCompletion) {
    const pollInterval = input.pollIntervalMs ?? 5_000;
    const timeoutAt = input.completionTimeoutMs
      ? Date.now() + input.completionTimeoutMs
      : undefined;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const persisted = await activities.fetchEsignEnvelope(envelope.envelopeId);
      const ensured = ensureEnvelopePersisted(envelope.envelopeId, persisted);

      if (ensured.status === 'COMPLETED' || ensured.status === 'DECLINED' || ensured.status === 'VOIDED') {
        return ensured;
      }

      if (timeoutAt && Date.now() >= timeoutAt) {
        throw ApplicationFailure.nonRetryable('Envelope completion timed out', 'ESIGN_TIMEOUT');
      }

      await safeSleep(pollInterval);
    }
  }

  return envelope;
}

export interface LockWorkflowInput extends LockLifecycleInput {
  pollIntervalMs?: number;
}

export function ensureLockActive(state: LockLifecycleResult): LockLifecycleResult {
  if (state.status === 'REPRICE_REQUIRED' || state.status === 'EXPIRED') {
    throw ApplicationFailure.nonRetryable(`Lock ${state.lockId} is ${state.status}`);
  }
  return state;
}

export async function lockLifecycleWorkflow(input: LockWorkflowInput): Promise<LockLifecycleResult> {
  let state = await activities.upsertLockState(input);
  ensureLockActive(state);

  const pollInterval = input.pollIntervalMs ?? 0;
  if (pollInterval <= 0) {
    return state;
  }

  while (state.status === 'ACTIVE') {
    const now = Date.now();
    const millisUntilExpiry = state.expiresAt.getTime() - now;

    if (millisUntilExpiry <= 0) {
      state = await activities.upsertLockState({ ...input, expiresAt: state.expiresAt });
      break;
    }

    await safeSleep(Math.min(pollInterval, millisUntilExpiry));

    const latest = await activities.readLockState(state.lockId);
    if (!latest) {
      throw ApplicationFailure.nonRetryable(`Lock ${state.lockId} not found during lifecycle tracking`);
    }

    if (latest.status !== 'ACTIVE') {
      state = latest;
      break;
    }

    state = latest;
  }

  return state;
}
