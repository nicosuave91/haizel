import { callWithRetry, ProviderContext, VendorError } from './base';

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

export class AdapterBackedAMCProvider implements AppraisalManagementCompanyProvider {
  constructor(private readonly httpCall: (payload: unknown) => Promise<ResponseLike>) {}

  async order(ctx: ProviderContext, request: AppraisalOrderRequest): Promise<AppraisalOrderResponse> {
    const response = await callWithRetry(() => this.httpCall({ ctx, request }), {
      maxAttempts: ctx.mockMode ? 1 : 3,
      baseDelayMs: 500,
    });

    if (response.status >= 400) {
      const error: VendorError = Object.assign(new Error('AMC provider error'), {
        code: `HTTP_${response.status}`,
        http: response.status,
        retryable: response.status >= 500,
      });
      throw error;
    }

    return response.json() as Promise<AppraisalOrderResponse>;
  }
}

interface ResponseLike {
  status: number;
  json(): Promise<AppraisalOrderResponse>;
}
