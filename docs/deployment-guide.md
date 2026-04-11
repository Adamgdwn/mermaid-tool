# Deployment Guide

## Environments

- `dev`: source checkout with validation commands run locally
- `staging`: locally built app launched from `dist/` for smoke testing
- `prod`: launcher installed for day-to-day desktop use on the target machine

This project is a local desktop app, so deployment means preparing a machine to run the built Electron app reliably.

## Deployment Steps

1. Run `bash scripts/governance-preflight.sh`.
2. Run `npm install`.
3. Run `npm run lint`.
4. Run `npm run test`.
5. Run `npm run build`.
6. Run `npm run package:linux` to generate distributables in `release/`.
7. Install with either:
   - `npm run install:desktop` for the local source checkout flow
   - `sudo dpkg -i "release/Mermaid Tool-0.1.1-amd64.deb"` for a system package
   - `chmod +x "release/Mermaid Tool-0.1.1-x86_64.AppImage"` and launch the AppImage directly
8. Launch `Mermaid Tool` from the applications menu, the installed package, the AppImage, or `bin/launch-mermaid-tool.sh`.

## Rollback

1. Remove the desktop entry at `~/.local/share/applications/mermaid-tool.desktop` if installed.
2. Remove `~/.local/share/mime/packages/mermaid-tool.xml` and refresh MIME caches if reverting local file association.
3. Remove `dist/` and `release/` to clear the current build artifacts.
4. Uninstall the Debian package with `sudo dpkg -r mermaid-tool` if it was installed system-wide.
5. Reinstall dependencies or restore the previous source snapshot if needed.
6. Rebuild and reinstall the launcher or package once the rollback target is ready.

## Validation

- confirm the app launches without renderer errors
- open a sample `.mmd` file
- change the text and verify the preview refreshes
- save the file and confirm disk changes
- export both SVG and PNG successfully
- confirm the desktop launcher opens the app from the menu
- confirm `.mmd` and `.mermaid` open in Mermaid Tool after installation
- confirm the AppImage launches and the `.deb` installs cleanly
