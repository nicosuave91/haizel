export type StepCode =
  | 'CREDIT'
  | 'INCOME_EMPLOYMENT'
  | 'ASSETS'
  | 'APPRAISAL'
  | 'TITLE'
  | 'FLOOD'
  | 'MI'
  | 'DISCLOSURES'
  | 'AUS'
  | 'CLOSING';

export type WorkflowStepStatus =
  | 'pending'
  | 'blocked'
  | 'in_progress'
  | 'complete'
  | 'failed'
  | 'waived';

export interface WorkflowEvidenceRef {
  docId?: string;
  vendorCallId?: string;
  note?: string;
}

export interface WorkflowTimestamps {
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface WorkflowStepContract {
  id: string;
  loanId: string;
  code: StepCode;
  title: string;
  required: boolean;
  ownerRole: 'LO' | 'PROCESSOR' | 'CLOSER' | 'TITLE' | 'SYSTEM';
  status: WorkflowStepStatus;
  preconditions: string[];
  dueAt?: string;
  slaSeconds?: number;
  blockedReason?: string;
  evidenceRefs: WorkflowEvidenceRef[];
  timestamps: WorkflowTimestamps;
}

export interface ConditionSummary {
  code: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'open' | 'waived' | 'met';
}

export interface ComplianceIssue {
  code: string;
  severity: 'info' | 'warning' | 'blocker';
  message: string;
  remediation?: string;
}

export type ComplianceStage =
  | 'PRE_FLIGHT'
  | 'PRE_VENDOR_CALL'
  | 'PRE_DISCLOSURE'
  | 'AUS'
  | 'CTC'
  | 'CLOSING';
