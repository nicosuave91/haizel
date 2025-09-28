import crypto from 'crypto';

export interface ManifestDocumentDefinition {
  code: string;
  title: string;
  source: 'SYSTEM' | 'AUS' | 'VENDOR' | 'USER';
  required: boolean;
}

export interface ManifestDocumentStatus extends ManifestDocumentDefinition {
  received: boolean;
  version: number;
  checksum?: string;
  receivedAt?: string;
  redacted?: boolean;
}

export interface ManifestSummary {
  loanId: string;
  status: 'pending' | 'in_progress' | 'complete';
  received: number;
  required: number;
  documents: ManifestDocumentStatus[];
  version: number;
}

export interface ManifestStore {
  save(summary: ManifestSummary): Promise<void>;
  get(loanId: string): Promise<ManifestSummary | null>;
}

export class InMemoryManifestStore implements ManifestStore {
  private readonly manifests = new Map<string, ManifestSummary>();

  async save(summary: ManifestSummary): Promise<void> {
    this.manifests.set(summary.loanId, summary);
  }

  async get(loanId: string): Promise<ManifestSummary | null> {
    return this.manifests.get(loanId) ?? null;
  }
}

export class DocumentManifestService {
  constructor(private readonly store: ManifestStore = new InMemoryManifestStore()) {}

  async initialize(loanId: string, definitions: ManifestDocumentDefinition[]): Promise<ManifestSummary> {
    const summary: ManifestSummary = {
      loanId,
      status: 'pending',
      received: 0,
      required: definitions.filter((doc) => doc.required).length,
      documents: definitions.map((doc) => ({
        ...doc,
        received: false,
        version: 0,
      })),
      version: 1,
    };
    await this.store.save(summary);
    return summary;
  }

  async attachDocument(
    loanId: string,
    input: {
      code: string;
      checksum?: string;
      redacted?: boolean;
    },
  ): Promise<ManifestSummary> {
    const manifest = (await this.store.get(loanId)) ?? (await this.initialize(loanId, []));
    let matched = false;
    const documents = manifest.documents.map((doc) => {
      if (doc.code !== input.code) {
        return doc;
      }
      matched = true;
      const version = doc.version + 1;
      return {
        ...doc,
        received: true,
        version,
        checksum: input.checksum,
        redacted: input.redacted ?? doc.redacted,
        receivedAt: new Date().toISOString(),
      };
    });

    const nextDocuments = matched
      ? documents
      : [
          ...documents,
          {
            code: input.code,
            title: input.code,
            source: 'VENDOR' as const,
            required: false,
            received: true,
            version: 1,
            checksum: input.checksum,
            redacted: input.redacted ?? false,
            receivedAt: new Date().toISOString(),
          },
        ];

    const received = nextDocuments.filter((doc) => doc.required && doc.received).length;
    const status = received === manifest.required ? 'complete' : received > 0 ? 'in_progress' : 'pending';

    const next: ManifestSummary = {
      ...manifest,
      documents: nextDocuments,
      received,
      status,
      version: manifest.version + 1,
    };

    await this.store.save(next);
    return next;
  }

  async computeStatus(loanId: string): Promise<ManifestSummary | null> {
    const manifest = await this.store.get(loanId);
    if (!manifest) {
      return null;
    }
    const received = manifest.documents.filter((doc) => doc.required && doc.received).length;
    const status = received === manifest.required ? 'complete' : received > 0 ? 'in_progress' : 'pending';
    const next = {
      ...manifest,
      received,
      status,
    };
    await this.store.save(next);
    return next;
  }

  async blockClose(loanId: string): Promise<boolean> {
    const manifest = await this.computeStatus(loanId);
    if (!manifest) {
      return true;
    }
    return manifest.status !== 'complete';
  }

  static checksum(buffer: Buffer | string): string {
    const value = typeof buffer === 'string' ? Buffer.from(buffer) : buffer;
    return crypto.createHash('sha256').update(value).digest('hex');
  }
}
