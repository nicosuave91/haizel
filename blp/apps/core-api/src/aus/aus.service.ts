import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { OpaService } from '../opa/opa.service';
import { EventsProducerService } from '../events/producer.service';
import { RequestContext } from '../common/interfaces';

interface AusRunDto {
  engine: string;
}

@Injectable()
export class AusService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly opa: OpaService,
    private readonly events: EventsProducerService,
  ) {}

  async run(context: RequestContext, loanId: string, dto: AusRunDto) {
    await this.opa.authorize(context.user, { action: 'aus:run', resourceTenant: context.tenantId });
    const loan = await this.prisma.findLoanModel(context.tenantId, loanId);
    if (!loan) {
      throw new NotFoundException('Loan not found');
    }

    const requestedAmount = Number(loan.requestedAmount);
    const decision = requestedAmount > 500000 ? 'Refer' : 'Approve';
    const result = await this.prisma.transaction((tx) =>
      this.prisma.recordAusResult(
        loan,
        {
          engine: dto.engine,
          decision,
          requestId: context.requestId,
          actorId: context.user.sub,
        },
        tx,
      ),
    );

    this.events.emit({
      type: 'aus.completed',
      tenantId: context.tenantId,
      payload: { loanId, resultId: result.id },
      timestamp: new Date(),
    });

    return result;
  }
}
