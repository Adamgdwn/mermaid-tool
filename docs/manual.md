# Manual

## What This Project Is

Mermaid Tool is a local desktop editor for Mermaid diagram files. It is meant to feel approachable for someone who just wants to open a file, edit the diagram text, and export a good-looking visual without learning a bigger design toolchain.

## How To Work In This Repo

1. Run `bash scripts/governance-preflight.sh`.
2. Review `project-control.yaml`.
3. Install dependencies with `npm install`.
4. Use `npm run lint`, `npm run test`, `npm run build`, and `npm run secret-scan` before considering the repo ready.
5. Update the docs when operator expectations, risks, or desktop workflow behavior change.

## Expected Outputs

- a working local Electron app
- built assets in `dist/`
- a launcher script in `bin/`
- a desktop entry installed through `npm run install:desktop`
- packaged Linux distributables in `release/`
- current operator and governance documentation

## Operator Notes

- `npm run start` builds the renderer and Electron code before launch.
- `bin/launch-mermaid-tool.sh` is the fastest repeat-launch path after dependencies are installed.
- `npm run package:linux` produces an AppImage and a Debian package for non-source installs.
- The app now supports multiple tabs per window and multiple windows at the same time.
- The app warns before replacing unsaved work in-editor and before closing the window with unsaved edits.
- In-progress edits autosave per tab to the Electron user-data folder and are recovered automatically on the next normal launch.
- `Save As` now opens in the same draft folder for unsaved diagrams, while existing saved files still default to their current folder.
- `Open` can import several files in one pass and adds them as tabs instead of replacing the active document.
- `Wipe` clears the current editor contents without deleting the file on disk until you save.
- `Delete File` permanently removes the current saved file from disk and then opens a fresh untitled document.
- `Full Screen` on the preview panel opens a presentation-style view and supports `Escape` to return.
- Right-click and drag on the preview to grab the canvas and pan around larger diagrams.
- Fullscreen preview now locks page scrolling so the canvas owns both horizontal and vertical grab-and-pan movement.
- Scroll directly over the preview canvas to zoom in or out around the cursor position.
- `Fit Width` is the best default reading mode for large diagrams, while `Whole` shows the entire graph bounds on one screen.
- Flowcharts now default to a tighter ELK-based layout so complex diagrams waste less space in preview and fullscreen.
- Built-in templates are meant as onboarding shortcuts, not authoritative Mermaid examples for every syntax feature.
- Export works best after the preview is green and rendering successfully.
- `npm run install:desktop` registers `.mmd` and `.mermaid` locally through the desktop database and MIME database.
