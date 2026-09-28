# Synthetic visual baseline

This file defines the baseline to capture with generated notes only. No private RAG/Voomp note names, contents, or screenshots belong in this repository.

## Reproducible fixture generator

Create a new, empty temporary directory for each profile. The generator writes only generic folders and `node-###` notes, copies the three local plugin assets, writes Nexo Graph settings, and enables the plugin for that generated vault. It refuses a non-empty output directory and file paths outside that directory.

```sh
node scripts/create-synthetic-vault.mjs --profile small --groups 1 --output /tmp/nexo-small-one
node scripts/create-synthetic-vault.mjs --profile small --groups 2 --output /tmp/nexo-small-two
node scripts/create-synthetic-vault.mjs --profile small --groups 4 --output /tmp/nexo-small-four
node scripts/create-synthetic-vault.mjs --profile medium --output /tmp/nexo-medium
node scripts/create-synthetic-vault.mjs --profile dense --output /tmp/nexo-dense
```

The profiles contain 12 notes / 24 links, 96 notes / 384 links, and 500 notes / 1,600 links respectively. The generator is a computacional fixture sensor for deterministic synthetic input; it does not capture or evaluate a rendered graph.

## Required captures

- Small vault: 8–20 notes across one, two, and four configured groups.
- Medium vault: 80–120 notes across all configured groups, with both local and cross-group links.
- Dense fixture: maximum supported 500 notes and representative links, reviewed at normal panel width and a narrow Obsidian pane.
- Capture group filters/legend, search match, local mode, and empty state in addition to the default graph.

Record Obsidian version, Nexo Graph version, theme mode, viewport/pane width, note/link counts, and whether reduced motion is active. Keep generated note paths generic and content non-sensitive.

## Existing computational baseline

The engine tests enforce deterministic selection/positions, the 500-note and 1,600-link limits, group-pair sampling, and a generous runtime budget on a synthetic fixture. This is a code-level test result, not a device-level rendering or memory claim. See `tests/graph-engine.test.js` for the executable contract.

`scripts/graph-visual-metrics.mjs` counts intersections between sampled quadratic SVG edge polylines in a synthetic fixture, including intersections that land exactly on an interior sampled vertex. It ignores contacts at either curve's actual start/end and edge pairs that share a graph endpoint, then prints deterministic JSON. The curves are approximated with 24 line segments by default; tangencies, collinear overlap, and small crossings between sample points may be missed, while near-tangencies may be approximated as contacts. This metric is a computacional regression sensor and is not a rendered screenshot baseline or a measure of perceived quality.

## Remaining visual and accessibility review

- Rendered small and medium screenshots from a synthetic Obsidian vault.
- Obsidian UI review of a dense synthetic vault at normal and narrow pane sizes.
- Rendered automated label collision and minimum node-clearance measures. The current crossing approximation is implemented, but no rendered Obsidian fixture is yet connected to its output.
- Keyboard/screen-reader observations from the rendered Obsidian view.

The private `voomp-kb` was previously used for a local smoke check; that does not substitute for this synthetic public baseline, and its screenshots/content remain untracked.
