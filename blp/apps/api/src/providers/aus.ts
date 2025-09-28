import { ProviderContext, VendorError, VendorHttpClient, VendorEventName } from './base';

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

export class RealAutomatedUnderwritingProvider implements AutomatedUnderwritingProvider {
  constructor(private readonly client: VendorHttpClient) {}

  async submit(ctx: ProviderContext, request: AUSSubmitRequest): Promise<AUSSubmitResponse> {
    const { data } = await this.client.call<
      AUSSubmitRequest,
      ExternalAusSubmitRequest,
      AUSSubmitResponse
    >(
      {
        ctx,
        vendor: 'aus',
        operation: 'submit',
        idempotencyKey: `aus:submit:${ctx.loanId}:${request.system}`,
        request,
        path: '/aus/submit',
      },
      {
        request: (payload) => ({
          correlationId: ctx.correlationId,
          system: payload.system,
          overrideReason: payload.overrideReason,
          documents: payload.documents ?? [],
        }),
        response: (payload) => normalizeAusResponse(payload as ExternalAusSubmitResponse),
        successEvent: {
          name: 'aus.findings.available' as VendorEventName,
          payload: (response) => ({
            tenantId: ctx.tenantId,
            loanId: ctx.loanId,
            vendor: 'aus',
            decision: response.decision,
            conditionCount: response.conditions.length,
          }),
        },
      },
    );

    return data;
  }
}

interface ExternalAusSubmitRequest {
  correlationId: string;
  system: 'DU' | 'LPA';
  overrideReason?: string;
  documents: string[];
}

interface ExternalAusSubmitResponse {
  decision: AUSSubmitResponse['decision'];
  conditions: AUSSubmitResponse['conditions'];
  rawVendorResponse?: unknown;
}

function normalizeAusResponse(payload: ExternalAusSubmitResponse): AUSSubmitResponse {
  return {
    decision: payload.decision,
    conditions: payload.conditions,
    rawVendorResponse: payload.rawVendorResponse ?? payload,
  };
}
