#!/usr/bin/env bash

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
electron_bin="${repo_root}/node_modules/electron/dist/electron"
log_dir="${XDG_STATE_HOME:-${HOME}/.local/state}/mermaid-tool"
log_file="${log_dir}/launcher.log"

needs_rebuild=false

is_output_missing() {
  [[ ! -f "${repo_root}/dist/electron/main.js" || ! -f "${repo_root}/dist/renderer/index.html" ]]
}

source_is_newer_than_build() {
  local source_root="${1}"

  if [[ ! -d "${source_root}" ]]; then
    return 1
  fi

  local newer_file
  newer_file="$(find "${source_root}" -type f -newer "${repo_root}/dist/electron/main.js" -print -quit 2>/dev/null || true)"
  [[ -n "${newer_file}" ]]
}

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

if is_output_missing; then
  needs_rebuild=true
fi

if [[ "${needs_rebuild}" == false ]] && (
  source_is_newer_than_build "${repo_root}/src" \
  || source_is_newer_than_build "${repo_root}/electron" \
  || source_is_newer_than_build "${repo_root}/shared"
); then
  needs_rebuild=true
fi

if [[ "${needs_rebuild}" == true ]]; then
  echo "Detected newer source files. Running npm run build before launch." >> "${log_file}" 2>&1
  if ! npm run build >> "${log_file}" 2>&1; then
    echo "Automatic build failed. See ${log_file} for details." >> "${log_file}" 2>&1
    exit 1
  fi
fi

exec "${electron_bin}" \
  --no-sandbox \
  --disable-gpu \
  --disable-gpu-compositing \
  --disable-software-rasterizer \
  --in-process-gpu \
  "${repo_root}" \
  "$@"
