import { ProviderContext, VendorError, VendorHttpClient, VendorEventName } from './base';

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

export class RealESignProvider implements ESignProvider {
  constructor(private readonly client: VendorHttpClient) {}

  async generate(ctx: ProviderContext, request: ESignGenerateRequest): Promise<ESignEnvelope> {
    const { data } = await this.client.call<
      ESignGenerateRequest,
      ExternalESignGenerateRequest,
      ESignEnvelope
    >(
      {
        ctx,
        vendor: 'esign',
        operation: 'generate',
        idempotencyKey: `esign:generate:${ctx.loanId}:${request.templateCode}`,
        request,
        path: '/esign/envelopes',
      },
      {
        request: (payload) => ({
          correlationId: ctx.correlationId,
          templateCode: payload.templateCode,
          recipients: payload.recipients,
          documents: payload.documents,
        }),
        response: (payload) => normalizeEnvelope(payload as ExternalEnvelopeResponse),
        successEvent: {
          name: 'order.status.changed' as VendorEventName,
          payload: (response) => ({
            tenantId: ctx.tenantId,
            loanId: ctx.loanId,
            vendor: 'esign',
            envelopeId: response.envelopeId,
            status: response.status,
          }),
        },
      },
    );

    return data;
  }

  async send(ctx: ProviderContext, envelopeId: string): Promise<ESignEnvelope> {
    const { data } = await this.client.call<
      { envelopeId: string },
      ExternalESignSendRequest,
      ESignEnvelope
    >(
      {
        ctx,
        vendor: 'esign',
        operation: 'send',
        idempotencyKey: `esign:send:${ctx.loanId}:${envelopeId}`,
        request: { envelopeId },
        path: `/esign/envelopes/${envelopeId}/send`,
      },
      {
        request: (payload) => ({
          correlationId: ctx.correlationId,
          envelopeId: payload.envelopeId,
        }),
        response: (payload) => normalizeEnvelope(payload as ExternalEnvelopeResponse),
        successEvent: {
          name: 'order.status.changed' as VendorEventName,
          payload: (response) => ({
            tenantId: ctx.tenantId,
            loanId: ctx.loanId,
            vendor: 'esign',
            envelopeId: response.envelopeId,
            status: response.status,
          }),
        },
      },
    );

    return data;
  }
}

interface ExternalESignGenerateRequest {
  correlationId: string;
  templateCode: string;
  recipients: ESignGenerateRequest['recipients'];
  documents: string[];
}

interface ExternalESignSendRequest {
  correlationId: string;
  envelopeId: string;
}

interface ExternalEnvelopeResponse {
  envelopeId: string;
  status: ESignEnvelope['status'];
  redirectUrl?: string;
  rawVendorResponse?: unknown;
}

function normalizeEnvelope(payload: ExternalEnvelopeResponse): ESignEnvelope {
  return {
    envelopeId: payload.envelopeId,
    status: payload.status,
    redirectUrl: payload.redirectUrl,
    rawVendorResponse: payload.rawVendorResponse ?? payload,
  };
}
