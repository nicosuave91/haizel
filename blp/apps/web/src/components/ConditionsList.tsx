import React, { useMemo, useState } from 'react';
import type { ConditionSummary } from '@haizel/domain';

export interface ExtendedCondition extends ConditionSummary {
  source?: 'AUS' | 'MANUAL' | 'VENDOR' | 'SYSTEM';
  ageDays?: number;
  evidenceUrl?: string;
}

export interface ConditionsListProps {
  conditions: ExtendedCondition[];
  onBulkUpdate?: (codes: string[], status: ConditionSummary['status']) => void;
  onRequestWaiver?: (codes: string[], reason: string) => void;
}

const severityLabels: Record<ConditionSummary['severity'], string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

const sources: Array<NonNullable<ExtendedCondition['source']>> = ['AUS', 'MANUAL', 'VENDOR', 'SYSTEM'];

export const ConditionsList: React.FC<ConditionsListProps> = ({ conditions, onBulkUpdate, onRequestWaiver }) => {
  const [selectedSeverities, setSelectedSeverities] = useState<ConditionSummary['severity'][]>([]);
  const [selectedSources, setSelectedSources] = useState<ExtendedCondition['source'][]>([]);
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const [waiverReason, setWaiverReason] = useState('');

  const filtered = useMemo(() => {
    return conditions.filter((condition) => {
      const matchesSeverity =
        selectedSeverities.length === 0 || selectedSeverities.includes(condition.severity);
      const matchesSource =
        selectedSources.length === 0 || (condition.source && selectedSources.includes(condition.source));
      return matchesSeverity && matchesSource;
    });
  }, [conditions, selectedSeverities, selectedSources]);

  const toggleSelection = (code: string) => {
    setSelectedCodes((current) =>
      current.includes(code) ? current.filter((item) => item !== code) : [...current, code],
    );
  };

  return (
    <section className="conditions-list">
      <header className="conditions-list__header">
        <div>
          <h3>Conditions</h3>
          <span>{filtered.length} items</span>
        </div>
        <div className="conditions-list__filters">
          <fieldset>
            <legend>Severity</legend>
            {(['critical', 'high', 'medium', 'low'] as ConditionSummary['severity'][]).map((severity) => (
              <label key={severity}>
                <input
                  type="checkbox"
                  checked={selectedSeverities.includes(severity)}
                  onChange={(event) => {
                    const { checked } = event.target;
                    setSelectedSeverities((current) =>
                      checked ? [...current, severity] : current.filter((value) => value !== severity),
                    );
                  }}
                />
                {severityLabels[severity]}
              </label>
            ))}
          </fieldset>
          <fieldset>
            <legend>Source</legend>
            {sources.map((source) => (
              <label key={source}>
                <input
                  type="checkbox"
                  checked={selectedSources.includes(source)}
                  onChange={(event) => {
                    const { checked } = event.target;
                    setSelectedSources((current) =>
                      checked ? [...current, source] : current.filter((value) => value !== source),
                    );
                  }}
                />
                {source}
              </label>
            ))}
          </fieldset>
        </div>
      </header>
      <ul>
        {filtered.map((condition) => (
          <li key={condition.code} className={`conditions-list__item conditions-list__item--${condition.severity}`}>
            <label className="conditions-list__checkbox">
              <input
                type="checkbox"
                checked={selectedCodes.includes(condition.code)}
                onChange={() => toggleSelection(condition.code)}
              />
            </label>
            <span className={`conditions-list__severity conditions-list__severity--${condition.severity}`}>
              {severityLabels[condition.severity]}
            </span>
            <div className="conditions-list__details">
              <p className="conditions-list__description">{condition.description}</p>
              <p className="conditions-list__meta">
                Status: <strong>{condition.status}</strong>
                {condition.source && <span> · Source: {condition.source}</span>}
                {typeof condition.ageDays === 'number' && <span> · Age: {condition.ageDays}d</span>}
              </p>
              {condition.evidenceUrl && (
                <p>
                  <a href={condition.evidenceUrl} target="_blank" rel="noreferrer">
                    View evidence
                  </a>
                </p>
              )}
            </div>
          </li>
        ))}
        {filtered.length === 0 && <li>No conditions to display.</li>}
      </ul>
      {(onBulkUpdate || onRequestWaiver) && (
        <footer className="conditions-list__footer">
          <div>
            <button
              type="button"
              disabled={selectedCodes.length === 0 || !onBulkUpdate}
              onClick={() => onBulkUpdate?.(selectedCodes, 'met')}
            >
              Mark as met
            </button>
            <button
              type="button"
              disabled={selectedCodes.length === 0 || !onBulkUpdate}
              onClick={() => onBulkUpdate?.(selectedCodes, 'waived')}
            >
              Mark as waived
            </button>
          </div>
          {onRequestWaiver && (
            <div className="conditions-list__waiver">
              <label>
                Waiver reason
                <input
                  type="text"
                  value={waiverReason}
                  onChange={(event) => setWaiverReason(event.target.value)}
                  placeholder="Provide manager rationale"
                />
              </label>
              <button
                type="button"
                disabled={selectedCodes.length === 0 || waiverReason.trim().length === 0}
                onClick={() => {
                  onRequestWaiver?.(selectedCodes, waiverReason.trim());
                  setWaiverReason('');
                  setSelectedCodes([]);
                }}
              >
                Request waiver
              </button>
            </div>
          )}
        </footer>
      )}
    </section>
  );
};
