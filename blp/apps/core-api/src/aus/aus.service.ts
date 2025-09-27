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
    const loan = await this.prisma.loan.findUnique({
      where: { id_tenantId: { id: loanId, tenantId: context.tenantId } },
    });
    if (!loan) {
      throw new NotFoundException('Loan not found');
    }

    const decision = loan.amount > 500000 ? 'Refer' : 'Approve';
    const result = await this.prisma.ausResult.create({
      data: {
        tenantId: context.tenantId,
        loanId,
        engine: dto.engine,
        decision,
      },
    });

    this.events.emit({
      type: 'aus.completed',
      tenantId: context.tenantId,
      payload: { loanId, resultId: result.id },
      timestamp: new Date(),
    });

    return result;
  }
}
