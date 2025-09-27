import { Injectable } from '@nestjs/common';
import { OpaService } from '../opa/opa.service';
import { PrismaService } from '../common/prisma.service';
import { RequestContext } from '../common/interfaces';

interface RulesEvaluationDto {
  trigger: string;
}

@Injectable()
export class RulesProxyService {
  constructor(private readonly opa: OpaService, private readonly prisma: PrismaService) {}

  async evaluate(context: RequestContext, loanId: string, dto: RulesEvaluationDto) {
    await this.opa.authorize(context.user, { action: 'rules:evaluate', resourceTenant: context.tenantId });
    const loan = await this.prisma.loan.findUnique({
      where: { id_tenantId: { id: loanId, tenantId: context.tenantId } },
    });
    if (!loan) {
      throw new Error('Loan not found');
    }

    const findings = [] as string[];
    if (loan.amount > 600000) {
      findings.push('Loan amount exceeds auto-approval threshold.');
    }
    if (dto.trigger === 'submission' && loan.status !== 'locked') {
      findings.push('Pricing lock required before submission.');
    }

    return {
      trigger: dto.trigger,
      findings,
      passed: findings.length === 0,
    };
  }
}
