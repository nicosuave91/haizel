import { ComplianceIssue, ComplianceStage } from '@haizel/domain';

export interface ComplianceEvaluationContext {
  tenantId: string;
  loanId: string;
  stage: ComplianceStage;
  actorUserId: string;
  metadata?: Record<string, unknown>;
}

export interface ComplianceRuleDefinition {
  id: string;
  version: number;
  stage: ComplianceStage;
  name: string;
  description: string;
  evaluate(ctx: ComplianceEvaluationContext): Promise<ComplianceIssue | null>;
}

export interface ComplianceEvaluationResult {
  stage: ComplianceStage;
  passed: boolean;
  issues: ComplianceIssue[];
  waiversApplied: ComplianceWaiver[];
  coverage: ComplianceCoverageReport;
}

export interface ComplianceCoverageReport {
  stage: ComplianceStage;
  evaluatedAt: string;
  rules: Array<{
    id: string;
    version: number;
    name: string;
    result: 'passed' | 'failed' | 'waived';
    issue?: ComplianceIssue;
    waiverId?: string;
  }>;
}

export interface ComplianceEvaluationLogEntry {
  id: string;
  tenantId: string;
  loanId: string;
  stage: ComplianceStage;
  ruleId: string;
  ruleVersion: number;
  result: 'passed' | 'failed' | 'waived';
  issue?: ComplianceIssue;
  waiverId?: string;
  evaluatedAt: string;
  actorUserId: string;
}

export interface ComplianceWaiver {
  id: string;
  tenantId: string;
  loanId: string;
  ruleId: string;
  stage: ComplianceStage;
  grantedBy: string;
  reason: string;
  scope: 'LOAN' | 'STAGE';
  expiresAt: string;
}

export interface ComplianceRuleCatalog {
  register(rule: ComplianceRuleDefinition): void;
  getRules(stage?: ComplianceStage): ComplianceRuleDefinition[];
  getRule(ruleId: string, version?: number): ComplianceRuleDefinition | undefined;
}

export interface ComplianceLogRepository {
  append(entry: ComplianceEvaluationLogEntry): Promise<void>;
  getEvaluations(loanId: string, stage?: ComplianceStage): Promise<ComplianceEvaluationLogEntry[]>;
}

export interface ComplianceWaiverRepository {
  create(waiver: ComplianceWaiver): Promise<ComplianceWaiver>;
  listActive(loanId: string, stage: ComplianceStage, asOf: Date): Promise<ComplianceWaiver[]>;
}

export class InMemoryRuleCatalog implements ComplianceRuleCatalog {
  private readonly rules = new Map<string, Map<number, ComplianceRuleDefinition>>();

  register(rule: ComplianceRuleDefinition): void {
    if (!this.rules.has(rule.id)) {
      this.rules.set(rule.id, new Map());
    }
    this.rules.get(rule.id)!.set(rule.version, rule);
  }

  getRules(stage?: ComplianceStage): ComplianceRuleDefinition[] {
    const all = Array.from(this.rules.values()).flatMap((versions) =>
      Array.from(versions.values()),
    );
    const filtered = stage ? all.filter((rule) => rule.stage === stage) : all;
    return filtered.sort((a, b) => a.id.localeCompare(b.id) || b.version - a.version);
  }

  getRule(ruleId: string, version?: number): ComplianceRuleDefinition | undefined {
    const versions = this.rules.get(ruleId);
    if (!versions) {
      return undefined;
    }
    if (version === undefined) {
      const sorted = Array.from(versions.values()).sort((a, b) => b.version - a.version);
      return sorted[0];
    }
    return versions.get(version);
  }
}

export class InMemoryComplianceLogRepository implements ComplianceLogRepository {
  private readonly entries: ComplianceEvaluationLogEntry[] = [];

  async append(entry: ComplianceEvaluationLogEntry): Promise<void> {
    this.entries.push(entry);
  }

  async getEvaluations(loanId: string, stage?: ComplianceStage): Promise<ComplianceEvaluationLogEntry[]> {
    return this.entries
      .filter((entry) => entry.loanId === loanId && (!stage || entry.stage === stage))
      .sort((a, b) => a.evaluatedAt.localeCompare(b.evaluatedAt));
  }
}

export class InMemoryWaiverRepository implements ComplianceWaiverRepository {
  private readonly waivers: ComplianceWaiver[] = [];

  async create(waiver: ComplianceWaiver): Promise<ComplianceWaiver> {
    this.waivers.push(waiver);
    return waiver;
  }

  async listActive(loanId: string, stage: ComplianceStage, asOf: Date): Promise<ComplianceWaiver[]> {
    return this.waivers.filter((waiver) => {
      if (waiver.loanId !== loanId) {
        return false;
      }
      if (waiver.stage !== stage && waiver.scope === 'STAGE') {
        return false;
      }
      return new Date(waiver.expiresAt).getTime() >= asOf.getTime();
    });
  }
}

export class ComplianceEngine {
  constructor(
    private readonly catalog: ComplianceRuleCatalog,
    private readonly logs: ComplianceLogRepository,
    private readonly waivers: ComplianceWaiverRepository,
  ) {}

  async evaluate(ctx: ComplianceEvaluationContext): Promise<ComplianceEvaluationResult> {
    const rules = this.catalog.getRules(ctx.stage);
    const issues: ComplianceIssue[] = [];
    const coverage: ComplianceCoverageReport = {
      stage: ctx.stage,
      evaluatedAt: new Date().toISOString(),
      rules: [],
    };

    const now = new Date();
    const activeWaivers = await this.waivers.listActive(ctx.loanId, ctx.stage, now);
    const waiversApplied: ComplianceWaiver[] = [];

    for (const rule of rules) {
      const waiver = activeWaivers.find((candidate) => candidate.ruleId === rule.id);
      if (waiver) {
        waiversApplied.push(waiver);
        await this.logs.append({
          id: cryptoRandomId(),
          tenantId: ctx.tenantId,
          loanId: ctx.loanId,
          stage: ctx.stage,
          ruleId: rule.id,
          ruleVersion: rule.version,
          result: 'waived',
          waiverId: waiver.id,
          evaluatedAt: now.toISOString(),
          actorUserId: ctx.actorUserId,
        });
        coverage.rules.push({
          id: rule.id,
          version: rule.version,
          name: rule.name,
          result: 'waived',
          waiverId: waiver.id,
        });
        continue;
      }

      const issue = await rule.evaluate(ctx);
      if (issue) {
        issues.push(issue);
        await this.logs.append({
          id: cryptoRandomId(),
          tenantId: ctx.tenantId,
          loanId: ctx.loanId,
          stage: ctx.stage,
          ruleId: rule.id,
          ruleVersion: rule.version,
          result: 'failed',
          issue,
          evaluatedAt: now.toISOString(),
          actorUserId: ctx.actorUserId,
        });
        coverage.rules.push({
          id: rule.id,
          version: rule.version,
          name: rule.name,
          result: 'failed',
          issue,
        });
      } else {
        await this.logs.append({
          id: cryptoRandomId(),
          tenantId: ctx.tenantId,
          loanId: ctx.loanId,
          stage: ctx.stage,
          ruleId: rule.id,
          ruleVersion: rule.version,
          result: 'passed',
          evaluatedAt: now.toISOString(),
          actorUserId: ctx.actorUserId,
        });
        coverage.rules.push({
          id: rule.id,
          version: rule.version,
          name: rule.name,
          result: 'passed',
        });
      }
    }

    const passed = issues.every((issue) => issue.severity !== 'blocker');

    return {
      stage: ctx.stage,
      passed,
      issues,
      waiversApplied,
      coverage,
    };
  }

  async coverageReport(loanId: string, stage?: ComplianceStage): Promise<ComplianceCoverageReport[]> {
    const rulesByStage = stage ? [stage] : [...new Set(this.catalog.getRules().map((rule) => rule.stage))];
    const evaluations = await this.logs.getEvaluations(loanId, stage);
    return rulesByStage.map((stageItem) => ({
      stage: stageItem,
      evaluatedAt: new Date().toISOString(),
      rules: this.catalog
        .getRules(stageItem)
        .map((rule) => {
          const recent = [...evaluations]
            .reverse()
            .find((entry) => entry.ruleId === rule.id && entry.ruleVersion === rule.version);
          if (!recent) {
            return {
              id: rule.id,
              version: rule.version,
              name: rule.name,
              result: 'passed' as const,
            };
          }
          return {
            id: rule.id,
            version: rule.version,
            name: rule.name,
            result: recent.result,
            issue: recent.issue,
            waiverId: recent.waiverId,
          };
        }),
    }));
  }

  async requestWaiver(waiver: ComplianceWaiver): Promise<ComplianceWaiver> {
    return this.waivers.create(waiver);
  }
}

export const defaultRuleCatalog = new InMemoryRuleCatalog();
export const defaultLogRepository = new InMemoryComplianceLogRepository();
export const defaultWaiverRepository = new InMemoryWaiverRepository();
export const defaultComplianceEngine = new ComplianceEngine(
  defaultRuleCatalog,
  defaultLogRepository,
  defaultWaiverRepository,
);

defaultRuleCatalog.register({
  id: 'MISSING_BORROWER_DOB',
  version: 1,
  stage: 'PRE_FLIGHT',
  name: 'Borrower DOB required',
  description: 'Borrower DOB must exist before initiating vendor orders.',
  async evaluate() {
    return {
      code: 'MISSING_BORROWER_DOB',
      severity: 'blocker',
      message: 'Borrower DOB required',
      remediation: 'Update borrower profile with complete date of birth prior to ordering credit.',
    };
  },
});

defaultRuleCatalog.register({
  id: 'TRID_EARLY_VENDOR_CALL',
  version: 1,
  stage: 'PRE_VENDOR_CALL',
  name: 'TRID timing',
  description: 'TRID timing prohibits vendor calls prior to LE disclosures.',
  async evaluate() {
    return {
      code: 'TRID_EARLY_VENDOR_CALL',
      severity: 'blocker',
      message: 'Cannot order vendor services before LE timing requirements are satisfied.',
      remediation: 'Wait until LE timing is compliant or request a compliance override from a manager.',
    };
  },
});

function cryptoRandomId(): string {
  return Math.random().toString(36).slice(2);
}
