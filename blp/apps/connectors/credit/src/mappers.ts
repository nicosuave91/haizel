export interface CreditReportRequest {
  borrowerId: string;
  ssn: string;
  includeScore?: boolean;
}

export interface CreditAdapterPayload {
  subjectReference: string;
  social: string;
  includeScore: boolean;
}

export interface CreditReport {
  borrowerId: string;
  tradelines: Array<{
    creditor: string;
    balance: number;
    status: 'OPEN' | 'CLOSED';
  }>;
  score?: number;
}

export interface CreditAdapterResponse {
  tradelines: Array<{
    creditor: string;
    balance: number;
    status: 'OPEN' | 'CLOSED';
  }>;
  score?: number;
}

export function mapToAdapterPayload(request: CreditReportRequest): CreditAdapterPayload {
  return {
    subjectReference: request.borrowerId,
    social: request.ssn,
    includeScore: request.includeScore ?? true,
  };
}

export function mapFromAdapterResponse(
  request: CreditReportRequest,
  response: CreditAdapterResponse,
): CreditReport {
  return {
    borrowerId: request.borrowerId,
    tradelines: response.tradelines,
    score: response.score,
  };
}
