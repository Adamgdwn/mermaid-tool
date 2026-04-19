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
   - `sudo dpkg -i "release/Mermaid Tool-0.2.1-amd64.deb"` for a system package
   - `chmod +x "release/Mermaid Tool-0.2.1-x86_64.AppImage"` and launch the AppImage directly
8. Launch `Mermaid Tool` from the applications menu, the installed package, the AppImage, or `bin/launch-mermaid-tool.sh`.
9. If you want the AI builder, start at least one supported local runtime before smoke testing:
   - Ollama on `http://127.0.0.1:11434`
   - LM Studio on `http://127.0.0.1:1234/v1`
   - `llama.cpp` or another OpenAI-compatible local server on a reachable `/v1` endpoint

## Rollback

1. Remove the desktop entry at `~/.local/share/applications/mermaid-tool.desktop` if installed.
2. Remove `~/.local/share/mime/packages/mermaid-tool.xml` and refresh MIME caches if reverting local file association.
3. Remove `dist/` and `release/` to clear the current build artifacts.
4. Uninstall the Debian package with `sudo dpkg -r mermaid-tool` if it was installed system-wide.
5. Reinstall dependencies or restore the previous source snapshot if needed.
6. Rebuild and reinstall the launcher or package once the rollback target is ready.

## Validation

- confirm the app launches without renderer errors
- open one or more sample `.mmd` files
- change the text and verify the preview refreshes
- save the file and confirm disk changes
- confirm `Open` starts in the expected local draft/save folder
- open several files and confirm they appear as tabs instead of replacing one another
- create a second window and confirm it stays independent from the first
- wipe the editor and confirm a blank document can be saved cleanly
- delete a saved test file and confirm the app returns to an untitled document
- open the preview in fullscreen and confirm `Escape` returns to the normal layout
- right-drag the preview canvas and confirm large diagrams pan smoothly
- scroll over the preview canvas and confirm zoom follows the cursor in normal and fullscreen modes
- use `Fit Width` and `Whole` and confirm large diagrams can be reviewed both as a readable document and as a full-map overview
- export both SVG and PNG successfully
- confirm the desktop launcher opens the app from the menu
- confirm only one Mermaid Tool launcher is shown when the local desktop entry overrides the packaged app
- confirm `.mmd` and `.mermaid` open in Mermaid Tool after installation
- confirm dirty tabs recover after relaunch
- confirm the AI builder can discover at least one supported local runtime when one is running
- confirm the AI dialogue collapses upward while starter diagram cards remain visible in the sidebar
- confirm the AppImage launches and the `.deb` installs cleanly
