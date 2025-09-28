# Observability Rollout

## Collector & Export Pipeline

- Development uses the `otel-collector` service defined in `infra/docker-compose.dev.yml`. It exposes gRPC/HTTP OTLP on `localhost:4317/4318` and forwards traces to the co-located Jaeger UI (`http://localhost:16686`).
- Production deployment provisions an ECS Fargate task (`aws_ecs_service.otel_collector`) with an inline OTLP → vendor endpoint pipeline. Populate the following Terraform variables during rollout:
  - `collector_subnet_ids` / `collector_security_group_ids`
  - `tracing_backend_endpoint`
  - `ecs_task_execution_role_arn` / `ecs_task_role_arn`

## Application Wiring Summary

| Surface          | Instrumentation                                                        |
| ---------------- | ---------------------------------------------------------------------- |
| Nest core API    | `HttpSpanInterceptor` + Prisma span wrapper; correlated request IDs.   |
| Express connectors | Shared middleware sets tenant/vendor attributes; Express instrumentation configured via `initializeConnectorTelemetry`. |
| Temporal worker  | Activity inbound interceptor, workflow module, and OTLP sink to propagate trace headers across task queues. |
| FastAPI rules engine | OTLP SDK bootstrap with middleware attaching tenant/vendor attributes to spans. |

## Dashboards

1. **API Latency & Error SLO** – use `workflow_step_latency_seconds` and Nest inbound spans to chart p50/p95 latency by tenant. Alerts: p95 > 2s for 5m or error rate >2%.
2. **Connector Health** – counter `vendor_call_errors_total` plus Express spans tagged with `vendor.id` to show failure ratios and HTTP status codes.
3. **Temporal Pipeline** – Jaeger search for `workflow.*` spans to ensure worker links back to API trace IDs. Include lag gauges via `outbox_backlog` metric.
4. **Rules Engine Throughput** – FastAPI spans aggregated by tenant to confirm evaluation latency <500ms; add alert when tenant-specific failure rate >5%.

## Alert Runbooks

- **Core API latency breach**: check Jaeger trace for long-running Prisma spans; confirm collector health via ECS task logs. Roll back recent deploy or scale Temporal worker if queue spans show backlog.
- **Connector vendor errors spike**: inspect connector logs (search by `vendor.id`) and validate upstream vendor status page. Fallback to cached responses or circuit breaker until vendor recovery.
- **Temporal task backlog**: verify `opentelemetry` sink in worker logs, ensure OTLP exporter reachable. Scale worker task queue or purge stuck activities.
- **Rules Engine failure**: confirm FastAPI span attributes for tenant, check policy bundle version, redeploy if configuration drift detected.

## Verification & Load Tests

1. Start the local stack: `pnpm dev` (spins up collector, Jaeger, Temporal, etc.).
2. Seed traffic using the provided Jest integration suite: `pnpm --filter core-api test` (covers loan lifecycle, document upload, pricing lock flows). Confirm resulting traces in Jaeger with shared `blp.request_id`.
3. Optional sustained load: `npx autocannon -d 30 -c 20 http://localhost:3000/loans` while monitoring Jaeger and the metrics pipeline to ensure batches are exported without error.
4. Capture screenshots of Jaeger timelines and Prometheus dashboards for on-call review; store artifacts alongside this document.
