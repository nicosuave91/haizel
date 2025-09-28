PYTHON ?= python3
CONFIG ?= infra/dns/godaddy_upsert/config.json
BACKUP_OUT ?=

.PHONY: dns.dryrun dns.apply dns.validate

dns.dryrun: ## Validate config and show planned DNS changes
	@$(PYTHON) infra/dns/godaddy_upsert/godaddy_upsert.py --config $(CONFIG) --dry-run

dns.apply: ## Apply DNS changes to GoDaddy (requires env secrets)
	@$(PYTHON) infra/dns/godaddy_upsert/godaddy_upsert.py --config $(CONFIG) --apply $(if $(BACKUP_OUT),--backup-out $(BACKUP_OUT))

dns.validate: ## Query DNS to confirm answers
	@bash infra/dns/godaddy_upsert/validate.sh $(or $(DOMAIN),haizeltechnology.com)
