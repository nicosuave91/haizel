# Connector Services

This package contains Express-based connector shims for downstream vendor integrations. Each connector exposes quote, lock, AUS submission, credit pull, and e-sign webhook flows with a shared set of operational concerns:

- **Idempotency** using an in-memory cache keyed by the `Idempotency-Key` header.
- **Retries** with exponential backoff for outbound adapter calls.
- **HMAC verification** for inbound webhook signatures (`X-BLP-Signature`).
- **Vault-aware configuration placeholders** that surface environment overrides when running locally.

## Local development

```bash
# Install dependencies once at the workspace root
pnpm install

# Build the shared utilities consumed by the connectors
pnpm --filter @haizel/connectors-shared build

# Start all connector HTTP servers with live reload
pnpm --filter connectors dev
```

Each connector listens on the following default ports:

| Connector | Port | Primary Endpoints |
|-----------|------|-------------------|
| PPE Adapter | `3001` | `POST /api/v1/ppe/quotes`, `POST /api/v1/ppe/locks`, `GET /api/v1/ppe/locks/:lockId` |
| Credit Connector | `3002` | `POST /api/v1/credit/pulls`, `GET /api/v1/credit/pulls/:requestId` |
| AUS Gateway | `3003` | `POST /api/v1/aus/submit`, `GET /api/v1/aus/results/:loanId` |
| E-Sign Connector | `3004` | `POST /api/v1/esign/envelopes`, `GET /api/v1/esign/envelopes/:id`, `POST /api/v1/esign/webhooks` |

> **Note:** Secrets are represented via `vault:` placeholders by default. Set the relevant `*_API_KEY` or `ESIGN_WEBHOOK_SECRET` environment variables to override them during development.

## Pact contract tests

Each connector publishes consumer-driven contract tests using Pact. Run them individually or as a group:

```bash
# Execute all connector pact suites
pnpm --filter "apps/connectors/*" test

# Example: run only the credit connector tests
pnpm --filter credit test
```

Generated pact files are written to `apps/connectors/pacts/` and can be uploaded to a Pact broker as part of CI.
