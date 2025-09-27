export interface CreditPullRequest {
  borrowerId: string;
  ssn: string;
  includeScore: boolean;
}

export interface CreditPullAcknowledgement {
  requestId: string;
  status: 'PENDING' | 'COMPLETED';
}

export interface CreditReportTradeline {
  creditor: string;
  balance: number;
  status: 'OPEN' | 'CLOSED';
}

export interface CreditPullResult extends CreditPullAcknowledgement {
  borrowerId: string;
  tradelines: CreditReportTradeline[];
  score?: number;
  refreshedAt: string;
}

export interface CreditAdapterPullPayload {
  subjectId: string;
  ssn: string;
  includeScore: boolean;
}

export interface CreditAdapterPullResponse {
  pullReference: string;
  status: 'PENDING' | 'COMPLETED';
  tradelines: CreditReportTradeline[];
  score?: number;
  refreshedAt: string;
}

export function mapToAdapterPayload(request: CreditPullRequest): CreditAdapterPullPayload {
  return {
    subjectId: request.borrowerId,
    ssn: request.ssn,
    includeScore: request.includeScore,
  };
}

export function mapFromAdapterResponse(
  request: CreditPullRequest,
  response: CreditAdapterPullResponse,
): CreditPullResult {
  return {
    requestId: response.pullReference,
    status: response.status,
    borrowerId: request.borrowerId,
    tradelines: response.tradelines,
    score: response.score,
    refreshedAt: response.refreshedAt,
  };
}

export function acknowledgementFromResult(result: CreditPullResult): CreditPullAcknowledgement {
  return {
    requestId: result.requestId,
    status: result.status,
  };
}
