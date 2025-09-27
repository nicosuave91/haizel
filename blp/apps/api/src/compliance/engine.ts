import { ComplianceIssue, ComplianceStage } from '@haizel/domain';

export interface ComplianceEvaluationContext {
  tenantId: string;
  loanId: string;
  stage: ComplianceStage;
  actorUserId: string;
  metadata?: Record<string, unknown>;
}

export interface ComplianceEvaluationResult {
  stage: ComplianceStage;
  passed: boolean;
  issues: ComplianceIssue[];
}

export interface ComplianceRule {
  code: string;
  stage: ComplianceStage;
  description: string;
  evaluate(ctx: ComplianceEvaluationContext): Promise<ComplianceIssue | null>;
}

export class ComplianceEngine {
  constructor(private readonly rules: ComplianceRule[]) {}

  async evaluate(ctx: ComplianceEvaluationContext): Promise<ComplianceEvaluationResult> {
    const issues: ComplianceIssue[] = [];
    for (const rule of this.rules.filter((rule) => rule.stage === ctx.stage)) {
      const issue = await rule.evaluate(ctx);
      if (issue) {
        issues.push(issue);
      }
    }

    return {
      stage: ctx.stage,
      passed: issues.every((issue) => issue.severity !== 'blocker'),
      issues,
    };
  }
}

export class MissingBorrowerDobRule implements ComplianceRule {
  readonly code = 'MISSING_BORROWER_DOB';
  readonly stage: ComplianceStage = 'PRE_FLIGHT';
  readonly description = 'Borrower DOB must be present before pulling credit';

  constructor(private readonly hasDob: (loanId: string) => Promise<boolean>) {}

  async evaluate(ctx: ComplianceEvaluationContext): Promise<ComplianceIssue | null> {
    const hasDob = await this.hasDob(ctx.loanId);
    if (hasDob) {
      return null;
    }

    return {
      code: this.code,
      severity: 'blocker',
      message: 'Borrower DOB required',
      remediation: 'Update borrower profile with complete date of birth prior to ordering credit.',
    };
  }
}

export class TridTimingRule implements ComplianceRule {
  readonly code = 'TRID_EARLY_VENDOR_CALL';
  readonly stage: ComplianceStage = 'PRE_FLIGHT';
  readonly description = 'TRID timing prohibits certain vendor orders prior to LE disclosures';

  constructor(private readonly tridClockSatisfied: (loanId: string) => Promise<boolean>) {}

  async evaluate(ctx: ComplianceEvaluationContext): Promise<ComplianceIssue | null> {
    const satisfied = await this.tridClockSatisfied(ctx.loanId);
    if (satisfied) {
      return null;
    }

    return {
      code: this.code,
      severity: 'blocker',
      message: 'Cannot order vendor services before LE timing requirements are satisfied.',
      remediation: 'Wait until LE timing is compliant or request a compliance override from a manager.',
    };
  }
}

export const defaultComplianceEngine = new ComplianceEngine([
  new MissingBorrowerDobRule(async () => false),
  new TridTimingRule(async () => true),
]);
