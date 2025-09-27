export interface AUSSubmissionRequest {
  loanId: string;
  dti: number;
  ltv: number;
  creditScore: number;
}

export interface AUSAdapterPayload {
  caseNumber: string;
  debtToIncome: number;
  loanToValue: number;
  fico: number;
}

export interface AUSDecision {
  loanId: string;
  result: 'APPROVED' | 'REFER' | 'MANUAL';
  reasons: string[];
}

export interface AUSAdapterResponse {
  decisionCode: 'APPROVED' | 'REFER' | 'MANUAL';
  reasons: string[];
}

export function mapToAdapterPayload(request: AUSSubmissionRequest): AUSAdapterPayload {
  return {
    caseNumber: request.loanId,
    debtToIncome: request.dti,
    loanToValue: request.ltv,
    fico: request.creditScore,
  };
}

export function mapFromAdapterResponse(
  request: AUSSubmissionRequest,
  response: AUSAdapterResponse,
): AUSDecision {
  return {
    loanId: request.loanId,
    result: response.decisionCode,
    reasons: response.reasons,
  };
}
