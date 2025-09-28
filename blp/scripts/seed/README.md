# Sandbox Seed Data

Use these fixtures to load demo tenants and workflows in local development:

```bash
psql $DATABASE_URL -c "\copy vendor_integrations FROM 'scripts/seed/sandboxTenants.json' WITH (FORMAT json)"
```

Seed includes:
- Apex Lending tenant with sandbox vendor credentials
- Credit, AMC, and webhook secrets for contract testing
