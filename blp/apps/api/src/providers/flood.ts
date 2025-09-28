import { ProviderContext, VendorError, VendorHttpClient, VendorEventName } from './base';

export interface FloodOrderResponse {
  determination: 'zone_a' | 'zone_x' | 'zone_unknown';
  reportUrl: string;
  rawVendorResponse: unknown;
}

export interface FloodProvider {
  order(ctx: ProviderContext): Promise<FloodOrderResponse>;
}

export class MockFloodProvider implements FloodProvider {
  async order(ctx: ProviderContext): Promise<FloodOrderResponse> {
    return {
      determination: 'zone_x',
      reportUrl: `https://mock-storage/${ctx.tenantId}/${ctx.loanId}/flood/determination.pdf`,
      rawVendorResponse: { mock: true },
    };
  }
}

export class RealFloodProvider implements FloodProvider {
  constructor(private readonly client: VendorHttpClient) {}

  async order(ctx: ProviderContext): Promise<FloodOrderResponse> {
    const { data } = await this.client.call<ExternalFloodRequest, FloodOrderResponse>(
      {
        ctx,
        vendor: 'flood',
        operation: 'order',
        idempotencyKey: `flood:order:${ctx.loanId}`,
        request: { correlationId: ctx.correlationId },
        path: '/flood/determination',
      },
      {
        response: (payload) => normalizeFloodResponse(payload as ExternalFloodResponse),
        successEvent: {
          name: 'order.status.changed' as VendorEventName,
          payload: (response) => ({
            tenantId: ctx.tenantId,
            loanId: ctx.loanId,
            vendor: 'flood',
            determination: response.determination,
            reportUrl: response.reportUrl,
          }),
        },
      },
    );

    return data;
  }
}

interface ExternalFloodRequest {
  correlationId: string;
}

interface ExternalFloodResponse {
  determination: FloodOrderResponse['determination'];
  reportUrl: string;
  rawVendorResponse?: unknown;
}

function normalizeFloodResponse(payload: ExternalFloodResponse): FloodOrderResponse {
  return {
    determination: payload.determination,
    reportUrl: payload.reportUrl,
    rawVendorResponse: payload.rawVendorResponse ?? payload,
  };
}
