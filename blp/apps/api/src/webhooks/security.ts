import crypto from 'crypto';
import { VendorKind } from '../providers/base';

export interface RawWebhookRequest {
  headers: Record<string, string | undefined>;
  body: unknown;
  rawBody?: string;
  tenantHint?: string;
  vendorHint?: string;
}

export interface VerifiedWebhook<TBody = any> {
  tenantId: string;
  vendor: VendorKind;
  body: TBody;
  receivedAt: string;
  signature: string;
}

export interface WebhookSecretProvider {
  getSecret(tenantId: string, vendor: VendorKind): Promise<string>;
}

export interface WebhookNonceStore {
  has(tenantId: string, vendor: VendorKind, nonce: string): Promise<boolean>;
  remember(tenantId: string, vendor: VendorKind, nonce: string, expiresAt: number): Promise<void>;
  sweep?(now: number): Promise<void>;
}

export class InMemoryWebhookNonceStore implements WebhookNonceStore {
  private readonly entries = new Map<string, number>();

  async has(tenantId: string, vendor: VendorKind, nonce: string): Promise<boolean> {
    const key = this.key(tenantId, vendor, nonce);
    const expiresAt = this.entries.get(key);
    if (!expiresAt) {
      return false;
    }
    if (expiresAt <= Date.now()) {
      this.entries.delete(key);
      return false;
    }
    return true;
  }

  async remember(tenantId: string, vendor: VendorKind, nonce: string, expiresAt: number): Promise<void> {
    this.entries.set(this.key(tenantId, vendor, nonce), expiresAt);
  }

  async sweep(now: number = Date.now()): Promise<void> {
    for (const [key, expiresAt] of this.entries.entries()) {
      if (expiresAt <= now) {
        this.entries.delete(key);
      }
    }
  }

  private key(tenantId: string, vendor: VendorKind, nonce: string): string {
    return `${tenantId}:${vendor}:${nonce}`;
  }
}

export class StaticWebhookSecretProvider implements WebhookSecretProvider {
  constructor(private readonly secrets: Record<string, string>) {}

  async getSecret(tenantId: string, vendor: VendorKind): Promise<string> {
    const key = `${tenantId}:${vendor}`;
    const secret = this.secrets[key] ?? this.secrets[vendor];
    if (!secret) {
      throw new Error(`No webhook secret configured for vendor ${vendor} in tenant ${tenantId}`);
    }
    return secret;
  }
}

export class WebhookVerifier {
  constructor(
    private readonly secretProvider: WebhookSecretProvider,
    private readonly nonceStore: WebhookNonceStore = new InMemoryWebhookNonceStore(),
    private readonly toleranceMs = 5 * 60 * 1000,
  ) {}

  async verify<TBody = any>(request: RawWebhookRequest): Promise<VerifiedWebhook<TBody>> {
    const vendor = (request.headers['x-haizel-vendor'] ?? request.vendorHint ?? '').toLowerCase() as VendorKind;
    const tenantId = request.headers['x-haizel-tenant'] ?? request.tenantHint;
    const signature = request.headers['x-signature'];
    const timestamp = request.headers['x-timestamp'];
    const nonce = request.headers['x-nonce'];

    if (!tenantId) {
      throw new Error('Missing X-Haizel-Tenant header');
    }
    if (!vendor) {
      throw new Error('Missing X-Haizel-Vendor header');
    }
    if (!signature || !timestamp || !nonce) {
      throw new Error('Missing webhook signature headers');
    }

    const ts = Number(timestamp);
    if (!Number.isFinite(ts)) {
      throw new Error('Invalid webhook timestamp');
    }

    const now = Date.now();
    if (Math.abs(now - ts) > this.toleranceMs) {
      throw new Error('Webhook timestamp outside of allowed tolerance');
    }

    if (await this.nonceStore.has(tenantId, vendor, nonce)) {
      throw new Error('Webhook replay detected');
    }

    const bodyString = request.rawBody ?? JSON.stringify(request.body ?? {});
    const bodyDigest = crypto.createHash('sha256').update(bodyString).digest('hex');
    const base = `${timestamp}.${bodyDigest}`;
    const secret = await this.secretProvider.getSecret(tenantId, vendor);
    const expected = crypto.createHmac('sha256', secret).update(base).digest('hex');

    const expectedBuffer = Buffer.from(expected);
    const signatureBuffer = Buffer.from(signature);
    if (expectedBuffer.length !== signatureBuffer.length) {
      throw new Error('Invalid webhook signature');
    }
    if (!crypto.timingSafeEqual(expectedBuffer, signatureBuffer)) {
      throw new Error('Invalid webhook signature');
    }

    await this.nonceStore.remember(tenantId, vendor, nonce, now + this.toleranceMs);
    if (this.nonceStore.sweep) {
      await this.nonceStore.sweep(now);
    }

    return {
      tenantId,
      vendor,
      body: request.body as TBody,
      receivedAt: new Date(now).toISOString(),
      signature,
    };
  }
}
