# Synthetic visual baseline

This file defines the baseline to capture with generated notes only. No private RAG/Voomp note names, contents, or screenshots belong in this repository.

## Required captures

- Small vault: 8–20 notes across one, two, and four configured groups.
- Medium vault: 80–120 notes across all configured groups, with both local and cross-group links.
- Dense fixture: maximum supported 500 notes and representative links, reviewed at normal panel width and a narrow Obsidian pane.
- Capture group filters/legend, search match, local mode, and empty state in addition to the default graph.

Record Obsidian version, Nexo Graph version, theme mode, viewport/pane width, note/link counts, and whether reduced motion is active. Keep generated note paths generic and content non-sensitive.

## Existing computational baseline

The engine tests enforce deterministic selection/positions, the 500-note and 1,600-link limits, group-pair sampling, and a generous runtime budget on a synthetic fixture. This is a code-level test result, not a device-level rendering or memory claim. See `tests/graph-engine.test.js` for the executable contract.

## Not yet captured

- Rendered small and medium screenshots from a synthetic Obsidian vault.
- Obsidian UI review of a dense synthetic vault at normal and narrow pane sizes.
- Automated label collision, edge crossing, and minimum node-clearance measures.
- Keyboard/screen-reader observations from the rendered Obsidian view.

The private `voomp-kb` was previously used for a local smoke check; that does not substitute for this synthetic public baseline, and its screenshots/content remain untracked.
