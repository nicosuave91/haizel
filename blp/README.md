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
