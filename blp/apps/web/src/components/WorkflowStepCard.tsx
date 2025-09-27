import React from 'react';
import type { WorkflowStepContract } from '@haizel/domain';

export interface WorkflowStepCardProps {
  step: WorkflowStepContract;
  onAction?: (step: WorkflowStepContract) => void;
}

const statusColors: Record<WorkflowStepContract['status'], string> = {
  pending: '#fbbf24',
  blocked: '#f87171',
  in_progress: '#60a5fa',
  complete: '#34d399',
  failed: '#ef4444',
  waived: '#a855f7',
};

export const WorkflowStepCard: React.FC<WorkflowStepCardProps> = ({ step, onAction }) => {
  return (
    <div className="workflow-step-card">
      <header className="workflow-step-card__header">
        <span className="workflow-step-card__code">{step.code}</span>
        <span
          className="workflow-step-card__status"
          style={{ backgroundColor: statusColors[step.status] }}
        >
          {step.status.replace('_', ' ')}
        </span>
      </header>
      <div className="workflow-step-card__body">
        <h3>{step.title}</h3>
        <p className="workflow-step-card__meta">
          Owner: <strong>{step.ownerRole}</strong> · Required: {step.required ? 'Yes' : 'No'}
        </p>
        {step.preconditions.length > 0 && (
          <p className="workflow-step-card__preconditions">
            Preconditions: {step.preconditions.join(', ')}
          </p>
        )}
        {step.blockedReason && (
          <p className="workflow-step-card__blocked">Blocked: {step.blockedReason}</p>
        )}
        {step.evidenceRefs.length > 0 && (
          <ul className="workflow-step-card__evidence">
            {step.evidenceRefs.map((ref, index) => (
              <li key={index}>
                {ref.docId && <span>Doc #{ref.docId}</span>}
                {ref.vendorCallId && <span>Vendor call #{ref.vendorCallId}</span>}
                {ref.note && <span>{ref.note}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
      {onAction && (
        <footer className="workflow-step-card__footer">
          <button type="button" onClick={() => onAction(step)}>
            View actions
          </button>
        </footer>
      )}
    </div>
  );
};
