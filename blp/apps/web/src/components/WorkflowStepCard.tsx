import React, { useMemo } from 'react';
import type { WorkflowEvidenceRef, WorkflowStepContract } from '@haizel/domain';

export interface WorkflowStepAction {
  code: string;
  label: string;
  disabled?: boolean;
  reason?: string;
}

export interface WorkflowStepCardProps {
  step: WorkflowStepContract;
  now?: () => Date;
  actions?: WorkflowStepAction[];
  onAction?: (action: WorkflowStepAction, step: WorkflowStepContract) => void;
  onViewLogs?: (step: WorkflowStepContract) => void;
}

const statusLabels: Record<WorkflowStepContract['status'], string> = {
  pending: 'Pending',
  blocked: 'Blocked',
  in_progress: 'In progress',
  complete: 'Complete',
  failed: 'Failed',
  waived: 'Waived',
};

export const WorkflowStepCard: React.FC<WorkflowStepCardProps> = ({
  step,
  actions = [],
  now = () => new Date(),
  onAction,
  onViewLogs,
}) => {
  const slaCountdown = useMemo(() => {
    if (!step.dueAt) {
      return null;
    }
    const due = new Date(step.dueAt).getTime();
    const diffMs = due - now().getTime();
    if (Number.isNaN(due)) {
      return null;
    }
    const sign = diffMs >= 0 ? '' : '-';
    const minutes = Math.abs(Math.floor(diffMs / 60000));
    return `${sign}${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  }, [step.dueAt, now]);

  const quickActions = actions.filter((action) => !action.disabled);

  return (
    <article className={`workflow-step-card workflow-step-card--${step.status}`}>
      <header className="workflow-step-card__header">
        <div>
          <span className="workflow-step-card__code">{step.code}</span>
          <span className={`workflow-step-card__status workflow-step-card__status--${step.status}`}>
            {statusLabels[step.status]}
          </span>
        </div>
        <div className="workflow-step-card__timers">
          {slaCountdown && <span className="workflow-step-card__sla">SLA: {slaCountdown}</span>}
          {step.timestamps.startedAt && (
            <span className="workflow-step-card__started">Started {timeAgo(step.timestamps.startedAt)}</span>
          )}
        </div>
      </header>
      <div className="workflow-step-card__body">
        <h3>{step.title}</h3>
        <p className="workflow-step-card__meta">
          Owner: <strong>{step.ownerRole}</strong> · Required: {step.required ? 'Yes' : 'No'}
        </p>
        {step.preconditions.length > 0 && (
          <ul className="workflow-step-card__preconditions">
            {step.preconditions.map((precondition) => (
              <li key={precondition}>{precondition}</li>
            ))}
          </ul>
        )}
        {step.blockedReason && (
          <div className="workflow-step-card__blocked" role="alert">
            <strong>Blocked:</strong> {step.blockedReason}
          </div>
        )}
        {step.evidenceRefs.length > 0 && (
          <EvidenceList evidence={step.evidenceRefs} />
        )}
      </div>
      <footer className="workflow-step-card__footer">
        <div className="workflow-step-card__actions">
          {quickActions.map((action) => (
            <button
              key={action.code}
              type="button"
              onClick={() => onAction?.(action, step)}
              className="workflow-step-card__action"
            >
              {action.label}
            </button>
          ))}
          {actions
            .filter((action) => action.disabled)
            .map((action) => (
              <button
                key={`${action.code}-disabled`}
                type="button"
                disabled
                title={action.reason}
                className="workflow-step-card__action workflow-step-card__action--disabled"
              >
                {action.label}
              </button>
            ))}
        </div>
        <div className="workflow-step-card__utilities">
          {onViewLogs && (
            <button type="button" onClick={() => onViewLogs(step)}>
              View logs
            </button>
          )}
        </div>
      </footer>
    </article>
  );
};

const EvidenceList: React.FC<{ evidence: WorkflowEvidenceRef[] }> = ({ evidence }) => (
  <ul className="workflow-step-card__evidence">
    {evidence.map((ref, index) => (
      <li key={index}>
        {ref.docId && <span className="workflow-step-card__chip">Doc #{ref.docId}</span>}
        {ref.vendorCallId && (
          <span className="workflow-step-card__chip workflow-step-card__chip--vendor">
            Vendor #{ref.vendorCallId}
          </span>
        )}
        {ref.note && <span className="workflow-step-card__chip workflow-step-card__chip--note">{ref.note}</span>}
      </li>
    ))}
  </ul>
);

function timeAgo(timestamp: string): string {
  const delta = Date.now() - new Date(timestamp).getTime();
  if (!Number.isFinite(delta)) {
    return '';
  }
  const minutes = Math.floor(delta / 60000);
  if (minutes < 1) {
    return 'just now';
  }
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
