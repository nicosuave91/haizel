import crypto from 'crypto';

export interface VendorError extends Error {
  code: string;
  http?: number;
  retryable: boolean;
  context?: Record<string, unknown>;
}

export interface RetryConfig {
  maxAttempts: number;
  baseDelayMs: number;
  jitterMs?: number;
}

export async function callWithRetry<T>(
  fn: () => Promise<T>,
  { maxAttempts, baseDelayMs, jitterMs = 250 }: RetryConfig,
): Promise<T> {
  let attempt = 0;
  let lastError: unknown;
  while (attempt < maxAttempts) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      attempt += 1;
      if (attempt >= maxAttempts) {
        break;
      }
      const jitter = Math.floor(Math.random() * jitterMs);
      await new Promise((resolve) => setTimeout(resolve, baseDelayMs * attempt + jitter));
    }
  }
  throw lastError as Error;
}

export function hmacSignature(secret: string, payload: unknown): string {
  const body = typeof payload === 'string' ? payload : JSON.stringify(payload);
  return crypto.createHmac('sha256', secret).update(body).digest('hex');
}

export interface ProviderContext {
  tenantId: string;
  loanId: string;
  correlationId: string;
  mockMode: boolean;
}

export interface VendorCallRecord {
  id: string;
  request: unknown;
  response?: unknown;
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  httpCode?: number;
  errorCode?: string;
  startedAt: string;
  finishedAt?: string;
  retryCount: number;
}
