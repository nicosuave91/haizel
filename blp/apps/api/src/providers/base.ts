import crypto from 'crypto';

export type VendorKind =
  | 'credit'
  | 'income_employment'
  | 'assets'
  | 'amc'
  | 'flood'
  | 'mi'
  | 'aus'
  | 'esign'
  | 'title';

export type VendorEventName =
  | 'verification.completed'
  | 'order.status.changed'
  | 'aus.findings.available';

export interface VendorError extends Error {
  code: string;
  http?: number;
  retryable: boolean;
  context?: Record<string, unknown>;
  vendor?: VendorKind;
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
  tenantId: string;
  loanId: string;
  vendor: VendorKind;
  operation: string;
  idempotencyKey: string;
  request: unknown;
  response?: unknown;
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  httpCode?: number;
  errorCode?: string;
  startedAt: string;
  finishedAt?: string;
  retryCount: number;
}

export interface VendorCredential {
  tenantId: string;
  vendor: VendorKind;
  mode: 'sandbox' | 'live';
  sandboxBaseUrl: string;
  liveBaseUrl: string;
  apiKey?: string;
  clientId?: string;
  clientSecret?: string;
  hmacSecret: string;
  defaultHeaders?: Record<string, string>;
}

export interface VendorCredentialStore {
  getCredential(tenantId: string, vendor: VendorKind): Promise<VendorCredential>;
}

export interface VendorCallRepository {
  recordStart(record: VendorCallRecord): Promise<void>;
  recordCompletion(
    tenantId: string,
    idempotencyKey: string,
    updates: Partial<Pick<VendorCallRecord, 'status' | 'response' | 'httpCode' | 'errorCode' | 'finishedAt'>> & {
      retryCount: number;
    },
  ): Promise<void>;
  findByIdempotencyKey(
    tenantId: string,
    idempotencyKey: string,
  ): Promise<VendorCallRecord | null>;
}

export interface VendorEventEmitter {
  emit(event: VendorEventName, payload: Record<string, unknown>): Promise<void>;
}

export interface HttpRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
}

export interface HttpResponse {
  status: number;
  headers: Record<string, string>;
  json(): Promise<unknown>;
  text(): Promise<string>;
}

export type HttpCaller = (request: HttpRequest) => Promise<HttpResponse>;

export interface VendorHttpCallOptions<TRequest> {
  ctx: ProviderContext;
  vendor: VendorKind;
  operation: string;
  idempotencyKey: string;
  request: TRequest;
  path: string;
  method?: string;
  redactFields?: string[];
  retry?: RetryConfig;
  headers?: Record<string, string>;
}

export interface VendorHttpCallResult<TResponse> {
  data: TResponse;
  raw: unknown;
  httpStatus: number;
}

export class CircuitBreaker {
  private readonly state = new Map<string, { failures: number; openUntil?: number }>();

  constructor(private readonly failureThreshold = 5, private readonly resetTimeoutMs = 30_000) {}

  async execute<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const state = this.state.get(key);
    const now = Date.now();
    if (state?.openUntil && state.openUntil > now) {
      const error: VendorError = Object.assign(new Error('Circuit breaker open'), {
        code: 'CIRCUIT_OPEN',
        retryable: true,
      });
      throw error;
    }

    try {
      const result = await fn();
      this.state.delete(key);
      return result;
    } catch (error) {
      const next = state ?? { failures: 0 };
      next.failures += 1;
      if (next.failures >= this.failureThreshold) {
        next.openUntil = now + this.resetTimeoutMs;
      }
      this.state.set(key, next);
      throw error;
    }
  }
}

export class InMemoryVendorCallRepository implements VendorCallRepository {
  private readonly calls = new Map<string, VendorCallRecord>();

  async recordStart(record: VendorCallRecord): Promise<void> {
    this.calls.set(this.key(record.tenantId, record.idempotencyKey), record);
  }

  async recordCompletion(
    tenantId: string,
    idempotencyKey: string,
    updates: Partial<Pick<VendorCallRecord, 'status' | 'response' | 'httpCode' | 'errorCode' | 'finishedAt'>> & {
      retryCount: number;
    },
  ): Promise<void> {
    const key = this.key(tenantId, idempotencyKey);
    const record = this.calls.get(key);
    if (!record) {
      return;
    }
    this.calls.set(key, {
      ...record,
      ...updates,
    });
  }

  async findByIdempotencyKey(tenantId: string, idempotencyKey: string): Promise<VendorCallRecord | null> {
    return this.calls.get(this.key(tenantId, idempotencyKey)) ?? null;
  }

  private key(tenantId: string, idempotencyKey: string): string {
    return `${tenantId}:${idempotencyKey}`;
  }
}

export class NoopVendorEventEmitter implements VendorEventEmitter {
  async emit(): Promise<void> {
    // noop for tests / local dev
  }
}

export function redactPayload(payload: unknown, fields: string[] = []): unknown {
  if (payload === null || typeof payload !== 'object') {
    return payload;
  }

  if (Array.isArray(payload)) {
    return payload.map((item) => redactPayload(item, fields));
  }

  const sensitive = new Set<string>(['ssn', 'dob', 'taxId', 'accountNumber', 'routingNumber', ...fields]);

  return Object.fromEntries(
    Object.entries(payload as Record<string, unknown>).map(([key, value]) => {
      if (sensitive.has(key)) {
        return [key, value ? '***REDACTED***' : value];
      }
      return [key, redactPayload(value, fields)];
    }),
  );
}

export class VendorHttpClient {
  constructor(
    private readonly httpCaller: HttpCaller,
    private readonly credentials: VendorCredentialStore,
    private readonly repository: VendorCallRepository,
    private readonly events: VendorEventEmitter = new NoopVendorEventEmitter(),
    private readonly breaker: CircuitBreaker = new CircuitBreaker(),
  ) {}

  async call<TRequest, TResponse = unknown>(
    options: VendorHttpCallOptions<TRequest>,
    transform: {
      request?: (payload: TRequest, credential: VendorCredential) => unknown;
      response?: (payload: unknown, response: HttpResponse) => TResponse;
      onSuccess?: (payload: TResponse, raw: unknown) => Promise<void> | void;
      successEvent?: { name: VendorEventName; payload: (data: TResponse) => Record<string, unknown> };
    } = {},
  ): Promise<VendorHttpCallResult<TResponse>> {
    const credential = await this.credentials.getCredential(options.ctx.tenantId, options.vendor);
    const baseUrl = credential.mode === 'sandbox' ? credential.sandboxBaseUrl : credential.liveBaseUrl;
    const idempotentExisting = await this.repository.findByIdempotencyKey(options.ctx.tenantId, options.idempotencyKey);
    if (idempotentExisting?.status === 'succeeded' && idempotentExisting.response) {
      return {
        data: transform.response
          ? transform.response(idempotentExisting.response, {
              status: idempotentExisting.httpCode ?? 200,
              headers: {},
              async json() {
                return idempotentExisting.response;
              },
              async text() {
                return JSON.stringify(idempotentExisting.response);
              },
            } as HttpResponse)
          : (idempotentExisting.response as TResponse),
        raw: idempotentExisting.response,
        httpStatus: idempotentExisting.httpCode ?? 200,
      };
    }

    const requestBody = transform.request ? transform.request(options.request, credential) : options.request;
    const redactedRequest = redactPayload(requestBody, options.redactFields);

    const record: VendorCallRecord = {
      id: crypto.randomUUID(),
      tenantId: options.ctx.tenantId,
      loanId: options.ctx.loanId,
      vendor: options.vendor,
      operation: options.operation,
      idempotencyKey: options.idempotencyKey,
      request: redactedRequest,
      status: 'running',
      startedAt: new Date().toISOString(),
      retryCount: 0,
    };
    await this.repository.recordStart(record);

    const headers: Record<string, string> = {
      'content-type': 'application/json',
      'x-idempotency-key': options.idempotencyKey,
      'x-haizel-correlation-id': options.ctx.correlationId,
      ...(credential.apiKey ? { authorization: `Bearer ${credential.apiKey}` } : {}),
      ...(credential.defaultHeaders ?? {}),
      ...(options.headers ?? {}),
    };

    const request: HttpRequest = {
      url: new URL(options.path, baseUrl).toString(),
      method: options.method ?? 'POST',
      headers,
      body: requestBody ? JSON.stringify(requestBody) : undefined,
    };

    const retryConfig: RetryConfig = options.retry ?? {
      maxAttempts: credential.mode === 'sandbox' ? 1 : 3,
      baseDelayMs: 500,
      jitterMs: 250,
    };

    let attempt = 0;
    let response: HttpResponse;
    try {
      response = await this.breaker.execute(
        `${options.ctx.tenantId}:${options.vendor}`,
        () =>
          callWithRetry(async () => {
            attempt += 1;
            return this.httpCaller(request);
          }, retryConfig),
      );
    } catch (error) {
      await this.repository.recordCompletion(options.ctx.tenantId, options.idempotencyKey, {
        status: 'failed',
        retryCount: attempt,
        errorCode: error instanceof Error ? (error as VendorError).code ?? 'UNKNOWN_ERROR' : 'UNKNOWN_ERROR',
        finishedAt: new Date().toISOString(),
      });
      throw error;
    }

    const raw = await response.json().catch(async () => {
      const text = await response.text();
      return { raw: text };
    });

    const normalized = transform.response ? transform.response(raw, response) : (raw as TResponse);

    if (response.status >= 400) {
      const error: VendorError = Object.assign(new Error('Vendor call failed'), {
        code: `HTTP_${response.status}`,
        http: response.status,
        retryable: response.status >= 500,
        vendor: options.vendor,
        context: { operation: options.operation },
      });
      await this.repository.recordCompletion(options.ctx.tenantId, options.idempotencyKey, {
        status: 'failed',
        retryCount: attempt,
        httpCode: response.status,
        response: redactPayload(raw, options.redactFields),
        errorCode: error.code,
        finishedAt: new Date().toISOString(),
      });
      throw error;
    }

    await this.repository.recordCompletion(options.ctx.tenantId, options.idempotencyKey, {
      status: 'succeeded',
      retryCount: attempt,
      httpCode: response.status,
      response: redactPayload(raw, options.redactFields),
      finishedAt: new Date().toISOString(),
    });

    if (transform.onSuccess) {
      await transform.onSuccess(normalized, raw);
    }

    if (transform.successEvent) {
      await this.events.emit(transform.successEvent.name, transform.successEvent.payload(normalized));
    }

    return {
      data: normalized,
      raw,
      httpStatus: response.status,
    };
  }
}
