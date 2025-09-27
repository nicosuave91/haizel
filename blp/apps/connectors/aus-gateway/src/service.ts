import {
  AUSAdapterPayload,
  AUSAdapterResponse,
  AUSDecision,
  AUSSubmissionRequest,
  mapFromAdapterResponse,
  mapToAdapterPayload,
} from './mappers';

export interface AUSAdapter {
  submit(payload: AUSAdapterPayload): Promise<AUSAdapterResponse>;
}

class MockAUSAdapter implements AUSAdapter {
  async submit(payload: AUSAdapterPayload): Promise<AUSAdapterResponse> {
    if (payload.fico < 620) {
      return {
        decisionCode: 'MANUAL',
        reasons: ['Credit score below automated threshold'],
      };
    }

    if (payload.debtToIncome > 0.5 || payload.loanToValue > 0.9) {
      return {
        decisionCode: 'REFER',
        reasons: ['High DTI or LTV'],
      };
    }

    return {
      decisionCode: 'APPROVED',
      reasons: [],
    };
  }
}

export class AUSGatewayService {
  constructor(private readonly adapter: AUSAdapter = new MockAUSAdapter()) {}

  async submitCase(request: AUSSubmissionRequest): Promise<AUSDecision> {
    const payload = mapToAdapterPayload(request);
    const response = await this.adapter.submit(payload);
    return mapFromAdapterResponse(request, response);
  }
}
