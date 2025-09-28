import { ProviderContext, VendorError, VendorHttpClient, VendorEventName } from './base';

export interface AppraisalOrderRequest {
  dueDate?: string;
  contact: {
    name: string;
    phone: string;
    email: string;
  };
  rush?: boolean;
}

export interface AppraisalOrderResponse {
  orderId: string;
  eta: string;
  status: 'ordered' | 'in_review' | 'delivered';
  rawVendorResponse: unknown;
}

export interface AppraisalManagementCompanyProvider {
  order(ctx: ProviderContext, request: AppraisalOrderRequest): Promise<AppraisalOrderResponse>;
}

export class MockAppraisalManagementCompanyProvider implements AppraisalManagementCompanyProvider {
  async order(ctx: ProviderContext, request: AppraisalOrderRequest): Promise<AppraisalOrderResponse> {
    if (!request.contact?.email) {
      const error: VendorError = Object.assign(new Error('Missing appraisal contact email'), {
        code: 'CONTACT_EMAIL_REQUIRED',
        retryable: false,
      });
      throw error;
    }

    return {
      orderId: `${ctx.loanId}-AMC-${Date.now()}`,
      eta: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'ordered',
      rawVendorResponse: { mock: true },
    };
  }
}

export class RealAppraisalManagementCompanyProvider implements AppraisalManagementCompanyProvider {
  constructor(private readonly client: VendorHttpClient) {}

  async order(ctx: ProviderContext, request: AppraisalOrderRequest): Promise<AppraisalOrderResponse> {
    const { data } = await this.client.call<AppraisalOrderRequest, ExternalAppraisalOrderRequest, AppraisalOrderResponse>(
      {
        ctx,
        vendor: 'amc',
        operation: 'order',
        idempotencyKey: `amc:order:${ctx.loanId}`,
        request,
        path: '/orders/appraisal',
      },
      {
        request: (payload) => ({
          correlationId: ctx.correlationId,
          dueDate: payload.dueDate,
          contact: payload.contact,
          rush: payload.rush ?? false,
        }),
        response: (payload) => normalizeAppraisalResponse(payload as ExternalAppraisalOrderResponse),
        successEvent: {
          name: 'order.status.changed' as VendorEventName,
          payload: (response) => ({
            tenantId: ctx.tenantId,
            loanId: ctx.loanId,
            vendor: 'amc',
            orderId: response.orderId,
            status: response.status,
            eta: response.eta,
          }),
        },
      },
    );

    return data;
  }
}

interface ExternalAppraisalOrderRequest {
  correlationId: string;
  dueDate?: string;
  contact: AppraisalOrderRequest['contact'];
  rush: boolean;
}

interface ExternalAppraisalOrderResponse {
  orderId: string;
  eta: string;
  status: AppraisalOrderResponse['status'];
  rawVendorResponse?: unknown;
}

function normalizeAppraisalResponse(payload: ExternalAppraisalOrderResponse): AppraisalOrderResponse {
  return {
    orderId: payload.orderId,
    eta: payload.eta,
    status: payload.status,
    rawVendorResponse: payload.rawVendorResponse ?? payload,
  };
}
