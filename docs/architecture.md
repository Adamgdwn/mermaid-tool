# Architecture Overview

## Summary

Mermaid Tool is a local-first Electron desktop application. The main process handles file dialogs, save and export writes, draft persistence, desktop-style window lifecycle, and launch-time file opening. The renderer provides a polished editing interface built with React, Monaco Editor, and the official Mermaid rendering engine.

## Components

- `electron/main.ts`: creates the desktop window, exposes file open/save/delete/export handlers, routes launch-time file opening, and stores the session draft in Electron user data.
- `electron/preload.ts`: safely bridges IPC methods into the renderer through `window.mermaidTool`.
- `src/App.tsx`: application shell, editing workflow, preview, right-drag preview panning, fullscreen presentation mode, template loading, zoom, and export actions.
- `src/lib/document.ts`: document naming, diagram detection, and export filename helpers.
- `src/lib/export.ts`: SVG-to-PNG conversion using `canvg`.
- `src/lib/templates.ts`: built-in starter diagrams for amateur-friendly onboarding.
- `bin/launch-mermaid-tool.sh`: local launcher that builds on demand and starts the Electron app.
- `scripts/install-desktop-entry.sh`: installs a Linux desktop entry in `~/.local/share/applications`.

## Data Flow

1. The user opens or creates a Mermaid document.
2. The renderer updates local React state with the working text.
3. Mermaid renders the current source into SVG entirely on the client.
4. When the current document is dirty, the renderer debounces a session-draft autosave request to the main process.
5. Export actions generate SVG text or render PNG bytes locally.
6. The Electron main process writes files chosen by the user to local disk and can restore the last draft on restart.

The app is local-only by default. It does not require a backend, does not move money, and does not intentionally handle sensitive data.

## Dependencies

- `electron`: desktop shell and local IPC surface
- `react` and `react-dom`: renderer UI
- `@monaco-editor/react` and `monaco-editor`: editing experience
- `mermaid`: official diagram rendering engine from `mermaid-js/mermaid`
- `canvg`: local SVG to PNG rasterization
- `vite`: renderer bundling
- `typescript`, `eslint`, `vitest`: validation and maintainability

## Key Decisions

- Use the official `mermaid` npm package instead of wrapping a remote editor.
- Keep all editing and export work local for simple amateur use and lower privacy risk.
- Use Electron rather than a browser-only app so `.mmd` files, launchers, and export flows feel native.
- Ship a Linux desktop entry instead of requiring the user to remember terminal commands after setup.
