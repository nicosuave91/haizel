import { ProviderContext, VendorError, VendorHttpClient, VendorEventName } from './base';

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

export class RealTitleProvider implements TitleProvider {
  constructor(private readonly client: VendorHttpClient) {}

  async open(ctx: ProviderContext, request: TitleOpenRequest): Promise<TitleOrderResponse> {
    const { data } = await this.client.call<
      TitleOpenRequest,
      ExternalTitleOpenRequest,
      TitleOrderResponse
    >(
      {
        ctx,
        vendor: 'title',
        operation: 'open',
        idempotencyKey: `title:open:${ctx.loanId}`,
        request,
        path: '/title/open',
      },
      {
        request: (payload) => ({
          correlationId: ctx.correlationId,
          settlementAgent: payload.settlementAgent,
          notes: payload.notes,
        }),
        response: (payload) => normalizeTitleResponse(payload as ExternalTitleResponse),
        successEvent: {
          name: 'order.status.changed' as VendorEventName,
          payload: (response) => ({
            tenantId: ctx.tenantId,
            loanId: ctx.loanId,
            vendor: 'title',
            orderId: response.orderId,
            status: response.status,
          }),
        },
      },
    );

    return data;
  }

  async recordCurative(ctx: ProviderContext, orderId: string, tasks: TitleCurativeTask[]): Promise<TitleOrderResponse> {
    const { data } = await this.client.call<
      { orderId: string; tasks: TitleCurativeTask[] },
      ExternalTitleCurativeRequest,
      TitleOrderResponse
    >(
      {
        ctx,
        vendor: 'title',
        operation: 'curative',
        idempotencyKey: `title:curative:${ctx.loanId}:${orderId}`,
        request: { orderId, tasks },
        path: `/title/${orderId}/curative`,
      },
      {
        request: (payload) => ({
          correlationId: ctx.correlationId,
          orderId: payload.orderId,
          tasks: payload.tasks,
        }),
        response: (payload) => normalizeTitleResponse(payload as ExternalTitleResponse),
        successEvent: {
          name: 'order.status.changed' as VendorEventName,
          payload: (response) => ({
            tenantId: ctx.tenantId,
            loanId: ctx.loanId,
            vendor: 'title',
            orderId: response.orderId,
            status: response.status,
          }),
        },
      },
    );

    return data;
  }
}

interface ExternalTitleOpenRequest {
  correlationId: string;
  settlementAgent: string;
  notes?: string;
}

interface ExternalTitleCurativeRequest {
  correlationId: string;
  orderId: string;
  tasks: TitleCurativeTask[];
}

interface ExternalTitleResponse {
  orderId: string;
  status: TitleOrderResponse['status'];
  curativeTasks: TitleCurativeTask[];
  rawVendorResponse?: unknown;
}

function normalizeTitleResponse(payload: ExternalTitleResponse): TitleOrderResponse {
  return {
    orderId: payload.orderId,
    status: payload.status,
    curativeTasks: payload.curativeTasks,
    rawVendorResponse: payload.rawVendorResponse ?? payload,
  };
}
