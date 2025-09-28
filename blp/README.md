# Broker-Lender Platform Monorepo Scaffold

This repository contains the initial scaffolding for the Broker-Lender Platform (BLP) MVP. It provides structured directories, configuration stubs, and placeholder documentation for the database, backend services, rules engine, policy bundles, connectors, and workflow workers.

The generated structure follows the architecture described in the specification, enabling further implementation of PostgreSQL with Row-Level Security, NestJS-based APIs, FastAPI rules engine, Auth0/OPA authorization, connector services, and Temporal workflows.

## Local development

1. Build the OPA policy bundle so the `opa` container can mount the compiled artifact:
   ```bash
   cd apps/policy-bundle
   python build_bundle.py --version dev --signing-key local
   ```
2. Start the local stack:
   ```bash
   cd ../..
   docker compose -f infra/docker-compose.dev.yml up --build
   ```
3. Once the containers are healthy, the following endpoints are available:
   - Postgres: `localhost:5432`
   - Redis: `localhost:6379`
   - Temporal: `localhost:7233` with UI on `http://localhost:8080`
   - OPA API: `http://localhost:8181`
   - MinIO console: `http://localhost:9001`
   - Connectors: `http://localhost:3001-3004`
   - Worker service: background worker connected to Temporal

Stop the stack with `docker compose -f infra/docker-compose.dev.yml down`.

## Running Core API integration tests

The Core API test suite now runs against a disposable PostgreSQL instance so that Prisma-backed services execute against the shared schema. Use the helper script to provision the database, apply migrations, run the Jest suite, and tear everything down automatically:

```bash
pnpm test:core-api
```

The script performs the following steps:

1. Launches a PostgreSQL 15 container defined in `infra/docker-compose.test.yml` and exports `DATABASE_URL` for downstream commands.
2. Waits for the database to become ready, then executes `pnpm --filter db exec prisma migrate deploy` so all tables required by `PrismaService` are available.
3. Runs `pnpm --filter core-api test`.
4. Shuts down the Docker Compose stack and removes the ephemeral volume.

The compose project name, port, and database URL can be customised via the `PROJECT_NAME`, `CORE_API_TEST_DB_PORT`, and `DATABASE_URL` environment variables respectively.
