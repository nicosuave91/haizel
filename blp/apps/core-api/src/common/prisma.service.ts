import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { DocumentCategory, LoanTask, LoanStatus, Prisma, PrismaClient, Tenant } from '@prisma/client';
import { randomUUID } from 'crypto';
import {
  AusResultEntity,
  CreditReportEntity,
  DocumentEntity,
  LoanEntity,
  PricingLockEntity,
} from './interfaces';

const DEFAULT_TIMEZONE = 'UTC';
const DEFAULT_DOCUMENT_CATEGORY_CODE = 'general';
const DEFAULT_DOCUMENT_CATEGORY_NAME = 'General Documents';
const PRICING_LOCK_TASK_TITLE = 'pricing-lock';

type LoanWithRelations = Prisma.LoanGetPayload<{
  include: { tenant: true; primaryBorrower: true };
}>;

type PrismaTransaction = Prisma.TransactionClient;

type LoanDocumentWithMetadata = Prisma.LoanDocumentGetPayload<{ include: { tenant: true } }>;

function toNumber(value: Prisma.Decimal | number): number {
  return typeof value === 'number' ? value : Number(value);
}

function toDocumentMetadata(value: Prisma.JsonValue | null | undefined): Prisma.JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as Prisma.JsonObject;
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  async transaction<T>(handler: (tx: PrismaTransaction) => Promise<T>): Promise<T> {
    return this.$transaction((client) => handler(client));
  }

  async ensureTenant(slug: string, tx: PrismaTransaction = this): Promise<Tenant> {
    const existing = await tx.tenant.findUnique({ where: { slug } });
    if (existing) {
      return existing;
    }
    return tx.tenant.create({
      data: {
        slug,
        displayName: slug,
        timezone: DEFAULT_TIMEZONE,
      },
    });
  }

  async getTenantBySlug(slug: string, tx: PrismaTransaction = this): Promise<Tenant | null> {
    return tx.tenant.findUnique({ where: { slug } });
  }

  async createLoan(
    tenantSlug: string,
    dto: { borrowerName: string; amount: number },
  ): Promise<LoanEntity> {
    return this.transaction(async (innerTx) => {
      const tenant = await this.ensureTenant(tenantSlug, innerTx);
      const borrower = await innerTx.borrower.create({
        data: {
          tenantId: tenant.id,
          type: 'individual',
          legalName: dto.borrowerName,
        },
      });

      const loan = await innerTx.loan.create({
        data: {
          tenantId: tenant.id,
          primaryBorrowerId: borrower.id,
          loanNumber: this.generateLoanNumber(),
          requestedAmount: new Prisma.Decimal(dto.amount),
          currencyCode: 'USD',
          status: LoanStatus.draft,
        },
        include: { tenant: true, primaryBorrower: true },
      });

      await innerTx.loanBorrower.create({
        data: {
          tenantId: tenant.id,
          loanId: loan.id,
          borrowerId: borrower.id,
          isPrimary: true,
        },
      });

      return this.mapLoanEntity(loan);
    });
  }

  async findLoanModel(
    tenantSlug: string,
    loanId: string,
    tx: PrismaTransaction = this,
  ): Promise<LoanWithRelations | null> {
    return tx.loan.findFirst({
      where: {
        id: loanId,
        tenant: { slug: tenantSlug },
      },
      include: { tenant: true, primaryBorrower: true },
    });
  }

  async getLoanEntity(
    tenantSlug: string,
    loanId: string,
    tx: PrismaTransaction = this,
  ): Promise<LoanEntity | null> {
    const loan = await this.findLoanModel(tenantSlug, loanId, tx);
    if (!loan) {
      return null;
    }
    const lock = await this.findLatestPricingLock(loan, tx);
    return this.mapLoanEntity(loan, lock);
  }

  async listLoanEntities(tenantSlug: string, tx: PrismaTransaction = this): Promise<LoanEntity[]> {
    const tenant = await this.getTenantBySlug(tenantSlug, tx);
    if (!tenant) {
      return [];
    }

    const loans = await tx.loan.findMany({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: 'asc' },
      include: { tenant: true, primaryBorrower: true },
    });

    const locks = await tx.loanTask.findMany({
      where: { tenantId: tenant.id, title: PRICING_LOCK_TASK_TITLE },
      orderBy: { createdAt: 'desc' },
    });

    const lockMap = new Map<string, PricingLockEntity>();
    for (const lock of locks) {
      if (!lockMap.has(lock.loanId)) {
        lockMap.set(lock.loanId, this.mapPricingLock(lock, tenant.slug));
      }
    }

    return loans.map((loan) => this.mapLoanEntity(loan, lockMap.get(loan.id) ?? null));
  }

  async recordPricingLock(
    loan: LoanWithRelations,
    rate: number,
    expiresAt: Date,
    tx: PrismaTransaction = this,
  ): Promise<PricingLockEntity> {
    const task = await tx.loanTask.create({
      data: {
        tenantId: loan.tenantId,
        loanId: loan.id,
        title: PRICING_LOCK_TASK_TITLE,
        description: JSON.stringify({ rate }),
        status: 'open',
        priority: 'high',
        dueDate: expiresAt,
      },
    });
    return this.mapPricingLock(task, loan.tenant.slug);
  }

  async findLatestPricingLock(
    loan: LoanWithRelations,
    tx: PrismaTransaction = this,
  ): Promise<PricingLockEntity | null> {
    const task = await tx.loanTask.findFirst({
      where: {
        tenantId: loan.tenantId,
        loanId: loan.id,
        title: PRICING_LOCK_TASK_TITLE,
      },
      orderBy: { createdAt: 'desc' },
    });
    return task ? this.mapPricingLock(task, loan.tenant.slug) : null;
  }

  async createDocument(
    loan: LoanWithRelations,
    dto: { name: string; contentType: string; storageKey: string },
    tx: PrismaTransaction = this,
  ): Promise<DocumentEntity> {
    const category = await this.ensureDocumentCategory(loan.tenantId, tx);
    const version =
      (await tx.loanDocument.count({
        where: { tenantId: loan.tenantId, loanId: loan.id, fileName: dto.name },
      })) + 1;

    const metadata: Prisma.JsonObject = {
      version,
      contentType: dto.contentType,
    };

    const document = await tx.loanDocument.create({
      data: {
        tenantId: loan.tenantId,
        loanId: loan.id,
        documentCategoryId: category.id,
        fileName: dto.name,
        storageUri: dto.storageKey,
        metadata,
      },
      include: { tenant: true },
    });

    return this.mapDocumentEntity(document);
  }

  async listDocuments(
    loan: LoanWithRelations,
    tx: PrismaTransaction = this,
  ): Promise<DocumentEntity[]> {
    const documents = await tx.loanDocument.findMany({
      where: { tenantId: loan.tenantId, loanId: loan.id },
      orderBy: { createdAt: 'asc' },
      include: { tenant: true },
    });
    return documents.map((document) => this.mapDocumentEntity(document));
  }

  async recordAusResult(
    loan: LoanWithRelations,
    params: { engine: string; decision: string; requestId?: string; actorId?: string },
    tx: PrismaTransaction = this,
  ): Promise<AusResultEntity> {
    const metadata: Prisma.JsonObject = {
      engine: params.engine,
      decision: params.decision,
    };

    const event = await tx.auditEvent.create({
      data: {
        tenantId: loan.tenantId,
        actorType: 'system',
        actorId: params.actorId,
        action: 'aus.run',
        entityType: 'loan',
        entityId: loan.id,
        entityExternalId: loan.loanNumber,
        metadata,
        requestId: params.requestId,
      },
    });

    return {
      id: event.id,
      tenantId: loan.tenant.slug,
      loanId: loan.id,
      engine: params.engine,
      decision: params.decision,
      createdAt: event.occurredAt,
    };
  }

  async recordCreditReport(
    loan: LoanWithRelations,
    params: { bureau: string; score: number; requestId?: string; actorId?: string },
    tx: PrismaTransaction = this,
  ): Promise<CreditReportEntity> {
    const metadata: Prisma.JsonObject = {
      bureau: params.bureau,
      score: params.score,
    };

    const event = await tx.auditEvent.create({
      data: {
        tenantId: loan.tenantId,
        actorType: 'system',
        actorId: params.actorId,
        action: 'credit.pull',
        entityType: 'loan',
        entityId: loan.id,
        entityExternalId: loan.loanNumber,
        metadata,
        requestId: params.requestId,
      },
    });

    return {
      id: event.id,
      tenantId: loan.tenant.slug,
      loanId: loan.id,
      bureau: params.bureau,
      score: params.score,
      createdAt: event.occurredAt,
    };
  }

  private mapLoanEntity(loan: LoanWithRelations, lock?: PricingLockEntity | null): LoanEntity {
    const entity: LoanEntity = {
      id: loan.id,
      tenantId: loan.tenant.slug,
      borrowerName: loan.primaryBorrower.legalName,
      amount: toNumber(loan.requestedAmount),
      status: this.mapLoanStatus(loan.status),
      createdAt: loan.createdAt,
      updatedAt: loan.updatedAt,
    };

    entity.pricingLockId = lock?.id ?? null;

    return entity;
  }

  private mapLoanStatus(status: LoanStatus): LoanEntity['status'] {
    switch (status) {
      case LoanStatus.draft:
        return 'draft';
      case LoanStatus.submitted:
        return 'submitted';
      default:
        return 'locked';
    }
  }

  private mapPricingLock(task: LoanTask, tenantSlug: string): PricingLockEntity {
    let rate: number | undefined;
    try {
      const payload = JSON.parse(task.description ?? '{}');
      if (typeof payload.rate === 'number') {
        rate = payload.rate;
      }
    } catch {
      // ignore parse errors and fall back to default
    }

    return {
      id: task.id,
      tenantId: tenantSlug,
      loanId: task.loanId,
      rate: rate ?? 0,
      expiresAt: task.dueDate ?? task.createdAt,
      createdAt: task.createdAt,
    };
  }

  private mapDocumentEntity(document: LoanDocumentWithMetadata): DocumentEntity {
    const metadata = toDocumentMetadata(document.metadata);
    const version = typeof metadata.version === 'number' ? metadata.version : 1;
    const contentType =
      typeof metadata.contentType === 'string' ? metadata.contentType : 'application/octet-stream';

    return {
      id: document.id,
      tenantId: document.tenant.slug,
      loanId: document.loanId,
      name: document.fileName,
      contentType,
      version,
      storageKey: document.storageUri,
      createdAt: document.createdAt,
    };
  }

  private async ensureDocumentCategory(
    tenantId: string,
    tx: PrismaTransaction,
  ): Promise<DocumentCategory> {
    const existing = await tx.documentCategory.findFirst({
      where: { tenantId, code: DEFAULT_DOCUMENT_CATEGORY_CODE },
    });

    if (existing) {
      return existing;
    }

    return tx.documentCategory.create({
      data: {
        tenantId,
        code: DEFAULT_DOCUMENT_CATEGORY_CODE,
        displayName: DEFAULT_DOCUMENT_CATEGORY_NAME,
      },
    });
  }

  private generateLoanNumber(): string {
    return `LN-${randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase()}`;
  }
}
