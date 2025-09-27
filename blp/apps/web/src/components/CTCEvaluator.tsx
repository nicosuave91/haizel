import React from 'react';
import type { ComplianceIssue, WorkflowStepContract } from '@haizel/domain';

export interface CTCEvaluatorProps {
  passed: boolean;
  issues: ComplianceIssue[];
  remainingSteps: WorkflowStepContract[];
  onEvaluate?: () => void;
}

export const CTCEvaluator: React.FC<CTCEvaluatorProps> = ({ passed, issues, remainingSteps, onEvaluate }) => {
  return (
    <section className="ctc-evaluator">
      <header>
        <h3>Clear to Close</h3>
        <span className={`ctc-evaluator__badge ctc-evaluator__badge--${passed ? 'pass' : 'fail'}`}>
          {passed ? 'Ready' : 'Blocked'}
        </span>
        {onEvaluate && (
          <button type="button" onClick={onEvaluate} className="ctc-evaluator__evaluate">
            Re-run evaluation
          </button>
        )}
      </header>
      <div className="ctc-evaluator__body">
        <h4>Issues</h4>
        <ul>
          {issues.map((issue) => (
            <li key={issue.code} className={`severity-${issue.severity}`}>
              <strong>{issue.code}</strong>: {issue.message}
              {issue.remediation && <p className="remediation">Remediation: {issue.remediation}</p>}
            </li>
          ))}
          {issues.length === 0 && <li>No outstanding compliance issues.</li>}
        </ul>
        <h4>Remaining steps</h4>
        <ul>
          {remainingSteps.map((step) => (
            <li key={step.id}>
              {step.title} — <span>{step.status}</span>
            </li>
          ))}
          {remainingSteps.length === 0 && <li>All required steps are complete.</li>}
        </ul>
      </div>
    </section>
  );
};
