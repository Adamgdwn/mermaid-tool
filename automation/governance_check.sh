#!/usr/bin/env bash

set -euo pipefail

repo_root="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
project_control="${repo_root}/project-control.yaml"

if [[ ! -f "${project_control}" ]]; then
  echo "Missing project-control.yaml"
  exit 1
fi

required_files=(
  "README.md"
  "docs/architecture.md"
  "docs/manual.md"
  "docs/roadmap.md"
  "docs/deployment-guide.md"
  "docs/runbook.md"
  "docs/CHANGELOG.md"
  "docs/risks/risk-register.md"
)

missing_files=()
for relative_path in "${required_files[@]}"; do
  if [[ ! -f "${repo_root}/${relative_path}" ]]; then
    missing_files+=("${relative_path}")
  fi
done

if (( ${#missing_files[@]} > 0 )); then
  echo "Governance check failed: missing required files:"
  printf ' - %s\n' "${missing_files[@]}"
  exit 1
fi

if [[ -f "${repo_root}/package.json" ]]; then
  script_errors=()
  for script_name in lint test secret-scan; do
    if ! grep -q "\"${script_name}\"" "${repo_root}/package.json"; then
      script_errors+=("${script_name}")
    fi
  done

  if (( ${#script_errors[@]} > 0 )); then
    echo "Governance check failed: package.json is missing required scripts:"
    printf ' - %s\n' "${script_errors[@]}"
    exit 1
  fi
fi

echo "Governance preflight passed."
