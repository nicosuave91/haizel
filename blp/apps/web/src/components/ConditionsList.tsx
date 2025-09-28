import React from 'react';
import type { ConditionSummary } from '@haizel/domain';

export interface ConditionsListProps {
  conditions: ConditionSummary[];
  filterSeverity?: ConditionSummary['severity'][];
}

const severityLabels: Record<ConditionSummary['severity'], string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

export const ConditionsList: React.FC<ConditionsListProps> = ({ conditions, filterSeverity }) => {
  const filtered = filterSeverity
    ? conditions.filter((condition) => filterSeverity.includes(condition.severity))
    : conditions;

  return (
    <div className="conditions-list">
      <header>
        <h3>Conditions</h3>
        <span>{filtered.length} items</span>
      </header>
      <ul>
        {filtered.map((condition) => (
          <li key={condition.code}>
            <span
              className={`conditions-list__severity conditions-list__severity--${condition.severity}`}
            >
              {severityLabels[condition.severity]}
            </span>
            <div>
              <p className="conditions-list__description">{condition.description}</p>
              <p className="conditions-list__status">Status: {condition.status}</p>
            </div>
          </li>
        ))}
        {filtered.length === 0 && <li>No conditions to display.</li>}
      </ul>
    </div>
  );
};
