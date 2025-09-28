import crypto from 'crypto';

export interface StorageObject {
  key: string;
  bucket: string;
  url: string;
  checksum: string;
  versionId: string;
}

export interface StorageAdapter {
  putObject(key: string, body: Buffer | string, options?: { contentType?: string }): Promise<StorageObject>;
  signUrl(key: string, options?: { expiresInSeconds?: number }): Promise<string>;
}

export class InMemoryStorageAdapter implements StorageAdapter {
  private readonly objects = new Map<string, StorageObject>();

  constructor(private readonly bucket = 'haizel-documents') {}

  async putObject(key: string, body: Buffer | string, options?: { contentType?: string }): Promise<StorageObject> {
    const checksum = crypto.createHash('sha256').update(body).digest('hex');
    const versionId = crypto.randomUUID();
    const url = `https://storage.local/${this.bucket}/${key}?version=${versionId}`;
    const object: StorageObject = {
      key,
      bucket: this.bucket,
      url,
      checksum,
      versionId,
    };
    this.objects.set(this.composeKey(key, versionId), object);
    return object;
  }

  async signUrl(key: string, options?: { expiresInSeconds?: number }): Promise<string> {
    const versioned = [...this.objects.values()].find((object) => object.key === key);
    if (!versioned) {
      throw new Error(`Object not found for key ${key}`);
    }
    const expiresIn = options?.expiresInSeconds ?? 300;
    const signature = crypto.randomBytes(16).toString('hex');
    return `${versioned.url}&sig=${signature}&expires=${expiresIn}`;
  }

  private composeKey(key: string, versionId: string): string {
    return `${key}:${versionId}`;
  }
}
