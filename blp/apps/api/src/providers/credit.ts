import { callWithRetry, ProviderContext, VendorCallRecord, VendorError } from './base';

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

    const record: VendorCallRecord = {
      id: cryptoRandomId(),
      request: input,
      status: 'succeeded',
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      retryCount: 0,
    };
    void record; // would persist to vendor_calls repository

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

export class AdapterBackedCreditProvider implements CreditProvider {
  constructor(private readonly httpCall: (payload: unknown) => Promise<ResponseLike>) {}

  async triMerge(ctx: ProviderContext, input: CreditProviderRequest): Promise<CreditProviderResponse> {
    if (!input.consentToken) {
      const error: VendorError = Object.assign(new Error('Missing consent token'), {
        code: 'CONSENT_MISSING',
        retryable: false,
      });
      throw error;
    }

    const response = await callWithRetry(() => this.httpCall(serializeRequest(ctx, input)), {
      maxAttempts: ctx.mockMode ? 1 : 3,
      baseDelayMs: 500,
    });

    if (response.status >= 400) {
      const error: VendorError = Object.assign(new Error('Credit provider error'), {
        code: `HTTP_${response.status}`,
        http: response.status,
        retryable: response.status >= 500,
      });
      throw error;
    }

    return normalizeResponse(await response.json());
  }
}

interface ResponseLike {
  status: number;
  json(): Promise<unknown>;
}

function serializeRequest(ctx: ProviderContext, input: CreditProviderRequest) {
  return {
    correlationId: ctx.correlationId,
    payload: input,
  };
}

function normalizeResponse(payload: any): CreditProviderResponse {
  return {
    bureauFiles: payload.bureauFiles,
    summary: payload.summary,
    rawVendorResponse: payload,
  };
}

function cryptoRandomId(): string {
  return Math.random().toString(36).slice(2);
}
