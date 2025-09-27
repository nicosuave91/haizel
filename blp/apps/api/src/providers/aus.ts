import { callWithRetry, ProviderContext, VendorError } from './base';

export interface AUSSubmitRequest {
  system: 'DU' | 'LPA';
  overrideReason?: string;
  documents?: string[];
}

export interface AUSSubmitResponse {
  decision: 'APPROVED_ELIGIBLE' | 'REFER_WITH_CAUTION' | 'OUT_OF_SCOPE';
  conditions: Array<{
    code: string;
    description: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
  }>;
  rawVendorResponse: unknown;
}

export interface AutomatedUnderwritingProvider {
  submit(ctx: ProviderContext, request: AUSSubmitRequest): Promise<AUSSubmitResponse>;
}

export class MockAutomatedUnderwritingProvider implements AutomatedUnderwritingProvider {
  async submit(ctx: ProviderContext, request: AUSSubmitRequest): Promise<AUSSubmitResponse> {
    return {
      decision: request.overrideReason ? 'REFER_WITH_CAUTION' : 'APPROVED_ELIGIBLE',
      conditions: [
        {
          code: 'AUS-VOE-001',
          description: 'Provide written VOE for 24 months',
          severity: 'critical',
        },
        {
          code: 'AUS-ASSET-002',
          description: 'Two months bank statements',
          severity: 'medium',
        },
      ],
      rawVendorResponse: { mock: true },
    };
  }
}

export class AdapterBackedAutomatedUnderwritingProvider implements AutomatedUnderwritingProvider {
  constructor(private readonly httpCall: (payload: unknown) => Promise<ResponseLike>) {}

  async submit(ctx: ProviderContext, request: AUSSubmitRequest): Promise<AUSSubmitResponse> {
    const response = await callWithRetry(() => this.httpCall({ ctx, request }), {
      maxAttempts: ctx.mockMode ? 1 : 3,
      baseDelayMs: 600,
    });

    if (response.status >= 400) {
      const error: VendorError = Object.assign(new Error('AUS provider error'), {
        code: `HTTP_${response.status}`,
        http: response.status,
        retryable: response.status >= 500,
      });
      throw error;
    }

    return response.json() as Promise<AUSSubmitResponse>;
  }
}

interface ResponseLike {
  status: number;
  json(): Promise<AUSSubmitResponse>;
}
