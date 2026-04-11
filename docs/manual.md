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
- The app warns before replacing unsaved work in-editor and before closing the window with unsaved edits.
- Built-in templates are meant as onboarding shortcuts, not authoritative Mermaid examples for every syntax feature.
- Export works best after the preview is green and rendering successfully.
- `npm run install:desktop` registers `.mmd` and `.mermaid` locally through the desktop database and MIME database.
