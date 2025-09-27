import { callWithRetry, ProviderContext, VendorError } from './base';

export interface IncomeEmploymentProviderRequest {
  consentToken: string;
  employerHint?: string;
  payrollProvider?: string;
}

export interface IncomeEmploymentProviderResponse {
  employmentStatus: 'verified' | 'unable_to_verify' | 'manual_review';
  incomeStreams: Array<{
    employerName: string;
    startDate: string;
    annualIncomeCents: number;
  }>;
  rawVendorResponse: unknown;
}

export interface IncomeEmploymentProvider {
  verify(ctx: ProviderContext, input: IncomeEmploymentProviderRequest): Promise<IncomeEmploymentProviderResponse>;
}

export class MockIncomeEmploymentProvider implements IncomeEmploymentProvider {
  async verify(ctx: ProviderContext, input: IncomeEmploymentProviderRequest): Promise<IncomeEmploymentProviderResponse> {
    if (!input.consentToken) {
      const error: VendorError = Object.assign(new Error('Missing consent token'), {
        code: 'CONSENT_MISSING',
        retryable: false,
      });
      throw error;
    }

    return {
      employmentStatus: 'verified',
      incomeStreams: [
        {
          employerName: 'Apex Robotics',
          startDate: '2018-03-01',
          annualIncomeCents: 13250000,
        },
      ],
      rawVendorResponse: { mock: true, tenantId: ctx.tenantId },
    };
  }
}

export class AdapterBackedIncomeEmploymentProvider implements IncomeEmploymentProvider {
  constructor(private readonly httpCall: (payload: unknown) => Promise<ResponseLike>) {}

  async verify(ctx: ProviderContext, input: IncomeEmploymentProviderRequest): Promise<IncomeEmploymentProviderResponse> {
    if (!input.consentToken) {
      const error: VendorError = Object.assign(new Error('Missing consent token'), {
        code: 'CONSENT_MISSING',
        retryable: false,
      });
      throw error;
    }

    const response = await callWithRetry(() => this.httpCall({ ctx, input }), {
      maxAttempts: ctx.mockMode ? 1 : 3,
      baseDelayMs: 400,
    });

    if (response.status >= 400) {
      const error: VendorError = Object.assign(new Error('Income provider error'), {
        code: `HTTP_${response.status}`,
        http: response.status,
        retryable: response.status >= 500,
      });
      throw error;
    }

    return response.json() as Promise<IncomeEmploymentProviderResponse>;
  }
}

interface ResponseLike {
  status: number;
  json(): Promise<IncomeEmploymentProviderResponse>;
}
