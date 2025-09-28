# Platform Health Report

## 1. Architecture Overview
- **Core API (NestJS)** – `AppModule` composes authentication, tenancy, loan/pricing, document management, AUS, credit, rules proxy, events, Temporal orchestration, and OPA authorization modules to service tenant-scoped lending operations.【F:apps/core-api/src/app.module.ts†L1-L38】
- **Connector Services (Express shims)** – Downstream vendor adapters run as independent HTTP services for PPE, credit, AUS, and e-sign flows, sharing idempotency, retry, webhook HMAC verification, and vault-aware configuration utilities.【F:apps/connectors/README.md†L1-L49】
- **Rules Engine (FastAPI)** – Configured via Pydantic settings with cached environment-backed configuration, exposing a versioned API for evaluating JSON-logic rulesets.【F:apps/rules-engine/app/core/config.py†L1-L24】
- **Temporal Worker** – Boots Temporal workers against configurable task queues/addresses, loading shared activities and workflows to execute asynchronous orchestration triggered by the core API.【F:apps/worker/src/index.ts†L1-L79】

## 2. Dependency & Tooling Posture
- The workspace uses `pnpm@9` with recursive scripts for build, lint, and test orchestration, plus a shell wrapper for row-level security (RLS) checks.【F:package.json†L1-L15】
- `docker-compose.dev.yml` provisions PostgreSQL (with migrations/seed), Redis, Redpanda, Temporal + UI, OPA, MinIO, ClamAV, Node-based app containers (core API, worker, connectors), and a Python rules engine, supplying shared development environment variables (database, Kafka, object storage, anti-virus).【F:infra/docker-compose.dev.yml†L1-L182】

## 3. CI Pipelines & Local Alignment
- **Core API CI** runs lint/test/build, generates API clients, and follows with security scans (pnpm audit, Semgrep, Trivy) and Docker image builds under a concurrency guard.【F:.github/workflows/ci-core.yml†L1-L208】
- **Connectors CI** fans out per connector for unit tests, Pact verification, linting, and Docker build artifacts with cached pnpm stores and log uploads for observability.【F:.github/workflows/ci-connectors.yml†L1-L245】
- **Rules Engine CI** installs Python dependencies, executes unit and regression pytest suites, enforces MyPy type checks, and builds container images when tests pass.【F:.github/workflows/ci-rules.yml†L1-L142】
- Local developer commands align with CI via `pnpm lint`, `pnpm -r build`, `pnpm test`, and `pnpm test:rls` (delegating to `db/tests/run_rls_checks.sh`), ensuring parity between workstation and pipeline expectations.【F:package.json†L1-L15】【F:db/tests/run_rls_checks.sh†L1-L9】

## 4. Testing Topology
- **Unit tests** cover observability utilities such as log redaction/PII detection for API logs.【F:tests/unit/logRedaction.test.ts†L1-L13】
- **Contract tests** validate webhook signature verification including replay protection via nonce storage.【F:tests/contract/webhookSignature.test.ts†L1-L40】
- **Rules DSL tests** exercise extended JSON-logic operators, short-circuit semantics, collection predicates, and error handling in the Python rules engine.【F:apps/rules-engine/tests/test_rules_dsl.py†L1-L66】

## 5. Security & Compliance Baselines
- **Authentication** verifies Auth0-issued JWTs, extracting tenant and permission claims for downstream authorization checks.【F:apps/core-api/src/auth/auth.service.ts†L1-L24】
- **Policy Enforcement** relies on OPA service logic that enforces tenant isolation and permission namespace scopes before performing document operations.【F:apps/core-api/src/opa/opa.service.ts†L1-L19】【F:apps/core-api/src/documents/documents.service.ts†L20-L74】
- **Webhook Verification** requires vendor-specific secrets, timestamp tolerances, and nonce replay protection to accept external callbacks.【F:apps/api/src/webhooks/security.ts†L1-L119】
- **Retention & Auditing Schema** defines tenant-scoped retention categories, policies, exemptions, holidays, and audit events with tenant triggers, updated-at hooks, and enforced RLS policies.【F:db/migrations/0004_audit_and_retention.sql†L1-L218】
- **RLS Regression Testing** seeds multi-tenant data to assert that row-level security and tenancy triggers prevent cross-tenant reads/writes, backing the `pnpm test:rls` command.【F:db/tests/rls_policies.sql†L1-L139】

## 6. Observability & Data Handling
- Metrics and tracing registries default to no-op implementations until overridden, providing hooks for workflow latency, vendor errors, webhook success ratios, and tracing spans without runtime overhead when unset.【F:apps/api/src/observability/metrics.ts†L1-L57】【F:apps/api/src/observability/tracing.ts†L1-L37】
- Log redaction utilities are unit-tested to detect and redact PII like SSNs before emitting telemetry.【F:tests/unit/logRedaction.test.ts†L1-L13】【F:apps/api/src/observability/logRedaction.ts†L1-L15】
- Credit providers redact sensitive fields (SSN, DOB) when emitting events or persisting payloads, enforcing consent token requirements for credit pulls.【F:apps/api/src/providers/credit.ts†L1-L94】
- Document uploads require OPA authorization, enforce tenant-specific Prisma lookups, and emit audit-friendly events while storing binary content with generated storage keys.【F:apps/core-api/src/documents/documents.service.ts†L20-L89】

## 7. Actionable Findings & Ownership
- **Observability integration gap (API Platform)** – Metrics and tracing default to no-op implementations; prioritize wiring to Prometheus/OpenTelemetry exporters to surface latency/error signals in production.【F:apps/api/src/observability/metrics.ts†L19-L57】【F:apps/api/src/observability/tracing.ts†L15-L37】
- **Document storage durability (Core API)** – Documents service persists binary objects in-memory, which risks data loss; align with MinIO/S3 storage configured in Docker compose for production parity.【F:apps/core-api/src/documents/documents.service.ts†L33-L58】【F:infra/docker-compose.dev.yml†L97-L161】
- **Connector secret management (Integrations)** – Static webhook secret provider requires explicit per-tenant/vendor configuration; formalize secret distribution and rotation to avoid runtime verification failures.【F:apps/api/src/webhooks/security.ts†L49-L119】
- **RLS verification automation (Data Platform)** – Ensure CI or scheduled jobs execute `pnpm test:rls` against managed Postgres instances so tenancy guarantees validated outside local environments.【F:package.json†L8-L15】【F:db/tests/rls_policies.sql†L1-L139】
