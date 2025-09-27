import { callWithRetry, ProviderContext, VendorError } from './base';

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

export class AdapterBackedAssetVerificationProvider implements AssetVerificationProvider {
  constructor(private readonly httpCall: (payload: unknown) => Promise<ResponseLike>) {}

  async verify(ctx: ProviderContext, input: AssetVerificationProviderRequest): Promise<AssetVerificationProviderResponse> {
    if (!input.consentToken) {
      const error: VendorError = Object.assign(new Error('Missing consent token'), {
        code: 'CONSENT_MISSING',
        retryable: false,
      });
      throw error;
    }

    const response = await callWithRetry(() => this.httpCall({ ctx, input }), {
      maxAttempts: ctx.mockMode ? 1 : 4,
      baseDelayMs: 350,
    });

    if (response.status >= 400) {
      const error: VendorError = Object.assign(new Error('Asset provider error'), {
        code: `HTTP_${response.status}`,
        http: response.status,
        retryable: response.status >= 500,
      });
      throw error;
    }

    return response.json() as Promise<AssetVerificationProviderResponse>;
  }
}

interface ResponseLike {
  status: number;
  json(): Promise<AssetVerificationProviderResponse>;
}
