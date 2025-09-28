# GoDaddy DNS automation for haizeltechnology.com

This repository includes scripts to manage the public DNS records for `haizeltechnology.com` and `www.haizeltechnology.com` through the GoDaddy Domains API. The automation targets the apex (`@`) and `www` hostnames only and supports either A/AAAA targets or CNAME routing depending on the production entrypoint you configure.

## Prerequisites

- GoDaddy production account with API access to the `haizeltechnology.com` zone.
- API credentials stored as environment variables:
  - `GODADDY_API_KEY`
  - `GODADDY_API_SECRET`
- Python 3.11+ and `curl`/`dig` for local validation (no external Python packages are required).
- Optional: `nslookup` if `dig` is unavailable for validation.

## Configure desired records

1. Copy the example configuration and tailor it to the desired routing strategy:

   ```bash
   cp infra/dns/godaddy_upsert/config.example.json infra/dns/godaddy_upsert/config.json
   ```

2. Edit `config.json` and set the record targets. The file contains placeholders for both strategies:

   - **Static A/AAAA targets** – set the IPv4 (and optional IPv6) addresses under the `A` and `AAAA` arrays for `"@"`, and leave or remove the `www` CNAME pointing at `@`.
   - **CNAME to a managed host** – replace the `"CNAME"` value under `"@"` with the fully qualified provider hostname and delete the `A`/`AAAA` arrays. The script will prevent mixing CNAME with A/AAAA for the same name.

   Remove any record blocks you do not need so the configuration only reflects the desired state. The `ttl` value applies to every managed record (default 600 seconds).

## Run the updater

Export the required environment variables before running the script:

```bash
export DOMAIN=haizeltechnology.com
export GODADDY_API_KEY=...   # stored in your secret manager locally or via CI secrets
export GODADDY_API_SECRET=...
```

Dry-run (no API writes):

```bash
python infra/dns/godaddy_upsert/godaddy_upsert.py --config infra/dns/godaddy_upsert/config.json --dry-run
```

If the GoDaddy credentials are not present the script still renders the plan, but it will skip reading the current state from the API and treat every record as a pending create.

Apply changes (requires credentials):

```bash
python infra/dns/godaddy_upsert/godaddy_upsert.py --config infra/dns/godaddy_upsert/config.json --apply --backup-out infra/dns/godaddy_upsert/backups/$(date +%F).json
```

- `--apply` performs the PUT requests against the GoDaddy Domains API.
- `--backup-out` writes a JSON snapshot of the records that were replaced, which can be used for manual rollback.

## Validate DNS answers

Use the helper script to confirm the apex and `www` answers after propagation:

```bash
bash infra/dns/godaddy_upsert/validate.sh haizeltechnology.com
```

The script runs `dig` (or `nslookup` if `dig` is unavailable) for A, AAAA, and CNAME records on both hostnames. Expect to see the new targets after the TTL window expires across resolvers.

## Rollback

1. If you specified `--backup-out`, locate the JSON file written during the change. The structure mirrors the GoDaddy record format.
2. Restore a record set by re-running the updater with the backup values placed back into `config.json`, or manually via the GoDaddy DNS dashboard using the captured values.
3. If necessary, delete a record by removing its entry from the config and re-running the script with `--apply`. Supplying an empty array will remove all records for that type/name pair.

Always run a dry-run before applying rollback changes to confirm the script intends to recreate the previous values.

## Continuous integration dry run

The repository defines `.github/workflows/dns_dryrun.yml` which compiles the Python script, lint-checks the shell helper, and executes the updater in dry-run mode against the example config. The workflow runs on pull requests and can also be triggered manually via the GitHub Actions UI. It does not require GoDaddy credentials and performs no API writes.

## Related make targets

After copying `config.example.json` to `config.json`, the following shortcuts are available:

```bash
make dns.dryrun     # dry-run the updater
make dns.apply      # apply the desired state (requires API credentials)
make dns.validate   # dig/nslookup checks for apex + www
```

See the `Makefile` for additional details and ensure environment variables are exported before invoking the targets.
