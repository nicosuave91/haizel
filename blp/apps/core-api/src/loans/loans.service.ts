import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { EventsProducerService } from '../events/producer.service';
import { OpaService } from '../opa/opa.service';
import { LoanEntity, RequestContext } from '../common/interfaces';

interface CreateLoanDto {
  borrowerName: string;
  amount: number;
}

@Injectable()
export class LoansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsProducerService,
    private readonly opa: OpaService,
  ) {}

  async create(context: RequestContext, dto: CreateLoanDto): Promise<LoanEntity> {
    await this.opa.authorize(context.user, {
      action: 'loan:create',
      resourceTenant: context.tenantId,
    });

    const loan = await this.prisma.loan.create({
      data: {
        tenantId: context.tenantId,
        borrowerName: dto.borrowerName,
        amount: dto.amount,
      },
    });

    this.events.emit({
      type: 'loan.created',
      tenantId: context.tenantId,
      payload: { loanId: loan.id },
      timestamp: new Date(),
    });

    return loan;
  }

  async get(context: RequestContext, loanId: string): Promise<LoanEntity> {
    await this.opa.authorize(context.user, { action: 'loan:read', resourceTenant: context.tenantId });
    const loan = await this.prisma.loan.findUnique({
      where: { id_tenantId: { id: loanId, tenantId: context.tenantId } },
    });
    if (!loan) {
      throw new NotFoundException('Loan not found');
    }
    return loan;
  }

  async list(context: RequestContext): Promise<LoanEntity[]> {
    await this.opa.authorize(context.user, { action: 'loan:list', resourceTenant: context.tenantId });
    return this.prisma.loan.findMany({ where: { tenantId: context.tenantId } });
  }
}
