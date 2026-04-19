# Roadmap

## Just Completed

- shipped a tabbed workspace so multiple Mermaid files can stay open at once in a single window
- added multi-window support for side-by-side editing sessions
- switched autosave and recovery from one shared session file to per-tab draft files
- aligned `Save As` and `Open` so unsaved-work flows start in the same local draft/save folder
- added a guided AI builder that can draft Mermaid changes through local-model conversation
- refined the AI sidebar so the dialogue collapses upward while the diagram picker remains visible
- kept Linux packaging, launcher behavior, and docs in sync with the current desktop workflow

## Now

- stabilize the new multi-tab, multi-window, and AI-guided workflow
- verify reinstall and daily-use behavior for the `0.2.x` packaged app
- keep documentation aligned with the actual operator workflow
- maintain the governance preflight, validation scripts, and launcher setup

## Next

- add recent files and reopen helpers so larger multi-file sessions are easier to resume
- add a side-by-side "AI draft vs current diagram" review step before applying assistant changes
- let users click a node in the preview to focus the assistant automatically
- add one-click starter prompts for common cases like org charts, process maps, and system context diagrams
- improve file associations for Mermaid-specific extensions and launcher metadata
- add package signing and release checks for distributable artifacts
- add richer export options such as PDF or clipboard image copy
- expand test coverage around tab lifecycle, draft recovery, and multi-window state

## Later

- add configurable themes, preferences, and starter libraries
- add lightweight undo history for AI-applied diagram drafts
- add reusable diagram snippets and domain packs for product, engineering, and operations diagrams
- explore inline assistant suggestions directly beside the editor instead of only in the sidebar
- revisit packaging, release automation, and vulnerability management as the app matures
