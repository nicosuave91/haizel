import { callWithRetry, ProviderContext, VendorError } from './base';

export interface MortgageInsuranceQuoteRequest {
  coveragePercent: number;
  amortizationTermMonths: number;
  productCode: string;
}

export interface MortgageInsuranceQuoteResponse {
  quoteId: string;
  premiumCents: number;
  rateBps: number;
  rawVendorResponse: unknown;
}

export interface MortgageInsuranceProvider {
  quote(ctx: ProviderContext, request: MortgageInsuranceQuoteRequest): Promise<MortgageInsuranceQuoteResponse>;
}

export class MockMortgageInsuranceProvider implements MortgageInsuranceProvider {
  async quote(ctx: ProviderContext, request: MortgageInsuranceQuoteRequest): Promise<MortgageInsuranceQuoteResponse> {
    if (request.coveragePercent <= 0) {
      const error: VendorError = Object.assign(new Error('Coverage percent must be positive'), {
        code: 'INVALID_COVERAGE',
        retryable: false,
      });
      throw error;
    }

    return {
      quoteId: `${ctx.loanId}-MI-${Date.now()}`,
      premiumCents: Math.round(request.coveragePercent * 1250),
      rateBps: 45,
      rawVendorResponse: { mock: true },
    };
  }
}

export class AdapterBackedMortgageInsuranceProvider implements MortgageInsuranceProvider {
  constructor(private readonly httpCall: (payload: unknown) => Promise<ResponseLike>) {}

  async quote(ctx: ProviderContext, request: MortgageInsuranceQuoteRequest): Promise<MortgageInsuranceQuoteResponse> {
    const response = await callWithRetry(() => this.httpCall({ ctx, request }), {
      maxAttempts: ctx.mockMode ? 1 : 3,
      baseDelayMs: 450,
    });

    if (response.status >= 400) {
      const error: VendorError = Object.assign(new Error('MI provider error'), {
        code: `HTTP_${response.status}`,
        http: response.status,
        retryable: response.status >= 500,
      });
      throw error;
    }

    return response.json() as Promise<MortgageInsuranceQuoteResponse>;
  }
}

interface ResponseLike {
  status: number;
  json(): Promise<MortgageInsuranceQuoteResponse>;
}
