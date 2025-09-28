# Webhook Ingress Runbook

## Overview
Haizel receives vendor callbacks at `/integrations/webhooks/{vendor}`. Each request is HMAC protected using the vendor secret stored per tenant. The API validates:

1. `X-Haizel-Vendor` and `X-Haizel-Tenant` headers
2. Timestamp drift & nonce replay
3. HMAC signature based on `timestamp.bodySha256`

The controller maps payloads into workflow transitions and document attachments.

## Monitoring
- Dashboard: `Vendor Webhook Health` (Grafana `observability/webhooks`).
- SLO: success ratio ≥ 99.5% (`webhook_success_ratio`). Alerts fire on breach for 15 minutes.
- Dead-letter queue: `webhooks.dlq` drained by the outbox monitor.

## Triage Steps
1. **Identify failing vendor** in dashboard or alert payload.
2. **Inspect logs** via Kibana filtered by `trace.vendor` and `trace.correlationId`.
3. **Replay** the event using the simulator:
   ```bash
   TENANT_ID=<tenant> WEBHOOK_SECRET=<secret> ./scripts/webhook-simulator.js amc | http POST :3000/integrations/webhooks/amc
   ```
4. If signature errors persist, rotate the vendor secret and notify the vendor to update their configuration.

## Common Failures
- `CIRCUIT_OPEN`: upstream vendor outage. Circuit breaker resets in 30s—monitor, then coordinate with vendor if prolonged.
- `REPLAY`: duplicate webhook. Verify the vendor is not resending previously acknowledged events.
- `MANIFEST_BLOCK`: Document attachments missing—check S3 availability.

## Escalation
- After 2 consecutive alert breaches escalate to Integrations on-call (PagerDuty `haizel-integrations`).
- Engage Compliance lead if webhook ingestion affects disclosure timing.
