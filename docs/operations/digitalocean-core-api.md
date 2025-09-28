# DigitalOcean App Platform — core-api Deployment

To ensure the App Platform build only compiles the NestJS `core-api` workspace from the monorepo, configure the service with the following settings:

- **Source directory:** `blp`
- **Runtime:** Node.js 20
- **Build command:**
  ```bash
  corepack enable && pnpm install --filter core-api... --frozen-lockfile && pnpm -r --filter 'core-api...' build && pnpm --filter core-api build
  ```
- **Run command:**
  ```bash
  pnpm --filter core-api exec node dist/main.js
  ```
- **HTTP port:** `3000`
- **Health check:** `/health`

The filtered `pnpm install` scope (`core-api...`) installs only the API workspace and its dependency graph, preventing other apps (such as the worker or frontend) from running their build steps during the DigitalOcean pipeline.

Before redeploying, validate locally from the repository root:

```bash
cd blp
corepack enable
pnpm install --filter core-api... --frozen-lockfile
pnpm -r --filter 'core-api...' build
pnpm --filter core-api build
pnpm --filter core-api exec node dist/main.js
curl http://localhost:3000/health
```

These commands mirror the App Platform pipeline so that any dependency or compilation errors can be caught locally before triggering a redeploy.
