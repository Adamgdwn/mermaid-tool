# Mermaid Tool

## Purpose

Mermaid Tool is a local desktop Mermaid editor for people who want a simple, polished way to open `.mmd` files, edit diagrams, preview them live, and export clean SVG or PNG assets without relying on a hosted web editor.

It is built for amateur-friendly local use:

- open Mermaid files from disk
- keep several documents open at once with tabs inside each window
- open multiple Mermaid Tool windows for side-by-side work
- edit diagrams in a large Monaco-powered editor
- preview changes immediately with the official `mermaid` package
- open a collapsible AI builder rail on the left and shape diagrams through plain-language back and forth
- target local-only models served on the workstation, with no hosted AI dependency
- keep the diagram picker visible while the dialogue panel collapses upward inside the same sidebar
- pop the live preview into a fullscreen presentation view on demand
- right-drag the preview canvas to grab and pan large diagrams
- zoom the preview by scrolling directly over the canvas
- fit oversized diagrams by width or whole-diagram view in preview and fullscreen
- use a tighter default flowchart layout so complex diagrams stay more compact and readable
- autosave in-progress drafts locally and recover them on restart
- autosave each open tab as its own local recovery draft
- open `Save As` for unsaved work directly in the same local draft folder used by autosave recovery
- default `Open` to that same local draft/save folder for a smoother round-trip workflow
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
3. If you want the AI builder, start any supported local runtime:
   - Ollama with at least one pulled chat model
   - LM Studio with its local server enabled
   - `llama.cpp` or another OpenAI-compatible local server
4. Build and launch with `npm run start`
5. Install the Linux desktop launcher with `npm run install:desktop`
6. Launch later with `bin/launch-mermaid-tool.sh` or from the desktop menu entry `Mermaid Tool`

## Packaged Linux Builds

- Build distributables with `npm run package:linux`
- Output artifacts are written to `release/`
- Current targets:
  - `release/Mermaid Tool-0.2.1-x86_64.AppImage`
  - `release/Mermaid Tool-0.2.1-amd64.deb`

## File Associations

- `npm run install:desktop` now installs a local desktop entry and Mermaid MIME definitions.
- the local install writes `~/.local/share/applications/mermaid-tool.desktop`, which reuses the normal Mermaid Tool desktop ID and points it at this repo checkout
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
