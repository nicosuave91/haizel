# On-Call Expectations

## Coverage
- Primary: Platform SRE (PagerDuty `haizel-platform`)
- Secondary: Integrations engineer (PagerDuty `haizel-integrations`)

## Daily Duties
- Review overnight alerts and confirm remediation status.
- Verify SLO dashboards (webhook success, outbox backlog, workflow latency).
- Rotate encryption/KMS keys per calendar (1st business day of quarter).

## Incident Response
1. Acknowledge alert within 5 minutes.
2. Assign commander/scribe if incident spans >30 minutes.
3. Update status in #loan-ops and #engineering-war-room.
4. File incident report within 24h after resolution.

## Break-Glass Procedure
When compliance gates must be bypassed to close a loan, use the `manual_override` feature flag scoped to loan ID. Every override must:
- Include manager approval in audit log (`audit_events` table).
- Be disabled immediately after use.
- Trigger a follow-up compliance evaluation within one business day.

## Resources
- [Webhook Runbook](./webhooks.md)
- [Outbox Runbook](./outbox.md)
- Vendor contact directory (Confluence `Integrations/Vendors`)
