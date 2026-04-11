# Mermaid Tool

## Purpose

Mermaid Tool is a local desktop Mermaid editor for people who want a simple, polished way to open `.mmd` files, edit diagrams, preview them live, and export clean SVG or PNG assets without relying on a hosted web editor.

It is built for amateur-friendly local use:

- open Mermaid files from disk
- edit diagrams in a large Monaco-powered editor
- preview changes immediately with the official `mermaid` package
- pop the live preview into a fullscreen presentation view on demand
- right-drag the preview canvas to grab and pan large diagrams
- zoom the preview by scrolling directly over the canvas
- autosave in-progress drafts locally and recover them on restart
- wipe the editor or delete the current saved file from inside the app
- export SVG and PNG locally
- install a Linux desktop launcher for one-click startup

## Status

- Owner: Adam Goodwin
- Technical lead: codex session
- Risk tier: Medium
- Production status: Local desktop app ready for install and use

## Quick Start

1. Run `bash scripts/governance-preflight.sh`
2. Install dependencies with `npm install`
3. Build and launch with `npm run start`
4. Install the Linux desktop launcher with `npm run install:desktop`
5. Launch later with `bin/launch-mermaid-tool.sh` or from the desktop menu entry `Mermaid Tool`

## Packaged Linux Builds

- Build distributables with `npm run package:linux`
- Output artifacts are written to `release/`
- Current targets:
  - `release/Mermaid Tool-0.1.5-x86_64.AppImage`
  - `release/Mermaid Tool-0.1.5-amd64.deb`

## File Associations

- `npm run install:desktop` now installs a local desktop entry and Mermaid MIME definitions.
- `.mmd` and `.mermaid` are registered locally and set to open with `Mermaid Tool` on this machine.

## Validation Commands

- `bash scripts/governance-preflight.sh`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run package:linux`
- `npm run secret-scan`

## Documentation

- `docs/architecture.md`
- `docs/manual.md`
- `docs/roadmap.md`
- `docs/deployment-guide.md`
- `docs/runbook.md`
- `docs/CHANGELOG.md`
- `docs/risks/risk-register.md`

## Support Model

This project is maintained as a local application. Operational support is currently owner-led. When behavior changes, update the docs and rerun the governance preflight before shipping additional features.
