#!/usr/bin/env bash

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
log_dir="${XDG_STATE_HOME:-${HOME}/.local/state}/mermaid-tool"
log_file="${log_dir}/launcher.log"

mkdir -p "${log_dir}"

{
  echo
  echo "=== $(date --iso-8601=seconds) desktop launch ==="
  echo "PWD=${PWD}"
  echo "DISPLAY=${DISPLAY:-}"
  echo "XDG_CURRENT_DESKTOP=${XDG_CURRENT_DESKTOP:-}"
  echo "PATH=${PATH:-}"
} >> "${log_file}" 2>&1

nohup "${repo_root}/bin/launch-mermaid-tool.sh" "$@" >> "${log_file}" 2>&1 </dev/null &

exit 0
