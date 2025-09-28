import { Injectable } from '@nestjs/common';
import { getTracer } from '@haizel/api/observability';
import type { Span } from '@haizel/api/observability';
import { randomUUID } from 'crypto';
import {
  AusResultEntity,
  CreditReportEntity,
  DocumentEntity,
  LoanEntity,
  PricingLockEntity,
} from './interfaces';

interface LoanCreateInput {
  tenantId: string;
  borrowerName: string;
  amount: number;
}

interface LoanUpdateInput {
  status?: LoanEntity['status'];
  pricingLockId?: string | null;
}

interface DocumentCreateInput {
  tenantId: string;
  loanId: string;
  name: string;
  contentType: string;
  storageKey: string;
}

interface PricingLockCreateInput {
  tenantId: string;
  loanId: string;
  rate: number;
  expiresAt: Date;
}

interface AusCreateInput {
  tenantId: string;
  loanId: string;
  engine: string;
  decision: string;
}

interface CreditCreateInput {
  tenantId: string;
  loanId: string;
  bureau: string;
  score: number;
}

@Injectable()
export class PrismaService {
  private readonly loans = new Map<string, LoanEntity>();
  private readonly documents = new Map<string, DocumentEntity>();
  private readonly pricingLocks = new Map<string, PricingLockEntity>();
  private readonly ausResults = new Map<string, AusResultEntity>();
  private readonly creditReports = new Map<string, CreditReportEntity>();

  private instrument<T>(operation: string, attributes: Record<string, unknown>, callback: () => Promise<T>): Promise<T> {
    const tracer = getTracer();
    return tracer.startSpan(`prisma.${operation}`, async (span: Span) => {
      span.setAttribute('db.system', 'inmemory');
      span.setAttribute('db.operation', operation);
      for (const [key, value] of Object.entries(attributes)) {
        if (value === undefined || value === null) {
          continue;
        }
        const attributeKey = typeof value === 'string' ? `db.${key}` : `db.${key}`;
        span.setAttribute(attributeKey, value as never);
        if (key.toLowerCase().includes('tenant')) {
          span.setAttribute('tenant.id', value as never);
        }
        if (key.toLowerCase().includes('loan')) {
          span.setAttribute('loan.id', value as never);
        }
      }
      return callback();
    });
  }

  public readonly loan = {
    findMany: async ({
      where,
    }: {
      where: { tenantId: string };
    }): Promise<LoanEntity[]> =>
      this.instrument('loan.findMany', { tenantId: where.tenantId }, async () =>
        Array.from(this.loans.values()).filter((loan) => loan.tenantId === where.tenantId),
      ),
    findUnique: async ({
      where,
    }: {
      where: { id_tenantId: { id: string; tenantId: string } };
    }): Promise<LoanEntity | null> =>
      this.instrument(
        'loan.findUnique',
        { tenantId: where.id_tenantId.tenantId, loanId: where.id_tenantId.id },
        async () => {
          const loan = this.loans.get(where.id_tenantId.id);
          if (!loan || loan.tenantId !== where.id_tenantId.tenantId) {
            return null;
          }
          return loan;
        },
      ),
    create: async ({ data }: { data: LoanCreateInput }): Promise<LoanEntity> =>
      this.instrument('loan.create', { tenantId: data.tenantId }, async () => {
        const now = new Date();
        const loan: LoanEntity = {
          id: randomUUID(),
          tenantId: data.tenantId,
          borrowerName: data.borrowerName,
          amount: data.amount,
          status: 'draft',
          createdAt: now,
          updatedAt: now,
        };
        this.loans.set(loan.id, loan);
        return loan;
      }),
    update: async ({
      where,
      data,
    }: {
      where: { id_tenantId: { id: string; tenantId: string } };
      data: LoanUpdateInput;
    }): Promise<LoanEntity> =>
      this.instrument(
        'loan.update',
        { tenantId: where.id_tenantId.tenantId, loanId: where.id_tenantId.id },
        async () => {
          const loan = await this.loan.findUnique({ where });
          if (!loan) {
            throw new Error('Loan not found');
          }
          const updated: LoanEntity = {
            ...loan,
            ...data,
            updatedAt: new Date(),
          };
          if (data.pricingLockId === null) {
            delete updated.pricingLockId;
          }
          this.loans.set(updated.id, updated);
          return updated;
        },
      ),
  };

  public readonly document = {
    findMany: async ({
      where,
    }: {
      where: { tenantId: string; loanId: string };
    }): Promise<DocumentEntity[]> =>
      this.instrument('document.findMany', { tenantId: where.tenantId, loanId: where.loanId }, async () =>
        Array.from(this.documents.values()).filter(
          (doc) => doc.tenantId === where.tenantId && doc.loanId === where.loanId,
        ),
      ),
    create: async ({ data }: { data: DocumentCreateInput }): Promise<DocumentEntity> =>
      this.instrument('document.create', { tenantId: data.tenantId, loanId: data.loanId }, async () => {
        const versions = Array.from(this.documents.values()).filter(
          (doc) => doc.tenantId === data.tenantId && doc.loanId === data.loanId && doc.name === data.name,
        );
        const document: DocumentEntity = {
          id: randomUUID(),
          tenantId: data.tenantId,
          loanId: data.loanId,
          name: data.name,
          contentType: data.contentType,
          storageKey: data.storageKey,
          version: versions.length + 1,
          createdAt: new Date(),
        };
        this.documents.set(document.id, document);
        return document;
      }),
  };

  public readonly pricingLock = {
    findUnique: async ({
      where,
    }: {
      where: { id_tenantId: { id: string; tenantId: string } };
    }): Promise<PricingLockEntity | null> =>
      this.instrument(
        'pricingLock.findUnique',
        { tenantId: where.id_tenantId.tenantId, loanId: where.id_tenantId.id },
        async () => {
          const lock = this.pricingLocks.get(where.id_tenantId.id);
          if (!lock || lock.tenantId !== where.id_tenantId.tenantId) {
            return null;
          }
          return lock;
        },
      ),
    create: async ({ data }: { data: PricingLockCreateInput }): Promise<PricingLockEntity> =>
      this.instrument('pricingLock.create', { tenantId: data.tenantId, loanId: data.loanId }, async () => {
        const lock: PricingLockEntity = {
          id: randomUUID(),
          tenantId: data.tenantId,
          loanId: data.loanId,
          rate: data.rate,
          expiresAt: data.expiresAt,
          createdAt: new Date(),
        };
        this.pricingLocks.set(lock.id, lock);
        return lock;
      }),
  };

  public readonly ausResult = {
    create: async ({ data }: { data: AusCreateInput }): Promise<AusResultEntity> =>
      this.instrument('ausResult.create', { tenantId: data.tenantId, loanId: data.loanId }, async () => {
        const result: AusResultEntity = {
          id: randomUUID(),
          tenantId: data.tenantId,
          loanId: data.loanId,
          engine: data.engine,
          decision: data.decision,
          createdAt: new Date(),
        };
        this.ausResults.set(result.id, result);
        return result;
      }),
    findMany: async ({
      where,
    }: {
      where: { loanId: string; tenantId: string };
    }): Promise<AusResultEntity[]> =>
      this.instrument('ausResult.findMany', { tenantId: where.tenantId, loanId: where.loanId }, async () =>
        Array.from(this.ausResults.values()).filter(
          (result) => result.tenantId === where.tenantId && result.loanId === where.loanId,
        ),
      ),
  };

  public readonly creditReport = {
    create: async ({ data }: { data: CreditCreateInput }): Promise<CreditReportEntity> =>
      this.instrument('creditReport.create', { tenantId: data.tenantId, loanId: data.loanId }, async () => {
        const report: CreditReportEntity = {
          id: randomUUID(),
          tenantId: data.tenantId,
          loanId: data.loanId,
          bureau: data.bureau,
          score: data.score,
          createdAt: new Date(),
        };
        this.creditReports.set(report.id, report);
        return report;
      }),
    findMany: async ({
      where,
    }: {
      where: { loanId: string; tenantId: string };
    }): Promise<CreditReportEntity[]> =>
      Array.from(this.creditReports.values()).filter(
        (report) => report.tenantId === where.tenantId && report.loanId === where.loanId,
      ),
  };
}
