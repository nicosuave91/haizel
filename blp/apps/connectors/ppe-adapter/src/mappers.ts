export interface PPEEligibilityRequest {
  borrowerId: string;
  loanAmount: number;
  propertyState: string;
  occupancy: 'PRIMARY' | 'SECONDARY' | 'INVESTMENT';
}

export interface PPEAdapterPayload {
  subjectId: string;
  amount: number;
  state: string;
  occupancyCode: string;
}

export interface PPEEligibilityDecision {
  borrowerId: string;
  eligible: boolean;
  maxLtv: number;
  notes?: string;
}

export interface PPEAdapterResponse {
  allowed: boolean;
  maxLtv: number;
  reason?: string;
}

export function mapToAdapterPayload(request: PPEEligibilityRequest): PPEAdapterPayload {
  return {
    subjectId: request.borrowerId,
    amount: request.loanAmount,
    state: request.propertyState,
    occupancyCode: request.occupancy.slice(0, 3),
  };
}

export function mapFromAdapterResponse(
  request: PPEEligibilityRequest,
  response: PPEAdapterResponse,
): PPEEligibilityDecision {
  return {
    borrowerId: request.borrowerId,
    eligible: response.allowed,
    maxLtv: response.maxLtv,
    notes: response.reason,
  };
}
