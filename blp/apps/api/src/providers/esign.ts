import { callWithRetry, ProviderContext, VendorError } from './base';

export interface ESignGenerateRequest {
  templateCode: string;
  recipients: Array<{
    role: string;
    name: string;
    email: string;
  }>;
  documents: string[];
}

export interface ESignEnvelope {
  envelopeId: string;
  status: 'created' | 'sent' | 'completed';
  redirectUrl?: string;
  rawVendorResponse: unknown;
}

export interface ESignProvider {
  generate(ctx: ProviderContext, request: ESignGenerateRequest): Promise<ESignEnvelope>;
  send(ctx: ProviderContext, envelopeId: string): Promise<ESignEnvelope>;
}

export class MockESignProvider implements ESignProvider {
  async generate(ctx: ProviderContext, request: ESignGenerateRequest): Promise<ESignEnvelope> {
    if (!request.templateCode) {
      const error: VendorError = Object.assign(new Error('Template code is required'), {
        code: 'TEMPLATE_REQUIRED',
        retryable: false,
      });
      throw error;
    }

    return {
      envelopeId: `${ctx.loanId}-ESIGN-${Date.now()}`,
      status: 'created',
      redirectUrl: `https://esign.mock/${ctx.loanId}`,
      rawVendorResponse: { mock: true },
    };
  }

  async send(ctx: ProviderContext, envelopeId: string): Promise<ESignEnvelope> {
    return {
      envelopeId,
      status: 'sent',
      rawVendorResponse: { mock: true, tenantId: ctx.tenantId },
    };
  }
}

export class AdapterBackedESignProvider implements ESignProvider {
  constructor(private readonly httpCall: (payload: unknown) => Promise<ResponseLike>) {}

  async generate(ctx: ProviderContext, request: ESignGenerateRequest): Promise<ESignEnvelope> {
    const response = await callWithRetry(() => this.httpCall({ ctx, request, action: 'generate' }), {
      maxAttempts: ctx.mockMode ? 1 : 3,
      baseDelayMs: 500,
    });

    if (response.status >= 400) {
      const error: VendorError = Object.assign(new Error('E-sign provider error'), {
        code: `HTTP_${response.status}`,
        http: response.status,
        retryable: response.status >= 500,
      });
      throw error;
    }

    return response.json() as Promise<ESignEnvelope>;
  }

  async send(ctx: ProviderContext, envelopeId: string): Promise<ESignEnvelope> {
    const response = await callWithRetry(() => this.httpCall({ ctx, envelopeId, action: 'send' }), {
      maxAttempts: ctx.mockMode ? 1 : 3,
      baseDelayMs: 500,
    });

    if (response.status >= 400) {
      const error: VendorError = Object.assign(new Error('E-sign provider error'), {
        code: `HTTP_${response.status}`,
        http: response.status,
        retryable: response.status >= 500,
      });
      throw error;
    }

    return response.json() as Promise<ESignEnvelope>;
  }
}

interface ResponseLike {
  status: number;
  json(): Promise<ESignEnvelope>;
}
