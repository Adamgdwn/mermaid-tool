#!/usr/bin/env bash

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
desktop_dir="${HOME}/.local/share/applications"
desktop_file="${desktop_dir}/mermaid-tool.desktop"
legacy_desktop_file="${desktop_dir}/mermaid-tool-dev.desktop"
desktop_launcher_path="${repo_root}/bin/desktop-launch-mermaid-tool.sh"
icon_path="${repo_root}/assets/mermaid-tool-icon.svg"
mime_source="${repo_root}/packaging/linux/mime/mermaid-tool.xml"
mime_dir="${HOME}/.local/share/mime/packages"
mime_target="${mime_dir}/mermaid-tool.xml"

mkdir -p "${desktop_dir}"
mkdir -p "${mime_dir}"

install -m 0644 "${mime_source}" "${mime_target}"

cat > "${desktop_file}" <<EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=Mermaid Tool
Comment=Local Mermaid diagram editor with live preview and export
Exec=${desktop_launcher_path} %F
Icon=${icon_path}
Terminal=false
Categories=Graphics;
MimeType=text/x-mermaid;application/x-mermaid;text/plain;
StartupNotify=true
StartupWMClass=Mermaid Tool
EOF

chmod +x "${desktop_file}"
rm -f "${legacy_desktop_file}"

if command -v update-mime-database >/dev/null 2>&1; then
  update-mime-database "${HOME}/.local/share/mime" >/dev/null 2>&1 || true
fi

if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database "${desktop_dir}" >/dev/null 2>&1 || true
fi

if command -v xdg-mime >/dev/null 2>&1; then
  xdg-mime default mermaid-tool.desktop text/x-mermaid application/x-mermaid >/dev/null 2>&1 || true
fi

echo "Desktop entry installed at ${desktop_file}"
