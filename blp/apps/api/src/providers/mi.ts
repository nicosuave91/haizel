import { ProviderContext, VendorError, VendorHttpClient, VendorEventName } from './base';

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

export class RealMortgageInsuranceProvider implements MortgageInsuranceProvider {
  constructor(private readonly client: VendorHttpClient) {}

  async quote(ctx: ProviderContext, request: MortgageInsuranceQuoteRequest): Promise<MortgageInsuranceQuoteResponse> {
    const { data } = await this.client.call<
      MortgageInsuranceQuoteRequest,
      ExternalMiQuoteRequest,
      MortgageInsuranceQuoteResponse
    >(
      {
        ctx,
        vendor: 'mi',
        operation: 'quote',
        idempotencyKey: `mi:quote:${ctx.loanId}:${request.productCode}`,
        request,
        path: '/mi/quotes',
      },
      {
        request: (payload) => ({
          correlationId: ctx.correlationId,
          coveragePercent: payload.coveragePercent,
          amortizationTermMonths: payload.amortizationTermMonths,
          productCode: payload.productCode,
        }),
        response: (payload) => normalizeMiResponse(payload as ExternalMiQuoteResponse),
        successEvent: {
          name: 'verification.completed' as VendorEventName,
          payload: (response) => ({
            tenantId: ctx.tenantId,
            loanId: ctx.loanId,
            vendor: 'mi',
            quoteId: response.quoteId,
            premiumCents: response.premiumCents,
          }),
        },
      },
    );

    return data;
  }
}

interface ExternalMiQuoteRequest {
  correlationId: string;
  coveragePercent: number;
  amortizationTermMonths: number;
  productCode: string;
}

interface ExternalMiQuoteResponse {
  quoteId: string;
  premiumCents: number;
  rateBps: number;
  rawVendorResponse?: unknown;
}

function normalizeMiResponse(payload: ExternalMiQuoteResponse): MortgageInsuranceQuoteResponse {
  return {
    quoteId: payload.quoteId,
    premiumCents: payload.premiumCents,
    rateBps: payload.rateBps,
    rawVendorResponse: payload.rawVendorResponse ?? payload,
  };
}
