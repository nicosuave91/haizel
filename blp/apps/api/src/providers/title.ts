import { callWithRetry, ProviderContext, VendorError } from './base';

export interface TitleOpenRequest {
  settlementAgent: string;
  notes?: string;
}

export interface TitleCurativeTask {
  code: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'open' | 'waived' | 'met';
}

export interface TitleOrderResponse {
  orderId: string;
  status: 'opened' | 'in_curative' | 'clear';
  curativeTasks: TitleCurativeTask[];
  rawVendorResponse: unknown;
}

export interface TitleProvider {
  open(ctx: ProviderContext, request: TitleOpenRequest): Promise<TitleOrderResponse>;
  recordCurative(ctx: ProviderContext, orderId: string, tasks: TitleCurativeTask[]): Promise<TitleOrderResponse>;
}

export class MockTitleProvider implements TitleProvider {
  async open(ctx: ProviderContext, request: TitleOpenRequest): Promise<TitleOrderResponse> {
    if (!request.settlementAgent) {
      const error: VendorError = Object.assign(new Error('Settlement agent required'), {
        code: 'SETTLEMENT_AGENT_REQUIRED',
        retryable: false,
      });
      throw error;
    }

    return {
      orderId: `${ctx.loanId}-TITLE-${Date.now()}`,
      status: 'opened',
      curativeTasks: [],
      rawVendorResponse: { mock: true },
    };
  }

  async recordCurative(ctx: ProviderContext, orderId: string, tasks: TitleCurativeTask[]): Promise<TitleOrderResponse> {
    return {
      orderId,
      status: tasks.some((task) => task.status !== 'met') ? 'in_curative' : 'clear',
      curativeTasks: tasks,
      rawVendorResponse: { mock: true, tenantId: ctx.tenantId },
    };
  }
}

export class AdapterBackedTitleProvider implements TitleProvider {
  constructor(private readonly httpCall: (payload: unknown) => Promise<ResponseLike>) {}

  async open(ctx: ProviderContext, request: TitleOpenRequest): Promise<TitleOrderResponse> {
    const response = await callWithRetry(() => this.httpCall({ ctx, request, action: 'open' }), {
      maxAttempts: ctx.mockMode ? 1 : 3,
      baseDelayMs: 600,
    });

    if (response.status >= 400) {
      const error: VendorError = Object.assign(new Error('Title provider error'), {
        code: `HTTP_${response.status}`,
        http: response.status,
        retryable: response.status >= 500,
      });
      throw error;
    }

    return response.json() as Promise<TitleOrderResponse>;
  }

  async recordCurative(ctx: ProviderContext, orderId: string, tasks: TitleCurativeTask[]): Promise<TitleOrderResponse> {
    const response = await callWithRetry(() => this.httpCall({ ctx, orderId, tasks, action: 'curative' }), {
      maxAttempts: ctx.mockMode ? 1 : 3,
      baseDelayMs: 600,
    });

    if (response.status >= 400) {
      const error: VendorError = Object.assign(new Error('Title provider error'), {
        code: `HTTP_${response.status}`,
        http: response.status,
        retryable: response.status >= 500,
      });
      throw error;
    }

    return response.json() as Promise<TitleOrderResponse>;
  }
}

interface ResponseLike {
  status: number;
  json(): Promise<TitleOrderResponse>;
}
