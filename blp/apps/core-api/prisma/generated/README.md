# Vendored Prisma Client

The Prisma client generated from `schema.prisma` is stored here so CI environments without internet access can reuse the Node-API engine.

Use the refresh procedure in `docs/prisma-refresh.md` after bumping `@prisma/client` or modifying the schema to keep this directory in sync. The `pnpm --filter core-api run prisma:vendor` script copies the freshly generated client from `node_modules/.prisma/client` into this folder so it can be committed.
