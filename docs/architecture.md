# Architecture Overview

## Summary

 Mermaid Tool is a local-first Electron desktop application. The main process handles file dialogs, save and export writes, draft persistence, multi-window lifecycle, and launch-time file opening. The renderer provides a polished editing interface built with React, Monaco Editor, and the official Mermaid rendering engine.

## Components

- `electron/main.ts`: creates desktop windows, exposes file open/save/delete/export handlers, routes launch-time file opening into the right window, stores per-tab drafts in Electron user data, and brokers dirty-window close confirmation.
- `electron/preload.ts`: safely bridges IPC methods into the renderer through `window.mermaidTool`.
- `src/App.tsx`: application shell, tab workspace, multi-document editing workflow, preview, true SVG scaling, fit-width and whole-view controls, wheel zoom, right-drag preview panning, fullscreen presentation mode, template loading, zoom, and export actions.
- `src/lib/document.ts`: document naming, diagram detection, and export filename helpers.
- `src/lib/export.ts`: SVG-to-PNG conversion using `canvg`.
- `src/lib/templates.ts`: built-in starter diagrams for amateur-friendly onboarding.
- `bin/launch-mermaid-tool.sh`: local launcher that builds on demand and starts the Electron app.
- `scripts/install-desktop-entry.sh`: installs a Linux desktop entry in `~/.local/share/applications`.

## Data Flow

1. The user opens or creates one or more Mermaid documents as tabs inside a window.
2. The renderer keeps independent tab state for content, save status, theme, and recovery draft metadata.
3. Mermaid renders the active tab source into SVG entirely on the client.
4. When a tab is dirty, the renderer debounces a per-tab autosave request to the main process.
5. Export actions generate SVG text or render PNG bytes locally for the active tab.
6. The Electron main process writes files chosen by the user to local disk and can restore multiple draft tabs on restart.

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
