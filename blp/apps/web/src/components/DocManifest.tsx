import React from 'react';

export interface DocManifestProps {
  status: string;
  requiredDocs: Array<{ kind: string; received: boolean; version?: number }>;
  onUpload?: (kind: string) => void;
}

export const DocManifest: React.FC<DocManifestProps> = ({ status, requiredDocs, onUpload }) => {
  return (
    <section className="doc-manifest">
      <header>
        <h3>Document Manifest</h3>
        <span className={`doc-manifest__status doc-manifest__status--${status}`}>{status}</span>
      </header>
      <ul>
        {requiredDocs.map((doc) => (
          <li key={doc.kind}>
            <div>
              <strong>{doc.kind}</strong>
              {typeof doc.version === 'number' && <span className="doc-manifest__version">v{doc.version}</span>}
            </div>
            <div className="doc-manifest__actions">
              <span className={doc.received ? 'received' : 'missing'}>
                {doc.received ? 'Received' : 'Missing'}
              </span>
              {!doc.received && onUpload && (
                <button type="button" onClick={() => onUpload(doc.kind)}>
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
