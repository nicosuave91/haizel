import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { OpaService } from '../opa/opa.service';
import { EventsProducerService } from '../events/producer.service';
import { RequestContext } from '../common/interfaces';

interface CreditRequestDto {
  bureau: string;
}

@Injectable()
export class CreditService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly opa: OpaService,
    private readonly events: EventsProducerService,
  ) {}

  async pull(context: RequestContext, loanId: string, dto: CreditRequestDto) {
    await this.opa.authorize(context.user, { action: 'credit:pull', resourceTenant: context.tenantId });
    const loan = await this.prisma.loan.findUnique({
      where: { id_tenantId: { id: loanId, tenantId: context.tenantId } },
    });
    if (!loan) {
      throw new NotFoundException('Loan not found');
    }

    const score = Math.max(600, Math.min(loan.amount / 1000 + 500, 850));
    const report = await this.prisma.creditReport.create({
      data: {
        tenantId: context.tenantId,
        loanId,
        bureau: dto.bureau,
        score: Math.round(score),
      },
    });

    this.events.emit({
      type: 'credit.pulled',
      tenantId: context.tenantId,
      payload: { loanId, reportId: report.id },
      timestamp: new Date(),
    });

    return report;
  }
}
