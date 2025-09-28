import {
  ProviderContext,
  VendorError,
  VendorHttpClient,
  VendorEventName,
  redactPayload,
} from './base';

export interface CreditProviderRequest {
  borrower: {
    firstName: string;
    lastName: string;
    ssn: string;
    dob: string;
    address: Record<string, unknown>;
  };
  coBorrower?: CreditProviderRequest['borrower'];
  consentToken: string;
}

export interface CreditProviderResponse {
  bureauFiles: {
    equifaxUrl: string;
    experianUrl: string;
    transunionUrl: string;
  };
  summary: {
    ficoClassic04: number;
    inquiries: number;
    tradelines: number;
  };
  rawVendorResponse: unknown;
}

export interface CreditProvider {
  triMerge(ctx: ProviderContext, input: CreditProviderRequest): Promise<CreditProviderResponse>;
}

export class MockCreditProvider implements CreditProvider {
  async triMerge(ctx: ProviderContext, input: CreditProviderRequest): Promise<CreditProviderResponse> {
    if (!input.consentToken) {
      const error: VendorError = Object.assign(new Error('Missing consent token'), {
        code: 'CONSENT_MISSING',
        retryable: false,
      });
      throw error;
    }

    return {
      bureauFiles: {
        equifaxUrl: `https://mock-storage/${ctx.tenantId}/${ctx.loanId}/credit/equifax.pdf`,
        experianUrl: `https://mock-storage/${ctx.tenantId}/${ctx.loanId}/credit/experian.pdf`,
        transunionUrl: `https://mock-storage/${ctx.tenantId}/${ctx.loanId}/credit/transunion.pdf`,
      },
      summary: {
        ficoClassic04: 742,
        inquiries: 2,
        tradelines: 9,
      },
      rawVendorResponse: { mock: true },
    };
  }
}

export class RealCreditProvider implements CreditProvider {
  constructor(private readonly client: VendorHttpClient) {}

  async triMerge(ctx: ProviderContext, input: CreditProviderRequest): Promise<CreditProviderResponse> {
    if (!input.consentToken) {
      const error: VendorError = Object.assign(new Error('Missing consent token'), {
        code: 'CONSENT_MISSING',
        retryable: false,
      });
      throw error;
    }

    const idempotencyKey = `credit:tri-merge:${ctx.loanId}:${input.consentToken}`;
    const { data } = await this.client.call<ExternalCreditRequest, CreditProviderResponse>(
      {
        ctx,
        vendor: 'credit',
        operation: 'triMerge',
        idempotencyKey,
        request: input,
        path: '/credit/tri-merge',
        redactFields: ['ssn', 'dob'],
      },
      {
        request: (payload) =>
          serializeRequest(ctx, {
            ...payload,
            borrower: {
              ...payload.borrower,
              ssn: payload.borrower.ssn,
            },
          }),
        response: (payload): CreditProviderResponse => normalizeResponse(payload as ExternalCreditResponse),
        successEvent: {
          name: 'verification.completed' as VendorEventName,
          payload: (response) => ({
            tenantId: ctx.tenantId,
            loanId: ctx.loanId,
            vendor: 'credit',
            summary: response.summary,
          }),
        },
        onSuccess: async (_, raw) => {
          void redactPayload(raw, ['ssn', 'dob']);
        },
      },
    );

    return data;
  }
}

interface ExternalCreditRequest {
  correlationId: string;
  borrower: CreditProviderRequest['borrower'];
  coBorrower?: CreditProviderRequest['borrower'];
  consentToken: string;
  options?: CreditProviderRequest['options'];
}

interface ExternalCreditResponse {
  bureauFiles: CreditProviderResponse['bureauFiles'];
  summary: CreditProviderResponse['summary'];
  rawVendorResponse: unknown;
}

function serializeRequest(ctx: ProviderContext, input: ExternalCreditRequest) {
  return {
    correlationId: ctx.correlationId,
    payload: input,
  };
}

function normalizeResponse(payload: ExternalCreditResponse): CreditProviderResponse {
  return {
    bureauFiles: payload.bureauFiles,
    summary: payload.summary,
    rawVendorResponse: payload.rawVendorResponse ?? payload,
  };
}
