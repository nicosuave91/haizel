import { Injectable, NotFoundException } from '@nestjs/common';
import { addMinutes } from 'date-fns';
import { PrismaService } from '../common/prisma.service';
import { OpaService } from '../opa/opa.service';
import { WorkflowsClient } from '../temporal/workflows.client';
import { EventsProducerService } from '../events/producer.service';
import { RequestContext } from '../common/interfaces';

interface CreateLockDto {
  rate: number;
  durationMinutes: number;
}

@Injectable()
export class PricingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly opa: OpaService,
    private readonly temporal: WorkflowsClient,
    private readonly events: EventsProducerService,
  ) {}

  async lock(context: RequestContext, loanId: string, dto: CreateLockDto) {
    await this.opa.authorize(context.user, { action: 'pricing:lock', resourceTenant: context.tenantId });
    const loan = await this.prisma.loan.findUnique({
      where: { id_tenantId: { id: loanId, tenantId: context.tenantId } },
    });
    if (!loan) {
      throw new NotFoundException('Loan not found');
    }

    const expiresAt = addMinutes(new Date(), dto.durationMinutes);
    const lock = await this.prisma.pricingLock.create({
      data: {
        tenantId: context.tenantId,
        loanId,
        rate: dto.rate,
        expiresAt,
      },
    });

    await this.prisma.loan.update({
      where: { id_tenantId: { id: loanId, tenantId: context.tenantId } },
      data: { status: 'locked', pricingLockId: lock.id },
    });

    this.temporal.schedule('pricing.lock.expiration', lock.id, expiresAt);
    this.events.emit({
      type: 'pricing.locked',
      tenantId: context.tenantId,
      payload: { loanId, lockId: lock.id },
      timestamp: new Date(),
    });

    return lock;
  }
}
