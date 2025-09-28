#!/usr/bin/env python3
"""Idempotent GoDaddy DNS upsert utility for apex and www records.

Usage examples:
  python infra/dns/godaddy_upsert/godaddy_upsert.py --config infra/dns/godaddy_upsert/config.json --dry-run
  python infra/dns/godaddy_upsert/godaddy_upsert.py --config infra/dns/godaddy_upsert/config.json --apply --backup-out backups/godaddy_$(date +%F).json
"""
from __future__ import annotations

import argparse
import datetime
import json
import os
import re
import sys
from typing import Dict, List, Mapping, MutableMapping, Optional, Sequence, Tuple
from urllib import error, request

API_BASE = "https://api.godaddy.com/v1"
ALLOWED_NAMES = {"@", "www"}
ALLOWED_TYPES = {"A", "AAAA", "CNAME"}


class ConfigError(RuntimeError):
    """Raised when the provided configuration is invalid."""


def load_config(path: str) -> Mapping[str, object]:
    try:
        with open(path, "r", encoding="utf-8") as handle:
            return json.load(handle)
    except FileNotFoundError as exc:
        raise ConfigError(f"Config file not found: {path}") from exc
    except json.JSONDecodeError as exc:
        raise ConfigError(f"Config file {path} is not valid JSON: {exc}") from exc


def expand_string(value: str) -> str:
    expanded = os.path.expandvars(value)
    unresolved_pattern = re.compile(r"\$(?:\{[^}]+\}|[A-Za-z_][A-Za-z0-9_]*)")
    if unresolved_pattern.search(expanded):
        raise ConfigError(
            f"Unresolved environment variable placeholder in value '{value}'."
        )
    return expanded.strip()


def normalize_values(raw_value: object) -> Tuple[List[str], bool]:
    if raw_value is None:
        return [], False
    if isinstance(raw_value, str):
        expanded = expand_string(raw_value)
        return ([expanded] if expanded else []), True
    if isinstance(raw_value, Sequence) and not isinstance(raw_value, (bytes, bytearray)):
        result: List[str] = []
        for item in raw_value:
            if not isinstance(item, str):
                raise ConfigError(
                    f"Record values must be strings; received {item!r} ({type(item).__name__})."
                )
            expanded = expand_string(item)
            if expanded:
                result.append(expanded)
        return result, True
    raise ConfigError(
        "Record values must be strings, arrays of strings, or null for omission."
    )


def build_desired_records(config: Mapping[str, object]) -> Tuple[str, int, Dict[Tuple[str, str], List[str]]]:
    domain = config.get("domain")
    if not isinstance(domain, str) or not domain:
        raise ConfigError("'domain' must be a non-empty string in the config.")

    ttl = config.get("ttl", 600)
    if not isinstance(ttl, int) or ttl <= 0:
        raise ConfigError("'ttl' must be a positive integer (seconds).")

    records_section = config.get("records")
    if not isinstance(records_section, Mapping):
        raise ConfigError("'records' must be an object mapping hostnames to record definitions.")

    desired: Dict[Tuple[str, str], List[str]] = {}
    for name, type_map in records_section.items():
        if name not in ALLOWED_NAMES:
            raise ConfigError(
                f"Record name '{name}' is not allowed. Only '@' and 'www' can be managed."
            )
        if not isinstance(type_map, Mapping):
            raise ConfigError(
                f"Record definitions for '{name}' must be an object mapping record types to values."
            )

        collected: MutableMapping[str, Tuple[List[str], bool]] = {}
        for record_type, raw_value in type_map.items():
            if record_type not in ALLOWED_TYPES:
                raise ConfigError(
                    f"Record type '{record_type}' for '{name}' is not permitted."
                )
            values, explicit = normalize_values(raw_value)
            if values or explicit:
                collected[record_type] = (values, explicit)

        non_empty_types = [rtype for rtype, (vals, _) in collected.items() if vals]
        if "CNAME" in non_empty_types and len(non_empty_types) > 1:
            raise ConfigError(
                f"CNAME records for '{name}' cannot coexist with other record types. "
                "Remove A/AAAA entries when using a CNAME."
            )

        for record_type, (values, _) in collected.items():
            key = (name, record_type)
            desired[key] = values

    if not desired:
        raise ConfigError("No records produced from config; check your inputs.")

    return domain, ttl, desired


def have_credentials() -> bool:
    return bool(os.getenv("GODADDY_API_KEY") and os.getenv("GODADDY_API_SECRET"))


def build_auth_header() -> str:
    api_key = os.getenv("GODADDY_API_KEY")
    api_secret = os.getenv("GODADDY_API_SECRET")
    if not api_key or not api_secret:
        raise ConfigError(
            "GODADDY_API_KEY and GODADDY_API_SECRET must be set in the environment to contact the API."
        )
    return f"sso-key {api_key}:{api_secret}"


def fetch_existing(domain: str, record_name: str, record_type: str) -> List[Mapping[str, object]]:
    auth_header = build_auth_header()
    url = f"{API_BASE}/domains/{domain}/records/{record_type}/{record_name}"
    req = request.Request(url, method="GET")
    req.add_header("Authorization", auth_header)
    req.add_header("Accept", "application/json")
    try:
        with request.urlopen(req) as resp:
            body = resp.read()
            if not body:
                return []
            try:
                parsed = json.loads(body)
            except json.JSONDecodeError as exc:
                raise RuntimeError(
                    f"Failed to parse GoDaddy API response for {record_type} {record_name}: {exc}"
                )
            if isinstance(parsed, list):
                return parsed
            raise RuntimeError(
                f"Unexpected response for {record_type} {record_name}: {parsed!r}"
            )
    except error.HTTPError as exc:
        if exc.code == 404:
            return []
        raise RuntimeError(
            f"GoDaddy API returned {exc.code} for {record_type} {record_name}: {exc.read().decode(errors='ignore')}"
        ) from exc


def records_equal(desired: List[str], existing: List[Mapping[str, object]], ttl: int) -> bool:
    desired_sorted = sorted(desired)
    existing_filtered = sorted(
        [str(item.get("data", "")).strip() for item in existing if item.get("data")]
    )
    if desired_sorted != existing_filtered:
        return False
    # TTL must match for all existing records we control.
    for item in existing:
        if item.get("data") in desired_sorted and int(item.get("ttl", ttl)) != ttl:
            return False
    return True


def plan_changes(domain: str, ttl: int, desired: Dict[Tuple[str, str], List[str]], *, offline: bool) -> Tuple[List[str], Dict[Tuple[str, str], List[Mapping[str, object]]]]:
    messages: List[str] = []
    existing_snapshot: Dict[Tuple[str, str], List[Mapping[str, object]]] = {}
    for (name, record_type), values in sorted(desired.items()):
        if offline:
            existing = []
        else:
            existing = fetch_existing(domain, name, record_type)
        existing_snapshot[(name, record_type)] = existing
        if offline:
            if values:
                messages.append(
                    f"Would set {record_type} {name} -> {', '.join(values)} (ttl {ttl}) [offline mode]."
                )
            else:
                messages.append(
                    f"Would delete {record_type} {name} [offline mode]."
                )
            continue

        if records_equal(values, existing, ttl):
            messages.append(f"No change for {record_type} {name} (already aligned).")
            continue
        if not values:
            if not existing and offline:
                messages.append(
                    f"Would delete {record_type} {name} (current records unknown without API credentials)."
                )
            elif not existing:
                messages.append(
                    f"No {record_type} {name} records exist; deletion request will keep it empty."
                )
            else:
                current = ", ".join(
                    str(item.get("data")) for item in existing if item.get("data")
                ) or "<empty>"
                messages.append(
                    f"Would delete {record_type} {name} (current values: {current})."
                )
            continue
        if not existing:
            messages.append(
                f"Would create {record_type} {name} -> {', '.join(values)} (ttl {ttl})."
            )
        else:
            current = ", ".join(str(item.get("data")) for item in existing if item.get("data")) or "<empty>"
            messages.append(
                f"Would replace {record_type} {name} ({current}) with {', '.join(values)} (ttl {ttl})."
            )
    return messages, existing_snapshot


def apply_changes(domain: str, ttl: int, desired: Dict[Tuple[str, str], List[str]], *, existing_snapshot: Dict[Tuple[str, str], List[Mapping[str, object]]], backup_out: Optional[str]) -> List[str]:
    auth_header = build_auth_header()
    changes: List[str] = []
    backup: Dict[str, object] = {
        "domain": domain,
        "generated_at": datetime.datetime.utcnow().isoformat() + "Z",
        "records": {},
    }

    for (name, record_type), values in sorted(desired.items()):
        existing = existing_snapshot.get((name, record_type), [])
        if records_equal(values, existing, ttl):
            continue
        key = f"{record_type} {name}"
        backup["records"][key] = existing
        url = f"{API_BASE}/domains/{domain}/records/{record_type}/{name}"
        payload = json.dumps(
            [
                {
                    "data": value,
                    "name": name,
                    "ttl": ttl,
                    "type": record_type,
                }
                for value in values
            ]
        ).encode("utf-8")
        req = request.Request(url, data=payload, method="PUT")
        req.add_header("Authorization", auth_header)
        req.add_header("Content-Type", "application/json")
        req.add_header("Accept", "application/json")
        try:
            with request.urlopen(req):
                pass
        except error.HTTPError as exc:
            raise RuntimeError(
                f"Failed to update {record_type} {name}: {exc.code} {exc.read().decode(errors='ignore')}"
            ) from exc
        if values:
            changes.append(f"Applied {record_type} {name} -> {', '.join(values)} (ttl {ttl}).")
        else:
            changes.append(f"Cleared all {record_type} {name} records.")

    if backup_out and backup["records"]:
        os.makedirs(os.path.dirname(backup_out) or ".", exist_ok=True)
        with open(backup_out, "w", encoding="utf-8") as handle:
            json.dump(backup, handle, indent=2)

    return changes


def main(argv: Optional[Sequence[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="Upsert GoDaddy DNS records for apex and www.")
    parser.add_argument("--config", required=True, help="Path to JSON configuration file.")
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--dry-run", action="store_true", help="Show planned changes without applying them (default).")
    mode.add_argument("--apply", action="store_true", help="Apply the planned changes to GoDaddy.")
    parser.add_argument(
        "--backup-out",
        help="Optional path to write a JSON backup of existing records before applying changes. Only used with --apply.",
    )

    args = parser.parse_args(argv)

    try:
        config = load_config(args.config)
        domain, ttl, desired = build_desired_records(config)
        offline = not have_credentials()
        if args.apply and offline:
            raise ConfigError("API credentials are required for --apply mode.")

        messages, existing_snapshot = plan_changes(domain, ttl, desired, offline=offline)

        print(f"Domain: {domain}\nTTL: {ttl}")
        if offline:
            print("Credentials not detected; running in offline mode. Existing records were not queried.")
        for message in messages:
            print(message)

        if args.apply:
            changes = apply_changes(
                domain,
                ttl,
                desired,
                existing_snapshot=existing_snapshot,
                backup_out=args.backup_out,
            )
            if changes:
                print("\nApplied changes:")
                for change in changes:
                    print(f"- {change}")
            else:
                print("\nNo changes were necessary; DNS already matches the desired state.")
        else:
            print("\nDry-run complete. Re-run with --apply to persist the changes." + ("" if offline else ""))
        return 0
    except ConfigError as exc:
        print(f"Configuration error: {exc}", file=sys.stderr)
        return 2
    except RuntimeError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
