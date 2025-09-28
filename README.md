# haizel

Developer environment for the Haizel mortgage application suite.

## Getting started

### Prerequisites

Make sure you have the following tools installed locally:

- [Docker](https://docs.docker.com/get-docker/) and Docker Compose V2
- [Node.js 20](https://nodejs.org/) with [Corepack](https://nodejs.org/api/corepack.html) enabled for `pnpm`
- Python 3.11+ if you plan to rebuild the policy bundle before running OPA

### Install dependencies

```bash
cd blp
corepack enable
pnpm install
```

The workspace uses `pnpm` workspaces, so the single `pnpm install` call will hydrate every package referenced by the compose services.

### Build the policy bundle (optional)

The OPA container mounts the generated bundle from `apps/policy-bundle/dist`. If you need to regenerate it (for example after updating policies) run:

```bash
cd blp
python apps/policy-bundle/build_bundle.py --skip-tests
```

This command writes `policy-bundle-dev.tar.gz` and metadata files to the `dist/` directory consumed by the OPA service.

### Start the local stack

Launch every dependency and application container with Docker Compose:

```bash
cd blp
docker compose -f infra/docker-compose.dev.yml up --build
```

The compose file provisions Postgres, Redis, Redpanda, Temporal (plus the UI), OPA, MinIO, and ClamAV alongside the Node.js connectors, the NestJS core API, the Temporal worker, and the FastAPI rules engine. The `postgres-migrate` one-shot service automatically applies the SQL migrations in `db/migrations/` and seeds reference data from `db/seed/` every time the stack starts, so the application containers boot with a ready-to-use schema.

### Quality checks

Run the workspace-level `pnpm` scripts from the `blp` directory to mirror what the GitHub Actions workflows expect before you push a branch:

- `pnpm lint` executes `pnpm -r lint` across every workspace, matching the lint jobs in [Core API CI](blp/.github/workflows/ci-core.yml) and [Connectors CI](blp/.github/workflows/ci-connectors.yml).
- `pnpm test` fans out to `pnpm -r test`, which aligns with the Node test suites triggered by both [Core API CI](blp/.github/workflows/ci-core.yml) and the connector matrix in [Connectors CI](blp/.github/workflows/ci-connectors.yml).
- `pnpm -r build` ensures each package still builds (and therefore type-checks) before shipping, mirroring the build stage in [Core API CI](blp/.github/workflows/ci-core.yml).
- `pnpm test:rls` runs `bash db/tests/run_rls_checks.sh`, which requires a running Postgres instance and a `DATABASE_URL` pointing at it (the compose stack provides this). Keeping the RLS policies passing prevents surprises when the API and connector tests in [Core API CI](blp/.github/workflows/ci-core.yml) and [Connectors CI](blp/.github/workflows/ci-connectors.yml) exercise the same tables.
- `pnpm run ci:quick` mirrors the build and test ordering that the main CI workflow executes so you can verify the same path locally.

### Lockfile maintenance

This repository enforces deterministic dependency resolution in CI with `pnpm install --frozen-lockfile`. When you change any `package.json`, run the helper below from the `blp` directory to regenerate the lockfile and dedupe packages, then commit the updated `blp/pnpm-lock.yaml` alongside your changes:

```bash
pnpm run lock:regen
git add blp/pnpm-lock.yaml
```

Skipping this step will cause the CI job to fail during the lockfile verification stage.

### Useful service endpoints

- Core API: <http://localhost:3000>
- Connectors: <http://localhost:3001-3004>
- Rules engine: <http://localhost:8000/docs>
- Temporal UI: <http://localhost:8080>
- OPA API: <http://localhost:8181>
- MinIO Console: <http://localhost:9001>
- Redpanda external port: `localhost:19092`
- Postgres: `localhost:5432` (`blp:blp`)

Stop the environment with `CTRL+C`. Use `docker compose -f infra/docker-compose.dev.yml down` to tear it down completely and remove the containers.

## DNS automation

GoDaddy DNS management for `haizeltechnology.com` lives under `infra/dns/godaddy_upsert/`. Copy the `config.example.json` file, tailor it to the desired apex/`www` routing strategy, and use the provided Makefile targets to dry-run, apply, and validate changes. Detailed operator instructions are available in [docs/domain_setup.md](docs/domain_setup.md).

## DigitalOcean App Platform deployment

The repository ships with an [app.yaml](app.yaml) App Spec that wires up the production builds for the customer-facing web app and the NestJS API. DigitalOcean can now detect the components automatically as long as the GitHub App has access to this repository. To update the running application:

1. Install and authenticate the [DigitalOcean CLI (`doctl`)](https://docs.digitalocean.com/reference/doctl/how-to/install/).
2. Apply the spec from the repository root:

   ```bash
   doctl apps update <APP_ID> --spec app.yaml
   ```

   Use `doctl apps create --spec app.yaml` the first time you spin up the stack.

The spec defines two components:

- **`core-api` service** – built from `./blp` with `pnpm --filter core-api run build` and started with `pnpm --filter core-api run start`. The NestJS server reads the `$PORT` environment variable (defaulting to `8080`) and exposes HTTP traffic under `/api`.
- **`web-app` static site** – also built from `./blp`, producing the compiled assets in `apps/web-app-react/dist` for deployment at the root route (`/`).

Because each component installs dependencies from the monorepo root, DigitalOcean's build jobs must keep access to the whole `blp/` workspace (the spec handles this by setting `source_dir: ./blp`).
