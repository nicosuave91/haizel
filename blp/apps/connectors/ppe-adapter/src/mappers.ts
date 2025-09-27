export interface PPEQuoteRequest {
  loanId: string;
  loanAmount: number;
  productCode: string;
  propertyState: string;
  lockPeriodDays: number;
  ltv: number;
  fico: number;
}

export interface PPEQuoteAdapterPayload {
  caseId: string;
  amount: number;
  product: string;
  state: string;
  lockPeriodDays: number;
  risk: {
    ltv: number;
    fico: number;
  };
}

export interface PPEQuoteAdapterResponse {
  quoteReference: string;
  bestEffortRate: number;
  price: number;
  expiresAt: string;
}

export interface PPEQuoteResponse {
  quoteId: string;
  loanId: string;
  rate: number;
  price: number;
  expiresAt: string;
}

export interface PPERateLockRequest {
  quoteId: string;
  loanId: string;
  borrowerId: string;
  lockPeriodDays: number;
}

export interface PPERateLockAdapterPayload {
  quoteReference: string;
  caseId: string;
  borrower: string;
  lockPeriodDays: number;
}

export interface PPERateLockAdapterResponse {
  lockReference: string;
  status: 'LOCKED' | 'REJECTED';
  lockedRate: number;
  expiresAt: string;
}

export interface PPERateLockResponse {
  lockId: string;
  status: 'LOCKED' | 'REJECTED';
  lockedRate: number;
  lockExpiresAt: string;
}

export function mapToQuotePayload(request: PPEQuoteRequest): PPEQuoteAdapterPayload {
  return {
    caseId: request.loanId,
    amount: request.loanAmount,
    product: request.productCode,
    state: request.propertyState,
    lockPeriodDays: request.lockPeriodDays,
    risk: {
      ltv: request.ltv,
      fico: request.fico,
    },
  };
}

export function mapFromQuoteResponse(
  request: PPEQuoteRequest,
  response: PPEQuoteAdapterResponse,
): PPEQuoteResponse {
  return {
    quoteId: response.quoteReference,
    loanId: request.loanId,
    rate: response.bestEffortRate,
    price: response.price,
    expiresAt: response.expiresAt,
  };
}

export function mapToLockPayload(request: PPERateLockRequest): PPERateLockAdapterPayload {
  return {
    quoteReference: request.quoteId,
    caseId: request.loanId,
    borrower: request.borrowerId,
    lockPeriodDays: request.lockPeriodDays,
  };
}

export function mapFromLockResponse(
  response: PPERateLockAdapterResponse,
): PPERateLockResponse {
  return {
    lockId: response.lockReference,
    status: response.status,
    lockedRate: response.lockedRate,
    lockExpiresAt: response.expiresAt,
  };
}
