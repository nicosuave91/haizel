#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  cat <<'USAGE'
Usage: validate.sh [domain]

Runs dig/nslookup queries for the apex and www hostnames to confirm DNS answers.
Defaults to haizeltechnology.com when no domain argument is supplied.
USAGE
  exit 0
fi

domain=${1:-haizeltechnology.com}
www_host="www.${domain#.}"

if command -v dig >/dev/null 2>&1; then
  echo "Checking ${domain} (A)..."
  dig +short "${domain}" A || true
  echo

  echo "Checking ${domain} (AAAA)..."
  dig +short "${domain}" AAAA || true
  echo

  echo "Checking ${domain} (CNAME)..."
  dig +short "${domain}" CNAME || true
  echo

  echo "Checking ${www_host} (CNAME)..."
  dig +short "${www_host}" CNAME || true
  echo

  echo "Checking ${www_host} (A)..."
  dig +short "${www_host}" A || true
  echo

  echo "Checking ${www_host} (AAAA)..."
  dig +short "${www_host}" AAAA || true
  echo
else
  echo "dig not found; falling back to nslookup." >&2
  for record in "${domain} A" "${domain} AAAA" "${domain} CNAME" "${www_host} CNAME" "${www_host} A" "${www_host} AAAA"; do
    name=${record% *}
    type=${record##* }
    echo "Checking ${name} (${type})..."
    nslookup -type="${type}" "${name}" || true
    echo
  done
fi
