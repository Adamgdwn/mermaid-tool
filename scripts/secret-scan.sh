#!/usr/bin/env bash

set -euo pipefail

if ! command -v rg >/dev/null 2>&1; then
  echo "ripgrep is required for secret scanning."
  exit 1
fi

patterns=(
  'AKIA[0-9A-Z]{16}'
  'ghp_[A-Za-z0-9]{36,}'
  'github_pat_[A-Za-z0-9_]{20,}'
  'sk-[A-Za-z0-9]{20,}'
  '-----BEGIN (RSA|EC|OPENSSH|DSA|PGP) PRIVATE KEY-----'
)

found_match=0
for pattern in "${patterns[@]}"; do
  if rg --hidden --glob '!.git/**' --glob '!dist/**' --glob '!node_modules/**' --line-number -- "${pattern}" "${PWD}"; then
    found_match=1
  fi
done

if [[ "${found_match}" -ne 0 ]]; then
  echo "Potential secrets found."
  exit 1
fi

echo "Secret scan passed."
