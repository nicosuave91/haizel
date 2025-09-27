export interface AUSSubmissionRequest {
  loanId: string;
  borrowerId: string;
  dti: number;
  ltv: number;
  creditScore: number;
}

export interface AUSAdapterPayload {
  caseNumber: string;
  borrower: string;
  debtToIncome: number;
  loanToValue: number;
  fico: number;
}

export interface AUSDecision {
  loanId: string;
  borrowerId: string;
  result: 'APPROVED' | 'REFER' | 'MANUAL';
  reasons: string[];
  submittedAt: string;
}

export interface AUSAdapterResponse {
  decisionCode: 'APPROVED' | 'REFER' | 'MANUAL';
  reasons: string[];
  receivedAt: string;
}

export function mapToAdapterPayload(request: AUSSubmissionRequest): AUSAdapterPayload {
  return {
    caseNumber: request.loanId,
    borrower: request.borrowerId,
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
    borrowerId: request.borrowerId,
    result: response.decisionCode,
    reasons: response.reasons,
    submittedAt: response.receivedAt,
  };
}
