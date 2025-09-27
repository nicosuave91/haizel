import React from 'react';
import { useParams } from 'react-router-dom';
import { WorkflowStepCard } from '../../components/WorkflowStepCard';
import { ConditionsList } from '../../components/ConditionsList';
import { DocManifest } from '../../components/DocManifest';
import { CTCEvaluator } from '../../components/CTCEvaluator';
import type { WorkflowStepContract, ConditionSummary, ComplianceIssue } from '@haizel/domain';

const mockSteps: WorkflowStepContract[] = [
  {
    id: 'step-1',
    loanId: 'loan-1',
    code: 'CREDIT',
    title: 'Tri-merge credit',
    required: true,
    ownerRole: 'LO',
    status: 'complete',
    preconditions: [],
    evidenceRefs: [
      {
        vendorCallId: 'call-1',
      },
    ],
    timestamps: {
      createdAt: new Date().toISOString(),
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    },
  },
  {
    id: 'step-2',
    loanId: 'loan-1',
    code: 'INCOME_EMPLOYMENT',
    title: 'Verify income and employment',
    required: true,
    ownerRole: 'PROCESSOR',
    status: 'in_progress',
    preconditions: ['CREDIT'],
    evidenceRefs: [],
    timestamps: {
      createdAt: new Date().toISOString(),
      startedAt: new Date().toISOString(),
    },
  },
];

const mockConditions: ConditionSummary[] = [
  {
    code: 'AUS-VOE-001',
    description: 'Provide written VOE for 24 months',
    severity: 'critical',
    status: 'open',
  },
  {
    code: 'AUS-ASSET-002',
    description: 'Two months bank statements',
    severity: 'medium',
    status: 'open',
  },
];

const mockIssues: ComplianceIssue[] = [
  {
    code: 'CONDITION_OPEN',
    severity: 'blocker',
    message: 'Critical AUS conditions must be satisfied before CTC.',
    remediation: 'Upload VOE documentation or mark with underwriter approval.',
  },
];

const LoanDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  return (
    <main className="loan-detail">
      <header className="loan-detail__header">
        <h1>Loan {id}</h1>
        <div>
          <button type="button">Add note</button>
          <button type="button">Upload document</button>
        </div>
      </header>
      <section className="loan-detail__workflow">
        <h2>Workflow</h2>
        <div className="loan-detail__workflow-grid">
          {mockSteps.map((step) => (
            <WorkflowStepCard key={step.id} step={step} onAction={() => undefined} />
          ))}
        </div>
      </section>
      <section className="loan-detail__panels">
        <ConditionsList conditions={mockConditions} filterSeverity={['critical', 'medium']} />
        <DocManifest
          status="in_progress"
          requiredDocs={[
            { kind: 'LE Package', received: true, version: 1 },
            { kind: 'VOE Letter', received: false },
          ]}
        />
      </section>
      <CTCEvaluator passed={false} issues={mockIssues} remainingSteps={mockSteps} />
    </main>
  );
};

export default LoanDetailPage;
