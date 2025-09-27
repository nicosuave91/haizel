import {
  AUSAdapterPayload,
  AUSAdapterResponse,
  AUSDecision,
  AUSSubmissionRequest,
  mapFromAdapterResponse,
  mapToAdapterPayload,
} from './mappers';
import {
  getVaultSecretPlaceholder,
  handleWithIdempotency,
  IdempotencyCache,
  withRetries,
} from '@haizel/connectors-shared';

export interface AUSAdapter {
  submit(payload: AUSAdapterPayload): Promise<AUSAdapterResponse>;
}

class MockAUSAdapter implements AUSAdapter {
  async submit(payload: AUSAdapterPayload): Promise<AUSAdapterResponse> {
    if (payload.fico < 620) {
      return {
        decisionCode: 'MANUAL',
        reasons: ['Credit score below automated threshold'],
        receivedAt: new Date().toISOString(),
      };
    }

    if (payload.debtToIncome > 0.5 || payload.loanToValue > 0.9) {
      return {
        decisionCode: 'REFER',
        reasons: ['High DTI or LTV'],
        receivedAt: new Date().toISOString(),
      };
    }

    return {
      decisionCode: 'APPROVED',
      reasons: [],
      receivedAt: new Date().toISOString(),
    };
  }
}

export class AUSGatewayService {
  private readonly decisions = new Map<string, AUSDecision>();

  private readonly idempotencyCache = new IdempotencyCache();

  private readonly config = {
    endpoint: process.env.AUS_API_URL ?? 'https://mock-aus.local',
    apiKey: getVaultSecretPlaceholder('secret/data/connectors/aus', 'AUS_API_KEY'),
  };

  constructor(private readonly adapter: AUSAdapter = new MockAUSAdapter()) {}

  async submitCase(request: AUSSubmissionRequest, idempotencyKey?: string): Promise<AUSDecision> {
    const payload = mapToAdapterPayload(request);
    const result = await handleWithIdempotency(idempotencyKey, this.idempotencyCache, async () => {
      const response = await withRetries(() => this.adapter.submit(payload));
      const mapped = mapFromAdapterResponse(request, response);
      this.decisions.set(mapped.loanId, mapped);
      return { status: 200, body: mapped };
    });

    return result.body as AUSDecision;
  }

  getDecision(loanId: string): AUSDecision | undefined {
    return this.decisions.get(loanId);
  }
}
