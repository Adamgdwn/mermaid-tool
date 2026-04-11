# Risk Register

## Current Risk Classification

- Tier: Medium
- Owner: Adam Goodwin
- Last reviewed: 2026-04-11

## Key Risks

| ID | Risk | Likelihood | Impact | Controls | Owner | Status |
| --- | --- | --- | --- | --- | --- | --- |
| R-001 | Transitive `dompurify` advisories are currently reported through `monaco-editor` during `npm audit --omit=dev`. | Low | Medium | Local-only deployment, pinned validation workflow, regular dependency review, no remote multi-user surface. | Adam Goodwin | Open |
| R-002 | Users can still lose work if they ignore unsaved-change prompts or force-close the app. | Medium | Medium | In-app confirmation before document replacement and before window close, local save workflow, operator guidance in the manual. | Adam Goodwin | Mitigated |
| R-003 | Desktop launcher behavior may drift if the repo is moved after installation because the launcher stores an absolute path. | Medium | Low | Reinstall the desktop entry after moving the repo, document the recovery step in the runbook and deployment guide. | Adam Goodwin | Open |
| R-004 | Packaged Linux behavior may vary across distributions because Electron desktop integration depends on system MIME and desktop database tools. | Medium | Medium | AppImage and `.deb` both built and inspected, local launcher retained as fallback, packaging docs updated with recovery steps. | Adam Goodwin | Mitigated |
