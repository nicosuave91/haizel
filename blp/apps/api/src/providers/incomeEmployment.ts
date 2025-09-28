import { ProviderContext, VendorError, VendorHttpClient, VendorEventName } from './base';

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

export class RealIncomeEmploymentProvider implements IncomeEmploymentProvider {
  constructor(private readonly client: VendorHttpClient) {}

  async verify(ctx: ProviderContext, input: IncomeEmploymentProviderRequest): Promise<IncomeEmploymentProviderResponse> {
    if (!input.consentToken) {
      const error: VendorError = Object.assign(new Error('Missing consent token'), {
        code: 'CONSENT_MISSING',
        retryable: false,
      });
      throw error;
    }

    const { data } = await this.client.call<ExternalIncomeEmploymentRequest, IncomeEmploymentProviderResponse>(
      {
        ctx,
        vendor: 'income_employment',
        operation: 'verify',
        idempotencyKey: `income:verify:${ctx.loanId}:${input.consentToken}`,
        request: input,
        path: '/income/employment/verify',
        redactFields: ['ssn'],
      },
      {
        request: (payload) => ({
          correlationId: ctx.correlationId,
          consentToken: payload.consentToken,
          employerHint: payload.employerHint,
          payrollProvider: payload.payrollProvider,
        }),
        response: (payload) => normalizeIncomeResponse(payload as ExternalIncomeEmploymentResponse),
        successEvent: {
          name: 'verification.completed' as VendorEventName,
          payload: (response) => ({
            tenantId: ctx.tenantId,
            loanId: ctx.loanId,
            vendor: 'income_employment',
            employmentStatus: response.employmentStatus,
          }),
        },
      },
    );

    return data;
  }
}

interface ExternalIncomeEmploymentRequest {
  correlationId: string;
  consentToken: string;
  employerHint?: string;
  payrollProvider?: string;
}

interface ExternalIncomeEmploymentResponse {
  employmentStatus: IncomeEmploymentProviderResponse['employmentStatus'];
  incomeStreams: IncomeEmploymentProviderResponse['incomeStreams'];
  rawVendorResponse?: unknown;
}

function normalizeIncomeResponse(
  payload: ExternalIncomeEmploymentResponse,
): IncomeEmploymentProviderResponse {
  return {
    employmentStatus: payload.employmentStatus,
    incomeStreams: payload.incomeStreams,
    rawVendorResponse: payload.rawVendorResponse ?? payload,
  };
}
