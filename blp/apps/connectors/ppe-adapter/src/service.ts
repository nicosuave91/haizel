import {
  PPEAdapterPayload,
  PPEAdapterResponse,
  PPEEligibilityDecision,
  PPEEligibilityRequest,
  mapFromAdapterResponse,
  mapToAdapterPayload,
} from './mappers';

export interface PPEAdapter {
  quote(request: PPEAdapterPayload): Promise<PPEAdapterResponse>;
}

class MockPPEAdapter implements PPEAdapter {
  async quote(request: PPEAdapterPayload): Promise<PPEAdapterResponse> {
    const baseLtv = request.occupancyCode === 'INV' ? 0.7 : 0.8;
    const stateAdjustment = request.state === 'CA' ? -0.05 : 0;
    const amountAdjustment = request.amount > 1_000_000 ? -0.05 : 0;
    const maxLtv = Math.max(baseLtv + stateAdjustment + amountAdjustment, 0.5);
    return {
      allowed: maxLtv >= 0.6,
      maxLtv,
      reason: maxLtv < 0.6 ? 'High risk profile' : undefined,
    };
  }
}

export class PPEService {
  constructor(private readonly adapter: PPEAdapter = new MockPPEAdapter()) {}

  async determineEligibility(request: PPEEligibilityRequest): Promise<PPEEligibilityDecision> {
    const payload = mapToAdapterPayload(request);
    const response = await this.adapter.quote(payload);
    return mapFromAdapterResponse(request, response);
  }
}
