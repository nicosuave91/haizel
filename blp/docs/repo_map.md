# Repository Map

This document provides a high-level map of the `blp/` workspace to help orient new contributors. Each section calls out the primary top-level directory along with notable subdirectories or modules and a short description of their role.

## Top-level directories

### `apps/`
Monorepo application services and executables.

- `apps/api/` – TypeScript orchestration layer that exports domain workflows and provider adapters (credit, AUS, e-sign, title, etc.) used by other services. Key modules live under `src/providers/` and `src/workflows/`.
- `apps/core-api/` – NestJS HTTP service that exposes domain services and Temporal workflow endpoints for the core lending platform. Source in `src/` with Jest tests in `test/`.
- `apps/connectors/` – Express-based connector shims for downstream vendor integrations (AUS gateway, credit, e-sign, PPE adapter). Shares utilities in `shared/` and publishes Pact contracts in `pacts/`.
- `apps/policy-bundle/` – Open Policy Agent (OPA) bundle tooling with Rego policies in `src/policy.rego` and tests under `src/tests/` packaged by `build_bundle.py`.
- `apps/rules-engine/` – FastAPI service implementing the rules evaluation DSL and REST endpoints (`app/api`) with core DSL models in `app/dsl/` and business services in `app/services/`.
- `apps/web/` – React UI workspace with file-based pages in `src/pages/`, shared components in `src/components/`, and styling in `src/styles/`.
- `apps/web-app-react/` – Placeholder scaffold for an additional React web client (see `README.md`).
- `apps/worker/` – Temporal worker process registering workflows/activities from `src/` with build tooling via `tsconfig.json` and tests in `test/`.

### `packages/`
Shared TypeScript packages consumed by multiple apps.

- `packages/domain/` – Core domain abstractions and workflow helpers (e.g., `src/workflow.ts`, `src/index.ts`) published as `@haizel/domain`.

### `db/`
Database artifacts and data lifecycle resources.

- `db/migrations/` – Hand-authored PostgreSQL migrations defining schema, RLS policies, and audit tables (e.g., `0001_init_tenancy.sql`).
- `db/prisma/` – Prisma schema (`schema.prisma`) and generated migration history used by TypeScript services.
- `db/seed/` – Seed data scripts such as `seed_reference_data.sql` for populating reference tables.
- `db/tests/` – Database-focused integration tests.

### `docs/`
Product and engineering documentation.

- `docs/ADRs/` – Architecture decision records.
- `docs/APIs/` – API references and OpenAPI artifacts.
- `docs/Policies/`, `docs/Runbooks/`, `docs/Security/` – Operational policies, runbooks, and security guidelines.

### `tests/`
Repository-level automated test suites outside individual apps.

- `tests/contract/` – Cross-service contract tests (e.g., webhook signature verification).
- `tests/unit/` – Shared unit tests not owned by a specific package.

### `infra/`
Infrastructure-as-code and deployment assets.

- `infra/docker-compose.dev.yml` – Local development stack configuration.
- `infra/helm/` – Helm chart placeholders for Kubernetes deployment manifests.
- `infra/terraform/` – Terraform modules (currently `main.tf`) for provisioning cloud resources.

### `scripts/`
Operational and developer tooling scripts.

- `scripts/seed/` – Sandbox seeding assets such as `sandboxTenants.json` with usage instructions in `README.md`.
- `scripts/webhook-simulator.js` – Utility for simulating webhook payloads during local testing.

### Workspace metadata

- `pnpm-workspace.yaml` – Defines the monorepo package graph.
- `tsconfig.base.json` – Shared TypeScript configuration inherited by packages and apps.
- `package.json`, `pnpm-lock.yaml` – Workspace dependency manifests.

