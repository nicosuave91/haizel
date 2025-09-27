import { callWithRetry, ProviderContext, VendorError } from './base';

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

export class AdapterBackedFloodProvider implements FloodProvider {
  constructor(private readonly httpCall: (payload: unknown) => Promise<ResponseLike>) {}

  async order(ctx: ProviderContext): Promise<FloodOrderResponse> {
    const response = await callWithRetry(() => this.httpCall({ ctx }), {
      maxAttempts: ctx.mockMode ? 1 : 3,
      baseDelayMs: 300,
    });

    if (response.status >= 400) {
      const error: VendorError = Object.assign(new Error('Flood provider error'), {
        code: `HTTP_${response.status}`,
        http: response.status,
        retryable: response.status >= 500,
      });
      throw error;
    }

    return response.json() as Promise<FloodOrderResponse>;
  }
}

interface ResponseLike {
  status: number;
  json(): Promise<FloodOrderResponse>;
}
