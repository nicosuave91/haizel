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
    const loan = await this.prisma.findLoanModel(context.tenantId, loanId);
    if (!loan) {
      throw new NotFoundException('Loan not found');
    }

    const requestedAmount = Number(loan.requestedAmount);
    const score = Math.max(600, Math.min(requestedAmount / 1000 + 500, 850));
    const report = await this.prisma.transaction((tx) =>
      this.prisma.recordCreditReport(
        loan,
        {
          bureau: dto.bureau,
          score: Math.round(score),
          requestId: context.requestId,
          actorId: context.user.sub,
        },
        tx,
      ),
    );

    this.events.emit({
      type: 'credit.pulled',
      tenantId: context.tenantId,
      payload: { loanId, reportId: report.id },
      timestamp: new Date(),
    });

    return report;
  }
}
