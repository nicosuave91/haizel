/* eslint-disable @typescript-eslint/no-unused-vars */
import { condition, proxyActivities, setHandler, workflowInfo } from '@temporalio/workflow';
import { ComplianceIssue, StepCode, WorkflowStepContract } from '@haizel/domain';

type HaizelActivities = {
  runPreflightChecks(input: StepExecutionContext): Promise<StepResult>;
  initializeWorkflow(input: StepExecutionContext): Promise<WorkflowStepContract[]>;
  startCreditVerification(input: StepExecutionContext): Promise<StepResult>;
  startIncomeVerification(input: StepExecutionContext): Promise<StepResult>;
  startAssetVerification(input: StepExecutionContext): Promise<StepResult>;
  orderAppraisal(input: StepExecutionContext): Promise<StepResult>;
  orderFlood(input: StepExecutionContext): Promise<StepResult>;
  requestMiQuote(input: StepExecutionContext): Promise<StepResult>;
  submitAus(input: StepExecutionContext): Promise<AUSResult>;
  openTitle(input: StepExecutionContext): Promise<StepResult>;
  recordTitleCurative(input: StepExecutionContext & { tasks: CurativeTask[] }): Promise<StepResult>;
  generateDisclosures(input: StepExecutionContext): Promise<StepResult>;
  sendDisclosuresForESign(input: StepExecutionContext): Promise<StepResult>;
  generateClosingPackage(input: StepExecutionContext): Promise<StepResult>;
  sendClosingPackage(input: StepExecutionContext): Promise<StepResult>;
  evaluateCTC(input: StepExecutionContext): Promise<CTCResult>;
  closeLoan(input: StepExecutionContext): Promise<StepResult>;
  waitForEvent(topic: string, correlationId: string): Promise<void>;
};

const activities = proxyActivities<HaizelActivities>({
  startToCloseTimeout: '10 minutes',
  scheduleToCloseTimeout: '1 hour',
});

export interface StepExecutionContext {
  tenantId: string;
  loanId: string;
  stepCode: StepCode;
  correlationId: string;
}

export interface StepResult {
  status: 'complete' | 'blocked' | 'failed' | 'in_progress';
  evidenceRefs?: Array<{ docId?: string; vendorCallId?: string; note?: string }>;
  issues?: ComplianceIssue[];
}

export interface AUSResult extends StepResult {
  ausDecision?: 'APPROVED_ELIGIBLE' | 'REFER_WITH_CAUTION' | 'OUT_OF_SCOPE';
}

export interface CurativeTask {
  code: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'open' | 'waived' | 'met';
}

export interface CTCResult extends StepResult {
  passed: boolean;
  remainingConditions?: string[];
}

export interface HaizelWorkflowInput {
  tenantId: string;
  loanId: string;
  correlationId?: string;
}

export const unblockSignal = 'unblock';
export const compensateSignal = 'compensate';

export async function haizelLoanWorkflow(input: HaizelWorkflowInput): Promise<void> {
  const correlationId = input.correlationId ?? workflowInfo().workflowId;
  const ctx: StepExecutionContext = {
    tenantId: input.tenantId,
    loanId: input.loanId,
    correlationId,
    stepCode: 'CREDIT', // placeholder, overwritten per step
  };

  await preflightStage({ ...ctx, stepCode: 'CREDIT' });
  await verificationStage(ctx);
  await propertyAndRiskStage(ctx);
  await ausStage(ctx);
  await titleStage(ctx);
  await disclosuresStage(ctx);
  await closingStage(ctx);
}

async function preflightStage(ctx: StepExecutionContext): Promise<void> {
  const preflightResult = await activities.runPreflightChecks({ ...ctx, stepCode: 'CREDIT' });
  if (preflightResult.status === 'blocked') {
    await waitForUnblock();
  }

  await activities.initializeWorkflow({ ...ctx, stepCode: 'CREDIT' });
}

async function verificationStage(ctx: StepExecutionContext): Promise<void> {
  await executeStep('CREDIT', activities.startCreditVerification, ctx, () =>
    activities.waitForEvent('verification.completed.credit', ctx.correlationId),
  );
  await executeStep('INCOME_EMPLOYMENT', activities.startIncomeVerification, ctx, () =>
    activities.waitForEvent('verification.completed.income', ctx.correlationId),
  );
  await executeStep('ASSETS', activities.startAssetVerification, ctx, () =>
    activities.waitForEvent('verification.completed.assets', ctx.correlationId),
  );
}

async function propertyAndRiskStage(ctx: StepExecutionContext): Promise<void> {
  await executeStep('APPRAISAL', activities.orderAppraisal, ctx, () =>
    activities.waitForEvent('order.status.changed.appraisal', ctx.correlationId),
  );
  await executeStep('FLOOD', activities.orderFlood, ctx, () =>
    activities.waitForEvent('order.status.changed.flood', ctx.correlationId),
  );
  await executeStep('MI', activities.requestMiQuote, ctx, () =>
    activities.waitForEvent('order.status.changed.mi', ctx.correlationId),
  );
}

async function ausStage(ctx: StepExecutionContext): Promise<void> {
  const result = await executeStep<AUSResult>('AUS', activities.submitAus, ctx);
  if (result?.ausDecision === 'REFER_WITH_CAUTION') {
    await waitForUnblock();
  }
}

async function titleStage(ctx: StepExecutionContext): Promise<void> {
  await executeStep('TITLE', activities.openTitle, ctx, () =>
    activities.waitForEvent('order.status.changed.title', ctx.correlationId),
  );
  // Curative handling would be triggered by external events; skeleton intentionally minimal.
}

async function disclosuresStage(ctx: StepExecutionContext): Promise<void> {
  await executeStep('DISCLOSURES', activities.generateDisclosures, ctx);
  await executeStep('DISCLOSURES', activities.sendDisclosuresForESign, ctx, () =>
    activities.waitForEvent('disclosures.completed', ctx.correlationId),
  );
  await executeStep('CLOSING', activities.generateClosingPackage, ctx);
  await executeStep('CLOSING', activities.sendClosingPackage, ctx, () =>
    activities.waitForEvent('loan.closed.prep', ctx.correlationId),
  );
}

async function closingStage(ctx: StepExecutionContext): Promise<void> {
  const ctcResult = await activities.evaluateCTC({ ...ctx, stepCode: 'CLOSING' });
  if (!ctcResult.passed) {
    await waitForUnblock();
  }
  await activities.closeLoan({ ...ctx, stepCode: 'CLOSING' });
}

async function executeStep<T extends StepResult>(
  stepCode: StepCode,
  activity: (input: StepExecutionContext) => Promise<T>,
  baseCtx: StepExecutionContext,
  waitForCompletion?: () => Promise<void>,
): Promise<T | undefined> {
  const ctx = { ...baseCtx, stepCode };
  const result = await activity(ctx);

  if (result.status === 'blocked') {
    await waitForUnblock();
  } else if (result.status === 'failed') {
    await waitForCompensation();
  }

  if (waitForCompletion) {
    await waitForCompletion();
  }

  return result;
}

async function waitForUnblock(): Promise<void> {
  let resolved = false;
  setHandler(unblockSignal, () => {
    resolved = true;
  });
  await condition(() => resolved);
}

async function waitForCompensation(): Promise<void> {
  let compensated = false;
  setHandler(compensateSignal, () => {
    compensated = true;
  });
  await condition(() => compensated);
}
