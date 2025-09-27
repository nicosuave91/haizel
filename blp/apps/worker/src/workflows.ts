import { ApplicationFailure, proxyActivities } from '@temporalio/workflow';
import type {
  EsignEnvelopeInput,
  EsignEnvelopeResult,
  LockLifecycleInput,
  LockLifecycleResult,
  TridComplianceInput,
  TridComplianceResult,
} from './activities';

type ActivityProxy = {
  validateTridCompliance(input: TridComplianceInput): Promise<TridComplianceResult>;
  createEsignEnvelope(input: EsignEnvelopeInput): Promise<EsignEnvelopeResult>;
  fetchEsignEnvelope(envelopeId: string): Promise<EsignEnvelopeResult | undefined>;
  upsertLockState(input: LockLifecycleInput): Promise<LockLifecycleResult>;
  readLockState(lockId: string): Promise<LockLifecycleResult | undefined>;
};

function createProxy(): ActivityProxy {
  try {
    return proxyActivities<ActivityProxy>({
      startToCloseTimeout: '30 seconds',
    });
  } catch (error) {
    // Outside of a Temporal workflow runtime (e.g. unit tests) the proxy
    // creation will throw. Fallback to directly invoking the activity
    // implementations.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fallback = require('./activities') as typeof import('./activities');
    return {
      validateTridCompliance: fallback.validateTridCompliance,
      createEsignEnvelope: fallback.createEsignEnvelope,
      fetchEsignEnvelope: fallback.fetchEsignEnvelope,
      upsertLockState: fallback.upsertLockState,
      readLockState: fallback.readLockState,
    };
  }
}

export const activities: ActivityProxy = createProxy();

export interface TridWorkflowInput extends TridComplianceInput {
  loanId: string;
}

export function ensureTridCompliant(result: TridComplianceResult): TridComplianceResult {
  if (!result.compliant) {
    throw ApplicationFailure.nonRetryable(result.message ?? 'TRID compliance failed');
  }
  return result;
}

export async function tridWorkflow(input: TridWorkflowInput): Promise<TridComplianceResult> {
  const result = await activities.validateTridCompliance(input);
  return ensureTridCompliant(result);
}

export interface EsignWorkflowInput extends EsignEnvelopeInput {
  waitForCompletion?: boolean;
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
    const persisted = await activities.fetchEsignEnvelope(envelope.envelopeId);
    return ensureEnvelopePersisted(envelope.envelopeId, persisted);
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
  const state = await activities.upsertLockState(input);
  return ensureLockActive(state);
}
