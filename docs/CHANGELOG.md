# Change Log

## 0.2.3 - 2026-04-19

- changed the assistant sidebar so the dialogue collapses upward inside the existing left column while the diagram picker remains visible
- moved the assistant transcript and prompt composer to the top of the expanded dialogue area
- simplified the local desktop integration back to one `mermaid-tool.desktop` launcher and refreshed the docs around deployment, recovery, and roadmap ideas

## 0.2.2 - 2026-04-18

- added a collapsible left-edge AI builder rail so users can guide Mermaid diagrams through natural-language conversation
- expanded local-model discovery and chat wiring to auto-detect Ollama, LM Studio, and other OpenAI-compatible localhost runtimes
- added node detection and node-focused prompting so the guided builder can target specific parts of the active diagram
- made the repo launcher rebuild automatically when local source files are newer than the built app and moved the local desktop install back to a single `mermaid-tool.desktop` override so the repo checkout does not publish a second launcher

## 0.2.1 - 2026-04-11

- made the `Open` dialog start in the same draft/save folder used by unsaved `Save As`

## 0.2.0 - 2026-04-11

- added tabbed editing so multiple Mermaid files can stay open concurrently inside the same window
- added multi-window Electron support with `New Window` and per-window file routing
- switched draft recovery from a single session file to per-tab draft files so concurrent work can be restored cleanly
- updated open, save, close-tab, and startup flows to work against the active tab instead of replacing the whole workspace

## 0.1.9 - 2026-04-11

- made `Save As` default to the local draft folder for unsaved diagrams so the dialog lines up with autosave recovery
- kept `Save As` anchored to the current file folder when you are editing an existing saved document

## 0.1.8 - 2026-04-11

- tightened the default Mermaid flowchart layout so large diagrams use space more logically and wrap labels sooner
- fixed fullscreen preview scrolling so grab-and-pan works vertically as well as horizontally
- changed fullscreen preview styling to keep the canvas on a single paper-like surface instead of reading like separate screens

## 0.1.7 - 2026-04-11

- changed fullscreen entry to open in fit-width mode so large diagrams feel readable instead of poster-sized
- split preview fitting into `Fit Width` and `Whole` so users can choose between reading and overview modes

## 0.1.6 - 2026-04-11

- replaced transform-based preview zoom with true SVG resizing so the canvas scroll area matches the visible diagram
- added fit-to-view controls and a deeper zoom-out range for large diagrams in preview and fullscreen mode

## 0.1.5 - 2026-04-11

- added wheel-based zoom directly on the preview canvas in both normal and fullscreen modes
- fixed dirty-window shutdown so closing the app now shows an Electron discard prompt instead of silently refusing to quit

## 0.1.4 - 2026-04-11

- added right-click grab-and-pan behavior for the preview canvas in both normal and fullscreen modes
- added cursor feedback and disabled the browser context menu on the diagram surface to support panning

## 0.1.3 - 2026-04-11

- added a fullscreen presentation mode for the live preview canvas
- added an in-app close path and `Escape` handling to return from fullscreen preview cleanly

## 0.1.2 - 2026-04-11

- added automatic local draft save and recovery for in-progress diagrams
- added desktop-style File menu commands for new, open, save, save as, wipe, delete, and export actions
- added explicit `Wipe` and `Delete File` controls to the main toolbar
- hardened the renderer and Electron contract around file deletion and draft persistence

## 0.1.1 - 2026-04-11

- fixed the `New` action so it opens a truly blank untitled document
- rebuilt the Linux packages so the installed app can pick up the corrected editor actions

## 0.1.0 - 2026-04-11

- built the first functional Electron desktop application for local Mermaid editing
- added Monaco-based editing, live Mermaid preview, theme switching, zoom, and starter templates
- added local SVG and PNG export flows
- added a launcher script and Linux desktop entry installer
- added Linux AppImage and Debian packaging with generated icons
- added `.mmd` and `.mermaid` MIME registration and desktop file association support
- added governance preflight support, lint, tests, build, and secret-scan hooks
- replaced placeholder repo documentation with project-specific operating docs
