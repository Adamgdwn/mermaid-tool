#!/usr/bin/env bash

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
electron_bin="${repo_root}/node_modules/electron/dist/electron"
log_dir="${XDG_STATE_HOME:-${HOME}/.local/state}/mermaid-tool"
log_file="${log_dir}/launcher.log"

cd "${repo_root}"
unset ELECTRON_RUN_AS_NODE
mkdir -p "${log_dir}"

{
  echo "repo_root=${repo_root}"
  echo "PATH=${PATH:-}"
  echo "electron_bin=${electron_bin}"
} >> "${log_file}" 2>&1

if [[ ! -d "${repo_root}/node_modules" ]]; then
  echo "Dependencies are missing. Run npm install first." >> "${log_file}" 2>&1
  exit 1
fi

if [[ ! -f "${repo_root}/dist/electron/main.js" || ! -f "${repo_root}/dist/renderer/index.html" ]]; then
  echo "Built assets are missing. Run npm run build from a terminal first." >> "${log_file}" 2>&1
  exit 1
fi

exec "${electron_bin}" \
  --no-sandbox \
  --disable-gpu \
  --disable-gpu-compositing \
  --disable-software-rasterizer \
  --in-process-gpu \
  "${repo_root}" \
  "$@"
