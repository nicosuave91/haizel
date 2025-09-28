import React from 'react';

export interface DocManifestEntry {
  code: string;
  title: string;
  required: boolean;
  received: boolean;
  version?: number;
  checksum?: string;
  redacted?: boolean;
}

export interface DocManifestProps {
  status: 'pending' | 'in_progress' | 'complete';
  requiredDocs: DocManifestEntry[];
  onUpload?: (code: string) => void;
  onToggleRedaction?: (code: string) => void;
}

export const DocManifest: React.FC<DocManifestProps> = ({
  status,
  requiredDocs,
  onUpload,
  onToggleRedaction,
}) => {
  const receivedCount = requiredDocs.filter((doc) => doc.required && doc.received).length;
  const requiredCount = requiredDocs.filter((doc) => doc.required).length;
  const completion = requiredCount === 0 ? 0 : Math.round((receivedCount / requiredCount) * 100);

  return (
    <section className={`doc-manifest doc-manifest--${status}`}>
      <header className="doc-manifest__header">
        <div>
          <h3>Document Manifest</h3>
          <p className="doc-manifest__meter">Completion: {completion}%</p>
        </div>
        <span className={`doc-manifest__status doc-manifest__status--${status}`}>{formatStatus(status)}</span>
      </header>
      <ul>
        {requiredDocs.map((doc) => (
          <li key={doc.code} className={doc.received ? 'doc-manifest__item doc-manifest__item--received' : 'doc-manifest__item'}>
            <div className="doc-manifest__info">
              <strong>{doc.title}</strong>
              <span className="doc-manifest__code">{doc.code}</span>
              {typeof doc.version === 'number' && <span className="doc-manifest__version">v{doc.version}</span>}
              {doc.checksum && <span className="doc-manifest__checksum">Checksum {doc.checksum.slice(0, 8)}…</span>}
            </div>
            <div className="doc-manifest__actions">
              <span className={`doc-manifest__badge doc-manifest__badge--${doc.received ? 'received' : 'missing'}`}>
                {doc.received ? 'Received' : 'Missing'}
              </span>
              {doc.received && (
                <button type="button" onClick={() => onToggleRedaction?.(doc.code)}>
                  {doc.redacted ? 'Show PII' : 'Redact PII'}
                </button>
              )}
              {!doc.received && onUpload && (
                <button type="button" onClick={() => onUpload(doc.code)}>
                  Upload
                </button>
              )}
            </div>
          </li>
        ))}
        {requiredDocs.length === 0 && <li>Manifest is empty.</li>}
      </ul>
    </section>
  );
};

function formatStatus(status: DocManifestProps['status']): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (match) => match.toUpperCase());
}
