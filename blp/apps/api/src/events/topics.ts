import { StepCode, WorkflowStepStatus } from '@haizel/domain';

export interface BaseEvent {
  id: string;
  tenantId: string;
  loanId: string;
  correlationId: string;
  occurredAt: string;
}

export interface LoanCreatedEvent extends BaseEvent {
  type: 'loan.created';
  payload: {
    fileNo: string;
    ownerUserId: string;
    status: string;
  };
}

export interface WorkflowStepUpdatedEvent extends BaseEvent {
  type: 'workflow.step.updated';
  payload: {
    stepCode: StepCode;
    fromStatus: WorkflowStepStatus;
    toStatus: WorkflowStepStatus;
    evidenceRefs?: Array<{ docId?: string; vendorCallId?: string; note?: string }>;
  };
}

export interface VerificationCompletedEvent extends BaseEvent {
  type: 'verification.completed';
  payload: {
    channel: 'credit' | 'income' | 'employment' | 'assets';
    vendorCallId: string;
  };
}

export interface OrderStatusChangedEvent extends BaseEvent {
  type: 'order.status.changed';
  payload: {
    channel: 'appraisal' | 'flood' | 'mi' | 'title';
    status: string;
    vendorCallId: string;
  };
}

export interface AusFindingsAvailableEvent extends BaseEvent {
  type: 'aus.findings.available';
  payload: {
    decision: string;
    conditionCodes: string[];
  };
}

export interface ConditionsChangedEvent extends BaseEvent {
  type: 'conditions.changed';
  payload: {
    open: number;
    met: number;
    waived: number;
  };
}

export interface DisclosureEvent extends BaseEvent {
  type: 'disclosures.sent' | 'disclosures.completed';
  payload: {
    envelopeId: string;
    status: string;
  };
}

export interface CtcEvent extends BaseEvent {
  type: 'ctc.granted' | 'loan.closed';
  payload: {
    manifestStatus: string;
    outstandingConditions: number;
  };
}

export interface ComplianceViolationEvent extends BaseEvent {
  type: 'compliance.violation';
  payload: {
    stage: string;
    issues: Array<{ code: string; severity: string; message: string }>;
  };
}

export type HaizelOutboxEvent =
  | LoanCreatedEvent
  | WorkflowStepUpdatedEvent
  | VerificationCompletedEvent
  | OrderStatusChangedEvent
  | AusFindingsAvailableEvent
  | ConditionsChangedEvent
  | DisclosureEvent
  | CtcEvent
  | ComplianceViolationEvent;
