# Change Log

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
