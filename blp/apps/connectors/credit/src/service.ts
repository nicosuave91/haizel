import {
  CreditAdapterPullPayload,
  CreditAdapterPullResponse,
  CreditPullAcknowledgement,
  CreditPullRequest,
  CreditPullResult,
  acknowledgementFromResult,
  mapFromAdapterResponse,
  mapToAdapterPayload,
} from './mappers';
import {
  getVaultSecretPlaceholder,
  handleWithIdempotency,
  IdempotencyCache,
  withRetries,
} from '@haizel/connectors-shared';

export interface CreditAdapter {
  pullCredit(payload: CreditAdapterPullPayload): Promise<CreditAdapterPullResponse>;
  getPull(pullReference: string): Promise<CreditAdapterPullResponse | undefined>;
}

class MockCreditAdapter implements CreditAdapter {
  private readonly pulls = new Map<string, CreditAdapterPullResponse>();

  async pullCredit(payload: CreditAdapterPullPayload): Promise<CreditAdapterPullResponse> {
    const response: CreditAdapterPullResponse = {
      pullReference: `${payload.subjectId}-PULL`,
      status: 'COMPLETED',
      tradelines: [
        { creditor: 'Sample Bank', balance: 15000, status: 'OPEN' },
        { creditor: 'Auto Finance Co', balance: 8500, status: 'OPEN' },
      ],
      score: payload.includeScore ? 720 : undefined,
      refreshedAt: new Date().toISOString(),
    };
    this.pulls.set(response.pullReference, response);
    return response;
  }

  async getPull(pullReference: string): Promise<CreditAdapterPullResponse | undefined> {
    return this.pulls.get(pullReference);
  }
}

export class CreditService {
  private readonly results = new Map<string, CreditPullResult>();

  private readonly idempotencyCache = new IdempotencyCache();

  private readonly config = {
    endpoint: process.env.CREDIT_API_URL ?? 'https://mock-credit.local',
    apiKey: getVaultSecretPlaceholder('secret/data/connectors/credit', 'CREDIT_API_KEY'),
  };

  constructor(private readonly adapter: CreditAdapter = new MockCreditAdapter()) {}

  async pullCredit(request: CreditPullRequest, idempotencyKey?: string): Promise<CreditPullAcknowledgement> {
    const payload = mapToAdapterPayload(request);
    const result = await handleWithIdempotency(idempotencyKey, this.idempotencyCache, async () => {
      const response = await withRetries(() => this.adapter.pullCredit(payload));
      const mapped = mapFromAdapterResponse(request, response);
      this.results.set(mapped.requestId, mapped);
      return { status: 202, body: acknowledgementFromResult(mapped) };
    });

    return result.body as CreditPullAcknowledgement;
  }

  async getResult(requestId: string): Promise<CreditPullResult | undefined> {
    const existing = this.results.get(requestId);
    if (existing) {
      return existing;
    }

    const fromAdapter = await this.adapter.getPull(requestId);
    if (!fromAdapter) {
      return undefined;
    }

    const reconstructed: CreditPullResult = {
      requestId: fromAdapter.pullReference,
      status: fromAdapter.status,
      borrowerId: fromAdapter.pullReference.split('-')[0],
      tradelines: fromAdapter.tradelines,
      score: fromAdapter.score,
      refreshedAt: fromAdapter.refreshedAt,
    };
    this.results.set(reconstructed.requestId, reconstructed);
    return reconstructed;
  }
}
