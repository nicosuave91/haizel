# Outbox Monitor Runbook

## Purpose
The outbox pipeline delivers workflow, webhook, and disclosure events to downstream systems. It must drain < 100 messages within five minutes (SLO).

## Dashboards & Alerts
- Grafana: `observability/outbox` — charts backlog (`outbox_backlog`) and drain latency.
- Alert: `OutboxDrainHigh` triggers when backlog > 100 for > 5 minutes.

## Response Checklist
1. Check the processing worker logs for stalled topics.
2. Inspect `outbox` table (scope by `tenant_id`) for stuck messages (`status != 'sent'`).
3. Trigger replay via UI (Admin → Outbox Monitor) or CLI:
   ```bash
   pnpm ts-node apps/api/src/workflows/replayOutbox.ts --tenant <tenant> --topic <topic>
   ```
4. Validate DLQ contents in `outbox.dlq`. Retry after fixing root cause.
5. Confirm success metrics return to baseline and close the incident in PagerDuty.

## Escalation
- If backlog remains high after two replay attempts escalate to Platform SRE.
- Coordinate with integrations if vendor webhooks are involved.
