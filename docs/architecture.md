# Architecture Overview

## Summary

 Mermaid Tool is a local-first Electron desktop application. The main process handles file dialogs, save and export writes, draft persistence, multi-window lifecycle, launch-time file opening, and the local-model bridge for AI-assisted diagram drafting. The renderer provides a polished editing interface built with React, Monaco Editor, and the official Mermaid rendering engine.

## Components

- `electron/main.ts`: creates desktop windows, exposes file open/save/delete/export handlers, routes launch-time file opening into the right window, stores per-tab drafts in Electron user data, and brokers dirty-window close confirmation.
- `electron/preload.ts`: safely bridges IPC methods into the renderer through `window.mermaidTool`, including local runtime discovery and assistant chat requests.
- `electron/local-models.ts`: probes supported local AI runtimes, lists models, and routes assistant chat requests to the chosen runtime.
- `src/App.tsx`: application shell, tab workspace, fixed-width sidebar, top-collapsing AI dialogue shell, starter diagram chooser, node selector, multi-document editing workflow, preview, true SVG scaling, fit-width and whole-view controls, wheel zoom, right-drag preview panning, fullscreen presentation mode, template loading, zoom, and export actions.
- `src/lib/assistant.ts`: extracts node-like elements from Mermaid text, normalizes AI drafts, and provides assistant copy used by the renderer.
- `src/lib/document.ts`: document naming, diagram detection, and export filename helpers.
- `src/lib/export.ts`: SVG-to-PNG conversion using `canvg`.
- `src/lib/templates.ts`: built-in starter diagrams for amateur-friendly onboarding.
- `bin/launch-mermaid-tool.sh`: local launcher that builds on demand and starts the Electron app.
- `scripts/install-desktop-entry.sh`: installs a Linux desktop entry in `~/.local/share/applications`.

## Data Flow

1. The user opens or creates one or more Mermaid documents as tabs inside a window.
2. The renderer keeps independent tab state for content, save status, theme, and recovery draft metadata.
3. Mermaid renders the active tab source into SVG entirely on the client.
4. The optional AI builder keeps the starter diagram chooser visible at all times, expands a dialogue shell at the top of the left sidebar, and sends the current Mermaid source, focused node, and chat history to the chosen local runtime for a full updated Mermaid draft.
5. When a tab is dirty, the renderer debounces a per-tab autosave request to the main process.
6. Export actions generate SVG text or render PNG bytes locally for the active tab.
7. The Electron main process writes files chosen by the user to local disk and can restore multiple draft tabs on restart.

The app is local-only by default. It does not require a backend, does not move money, and does not intentionally handle sensitive data.

## Dependencies

- `electron`: desktop shell and local IPC surface
- `react` and `react-dom`: renderer UI
- `@monaco-editor/react` and `monaco-editor`: editing experience
- `mermaid`: official diagram rendering engine from `mermaid-js/mermaid`
- local AI runtimes over localhost, including Ollama and OpenAI-compatible servers such as LM Studio or `llama.cpp`
- `canvg`: local SVG to PNG rasterization
- `vite`: renderer bundling
- `typescript`, `eslint`, `vitest`: validation and maintainability

## Key Decisions

- Use the official `mermaid` npm package instead of wrapping a remote editor.
- Keep all editing and export work local for simple amateur use and lower privacy risk.
- Use a localhost model bridge rather than a hosted AI API so the guided builder stays local-first.
- Keep the assistant shell inside the existing left rail so the UI stays familiar and users can always see diagram choices before opening the dialogue.
- Use Electron rather than a browser-only app so `.mmd` files, launchers, and export flows feel native.
- Ship a Linux desktop entry instead of requiring the user to remember terminal commands after setup.
