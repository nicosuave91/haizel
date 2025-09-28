# Prisma Engine Refresh

The Prisma CLI downloads platform-specific query engine binaries during `prisma generate`. Our CI sandbox runs in a Debian OpenSSL 3.0.x environment without outbound internet access, so we vendor the generated client and associated engine binaries for the core API.

## Current version
- Prisma CLI / `@prisma/client`: `5.14.0`
- Schema location: `apps/core-api/prisma/schema.prisma`
- Vendored output: `apps/core-api/prisma/generated/client`

## Refresh procedure
1. Ensure you are on a development machine with internet access and have installed dependencies: `pnpm install`.
2. Fetch the Debian OpenSSL 3.0.x engine and generate the client:
   ```bash
   pnpm --filter core-api exec prisma generate --binary-target=debian-openssl-3.0.x
   ```
3. Copy the generated payload into the vendored directory so it can be checked in:
   ```bash
   rsync -a apps/core-api/node_modules/.prisma/client/ apps/core-api/prisma/generated/client/
   ```
4. Commit the updated vendored client alongside any schema or Prisma version changes.
5. Run the prepared wrapper to stage the engine for subsequent `prisma generate` executions (local or CI):
   ```bash
   pnpm --filter core-api run prisma:generate
   ```

The wrapper copies the vendored binaries from `apps/core-api/prisma/generated/client` into `node_modules/.prisma/client` before invoking Prisma so that environments without network access reuse the checked-in assets.

> **Note:** Refresh the vendored client whenever `apps/core-api/prisma/schema.prisma` or the Prisma package versions change.
