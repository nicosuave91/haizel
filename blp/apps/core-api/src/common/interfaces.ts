export interface AuthUser {
  sub: string;
  tenantId: string;
  permissions: string[];
}

export interface RequestContext {
  tenantId: string;
  user: AuthUser;
}

export interface LoanEntity {
  id: string;
  tenantId: string;
  borrowerName: string;
  amount: number;
  status: 'draft' | 'submitted' | 'locked';
  pricingLockId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DocumentEntity {
  id: string;
  tenantId: string;
  loanId: string;
  name: string;
  contentType: string;
  version: number;
  storageKey: string;
  createdAt: Date;
}

export interface PricingLockEntity {
  id: string;
  loanId: string;
  tenantId: string;
  rate: number;
  expiresAt: Date;
  createdAt: Date;
}

export interface AusResultEntity {
  id: string;
  loanId: string;
  tenantId: string;
  engine: string;
  decision: string;
  createdAt: Date;
}

export interface CreditReportEntity {
  id: string;
  loanId: string;
  tenantId: string;
  bureau: string;
  score: number;
  createdAt: Date;
}
