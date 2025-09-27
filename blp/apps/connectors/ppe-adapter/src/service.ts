import {
  PPEQuoteRequest,
  PPEQuoteAdapterPayload,
  PPEQuoteAdapterResponse,
  PPEQuoteResponse,
  PPERateLockRequest,
  PPERateLockAdapterPayload,
  PPERateLockAdapterResponse,
  PPERateLockResponse,
  mapFromLockResponse,
  mapFromQuoteResponse,
  mapToLockPayload,
  mapToQuotePayload,
} from './mappers';
import {
  getVaultSecretPlaceholder,
  handleWithIdempotency,
  IdempotencyCache,
  withRetries,
} from '@haizel/connectors-shared';

export interface PPEAdapter {
  requestQuote(payload: PPEQuoteAdapterPayload): Promise<PPEQuoteAdapterResponse>;
  lockRate(payload: PPERateLockAdapterPayload): Promise<PPERateLockAdapterResponse>;
  getLock(lockReference: string): Promise<PPERateLockAdapterResponse | undefined>;
}

class MockPPEAdapter implements PPEAdapter {
  private readonly quotes = new Map<string, PPEQuoteAdapterResponse>();

  private readonly locks = new Map<string, PPERateLockAdapterResponse>();

  async requestQuote(payload: PPEQuoteAdapterPayload): Promise<PPEQuoteAdapterResponse> {
    const baseRate = 5.25 + payload.risk.ltv * 0.5 + Math.max(0, 700 - payload.risk.fico) / 200;
    const quote: PPEQuoteAdapterResponse = {
      quoteReference: `${payload.caseId}-Q-${payload.lockPeriodDays}`,
      bestEffortRate: Number(baseRate.toFixed(3)),
      price: Number((102 - baseRate).toFixed(3)),
      expiresAt: new Date(Date.now() + payload.lockPeriodDays * 24 * 60 * 60 * 1000).toISOString(),
    };
    this.quotes.set(quote.quoteReference, quote);
    return quote;
  }

  async lockRate(payload: PPERateLockAdapterPayload): Promise<PPERateLockAdapterResponse> {
    const quote = this.quotes.get(payload.quoteReference);
    if (!quote) {
      const rejected: PPERateLockAdapterResponse = {
        lockReference: `${payload.quoteReference}-REJECTED`,
        status: 'REJECTED',
        lockedRate: 0,
        expiresAt: new Date().toISOString(),
      };
      this.locks.set(rejected.lockReference, rejected);
      return rejected;
    }

    const lock: PPERateLockAdapterResponse = {
      lockReference: `${payload.caseId}-L-${payload.lockPeriodDays}`,
      status: 'LOCKED',
      lockedRate: quote.bestEffortRate,
      expiresAt: new Date(Date.now() + payload.lockPeriodDays * 24 * 60 * 60 * 1000).toISOString(),
    };
    this.locks.set(lock.lockReference, lock);
    return lock;
  }

  async getLock(lockReference: string): Promise<PPERateLockAdapterResponse | undefined> {
    return this.locks.get(lockReference);
  }
}

export class PPEService {
  private readonly idempotencyCache = new IdempotencyCache();

  private readonly config = {
    endpoint: process.env.PPE_API_URL ?? 'https://mock-ppe.local',
    apiKey: getVaultSecretPlaceholder('secret/data/connectors/ppe', 'PPE_API_KEY'),
  };

  constructor(private readonly adapter: PPEAdapter = new MockPPEAdapter()) {}

  getIdempotencyCache(): IdempotencyCache {
    return this.idempotencyCache;
  }

  async requestQuote(request: PPEQuoteRequest, idempotencyKey?: string): Promise<PPEQuoteResponse> {
    const payload = mapToQuotePayload(request);
    const result = await handleWithIdempotency(idempotencyKey, this.idempotencyCache, async () => {
      const response = await withRetries(() => this.adapter.requestQuote(payload));
      return { status: 200, body: mapFromQuoteResponse(request, response) };
    });

    return result.body as PPEQuoteResponse;
  }

  async lockRate(request: PPERateLockRequest, idempotencyKey?: string): Promise<PPERateLockResponse> {
    const payload = mapToLockPayload(request);
    const result = await handleWithIdempotency(idempotencyKey, this.idempotencyCache, async () => {
      const response = await withRetries(() => this.adapter.lockRate(payload));
      return { status: 200, body: mapFromLockResponse(response) };
    });

    return result.body as PPERateLockResponse;
  }

  async getLock(lockId: string): Promise<PPERateLockResponse | undefined> {
    const response = await this.adapter.getLock(lockId);
    if (!response) {
      return undefined;
    }
    return mapFromLockResponse(response);
  }
}
