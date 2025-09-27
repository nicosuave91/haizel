import crypto from 'node:crypto';

export interface RetryOptions {
  retries?: number;
  delayMs?: number;
  backoffFactor?: number;
}

export async function withRetries<T>(
  operation: () => Promise<T>,
  { retries = 3, delayMs = 200, backoffFactor = 2 }: RetryOptions = {},
): Promise<T> {
  let attempt = 0;
  let lastError: unknown;
  let currentDelay = delayMs;

  while (attempt <= retries) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt === retries) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, currentDelay));
      currentDelay *= backoffFactor;
      attempt += 1;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Operation failed after retries');
}

export function verifyHmacSignature({
  payload,
  signature,
  secret,
}: {
  payload: string;
  signature: string | undefined;
  secret: string;
}): boolean {
  if (!signature) {
    return false;
  }

  const computed = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  const provided = Buffer.from(signature);
  const expected = Buffer.from(computed);
  if (provided.length !== expected.length) {
    return false;
  }

  return crypto.timingSafeEqual(provided, expected);
}

export interface CachedResponse {
  status: number;
  body: unknown;
  headers?: Record<string, string>;
  createdAt: number;
}

export class IdempotencyCache {
  private readonly cache = new Map<string, CachedResponse>();

  constructor(private readonly ttlMs = 10 * 60 * 1000) {}

  get(key: string): CachedResponse | undefined {
    const value = this.cache.get(key);
    if (!value) {
      return undefined;
    }
    if (Date.now() - value.createdAt > this.ttlMs) {
      this.cache.delete(key);
      return undefined;
    }
    return value;
  }

  set(key: string, response: Omit<CachedResponse, 'createdAt'>): CachedResponse {
    const stored: CachedResponse = { ...response, createdAt: Date.now() };
    this.cache.set(key, stored);
    return stored;
  }
}

export interface IdempotentResult {
  status: number;
  body: unknown;
  headers?: Record<string, string>;
}

export async function handleWithIdempotency(
  idempotencyKey: string | undefined,
  cache: IdempotencyCache,
  handler: () => Promise<IdempotentResult>,
): Promise<IdempotentResult> {
  if (!idempotencyKey) {
    return handler();
  }

  const cached = cache.get(idempotencyKey);
  if (cached) {
    return { status: cached.status, body: cached.body, headers: cached.headers };
  }

  const result = await handler();
  cache.set(idempotencyKey, { status: result.status, body: result.body, headers: result.headers });
  return result;
}

export function getVaultSecretPlaceholder(
  path: string,
  envVar: string,
  fallback?: string,
): string {
  const envValue = process.env[envVar];
  if (envValue && !envValue.startsWith('vault:')) {
    return envValue;
  }
  return envValue ?? fallback ?? `vault:${path}`;
}
