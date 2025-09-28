import { ProviderContext, VendorError, VendorHttpClient, VendorEventName } from './base';

export interface AssetVerificationProviderRequest {
  consentToken: string;
  institutionHints?: string[];
}

export interface AssetVerificationProviderResponse {
  accounts: Array<{
    institution: string;
    accountType: string;
    currentBalanceCents: number;
    averageBalanceCents: number;
    statements: string[];
  }>;
  rawVendorResponse: unknown;
}

export interface AssetVerificationProvider {
  verify(ctx: ProviderContext, input: AssetVerificationProviderRequest): Promise<AssetVerificationProviderResponse>;
}

export class MockAssetVerificationProvider implements AssetVerificationProvider {
  async verify(ctx: ProviderContext, input: AssetVerificationProviderRequest): Promise<AssetVerificationProviderResponse> {
    if (!input.consentToken) {
      const error: VendorError = Object.assign(new Error('Missing consent token'), {
        code: 'CONSENT_MISSING',
        retryable: false,
      });
      throw error;
    }

    return {
      accounts: [
        {
          institution: 'Plaid Bank',
          accountType: 'checking',
          currentBalanceCents: 5823000,
          averageBalanceCents: 5120000,
          statements: [
            `https://mock-storage/${ctx.tenantId}/${ctx.loanId}/assets/statement-1.pdf`,
          ],
        },
      ],
      rawVendorResponse: { mock: true },
    };
  }
}

export class RealAssetVerificationProvider implements AssetVerificationProvider {
  constructor(private readonly client: VendorHttpClient) {}

  async verify(ctx: ProviderContext, input: AssetVerificationProviderRequest): Promise<AssetVerificationProviderResponse> {
    if (!input.consentToken) {
      const error: VendorError = Object.assign(new Error('Missing consent token'), {
        code: 'CONSENT_MISSING',
        retryable: false,
      });
      throw error;
    }

    const { data } = await this.client.call<ExternalAssetRequest, AssetVerificationProviderResponse>(
      {
        ctx,
        vendor: 'assets',
        operation: 'refresh',
        idempotencyKey: `assets:refresh:${ctx.loanId}:${input.consentToken}`,
        request: input,
        path: '/assets/refresh',
        redactFields: ['accountNumber', 'routingNumber'],
      },
      {
        request: (payload) => ({
          correlationId: ctx.correlationId,
          consentToken: payload.consentToken,
          institutionHints: payload.institutionHints ?? [],
        }),
        response: (payload) => normalizeAssetResponse(payload as ExternalAssetResponse),
        successEvent: {
          name: 'verification.completed' as VendorEventName,
          payload: (response) => ({
            tenantId: ctx.tenantId,
            loanId: ctx.loanId,
            vendor: 'assets',
            accountCount: response.accounts.length,
          }),
        },
      },
    );

    return data;
  }
}

interface ExternalAssetRequest {
  correlationId: string;
  consentToken: string;
  institutionHints: string[];
}

interface ExternalAssetResponse {
  accounts: AssetVerificationProviderResponse['accounts'];
  rawVendorResponse?: unknown;
}

function normalizeAssetResponse(payload: ExternalAssetResponse): AssetVerificationProviderResponse {
  return {
    accounts: payload.accounts,
    rawVendorResponse: payload.rawVendorResponse ?? payload,
  };
}
