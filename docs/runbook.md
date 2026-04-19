# Runbook

## Purpose

Operate and recover the local Mermaid Tool desktop application on a workstation.

## Alerts And Failures

- App will not launch: verify `node_modules/` exists and rerun `npm run build`.
- Desktop icon does nothing: rerun `npm run install:desktop` and confirm the launcher script is executable.
- Two Mermaid Tool launchers are visible: rerun `npm run install:desktop`, confirm only `~/.local/share/applications/mermaid-tool.desktop` exists locally, then refresh the desktop session cache if needed.
- `.mmd` file does not open in Mermaid Tool: rerun `npm run install:desktop` or reinstall the Debian package to refresh MIME registration.
- Preview fails: inspect the Mermaid syntax in the editor and confirm the preview pane shows a valid render.
- AI builder cannot find models: confirm at least one supported local runtime is running, then refresh the model list in the left rail.
- Ollama checks `http://127.0.0.1:11434/api/tags` by default, LM Studio checks its OpenAI-compatible local server, and `llama.cpp` or similar servers are expected to expose `/v1/models`.
- AI dialogue layout feels wrong: confirm the repo build is the version being launched, then verify the dialogue collapses upward at the top of the left sidebar while starter diagram cards remain visible underneath.
- Export fails: confirm the preview is healthy first, then retry SVG or PNG export.
- File open or save fails: confirm the target path is writable and the file still exists.
- Autosave recovery looks wrong: inspect the per-tab draft files in `~/.config/Mermaid Tool/drafts/` on Linux and remove the stale `.json` entries you do not want restored.
- Packaged install problems: inspect `release/` artifacts, confirm `dpkg -i` completed, and re-run package generation.

## Dependencies

- Node.js 24+
- npm 11+
- local `node_modules` installation
- Electron runtime from the local dependency tree
- desktop entry support in `~/.local/share/applications` for launcher installation
- `update-desktop-database`, `update-mime-database`, and `xdg-mime` for richer desktop integration when available

## Recovery

1. Run `bash scripts/governance-preflight.sh`.
2. Run `npm install` if dependencies are missing or out of sync.
3. Run `npm run lint`, `npm run test`, `npm run build`, and `npm run secret-scan`.
4. Run `npm run package:linux` if the issue is specific to AppImage or Debian delivery.
5. Remove `dist/` and `release/` and rebuild if launch or package assets look stale.
6. Reinstall the launcher with `npm run install:desktop`.
7. Remove abandoned draft `.json` files from `~/.config/Mermaid Tool/drafts/` if the app keeps restoring work you no longer want.

## Escalation

- Owner: Adam Goodwin
- Technical lead for this implementation snapshot: codex session
- Escalate when validation fails repeatedly, when local file writes are unreliable, or when dependency vulnerability exposure materially changes
