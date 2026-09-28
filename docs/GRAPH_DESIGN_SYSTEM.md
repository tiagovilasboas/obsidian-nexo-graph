# Nexo Graph — Signal Field design contract

Signal Field is Nexo Graph's current visual language. It arranges configured folder domains around a neutral core, draws resolved note links as curved paths, and uses color to distinguish configured groups. The graph renders with SVG and deterministic geometry through Obsidian's public plugin API.

## Data and classification

- Notes come from `vault.getMarkdownFiles()` and relationships from `metadataCache.resolvedLinks`.
- A folder prefix assigns a note to the first matching configured group. Prefixes do not create relationships.
- Unmatched notes use the neutral `Other` group. Cross-domain routing uses the configured group index.
- Group names, prefixes, and colors are stored per vault in plugin settings. The settings UI currently edits prefixes and colors for the four default group names.
- Graph refresh listens to vault create/modify/delete/rename and metadata-cache resolved/changed events.

## Geometry and density

The engine places notes deterministically in fixed group sectors around the core. There is no force simulation or layout physics. The view caps the rendered graph at 500 notes and 1,600 links, sampling across groups and group pairs so one large folder does not hide every smaller group. In dense graphs, labels are restricted by deterministic degree ranking; search matches and the focused note can reveal labels on demand. Cross-domain links use curved routes that avoid the core. Empty configured sectors may still reserve geometry; adaptive active-group layout is a tracked follow-up.

## Visual and interaction contract

- Four configurable green hues identify folder groups; neutral notes and the central core remain separate from those categories.
- Search, group filters, zoom, pan, local neighborhood depth, focused-note neighbors and contextual open are part of the current view.
- Search and interaction reveal information on demand instead of labeling every node in a dense graph.
- Cross-domain links remain visually distinct from quieter within-domain links.
- Motion is limited to the Signal Field background and must honor `prefers-reduced-motion`.
- Graph layout does not change Obsidian's native graph settings or edit notes.

## Guía e sensores de qualidade

Every graph change follows Harness Engineering's dual loop:

| Concern | Guia | Sensor | Classificação |
| --- | --- | --- | --- |
| Data and group semantics | This document and settings descriptions | Engine fixtures and manifest/CI checks | Computational; architecture fitness and behaviour |
| Visual legibility | Density, label, and color contract | Synthetic geometry tests plus Obsidian visual review | Computational and inferential; behaviour |
| Keyboard and motion | Interaction contract and accessible control names | DOM/API tests, reduced-motion stylesheet check, manual keyboard review | Computational and inferential; behaviour |
| Distribution | README and release checklist | Bundle, test, manifest, tag asset validation, clean install | Computational and inferential; maintainability |

CI is a computacional sensor for syntax, bundle consistency, engine tests, and manifest validity. A CI pass does not replace rendered visual/accessibility review in Obsidian. Do not use private RAG note names or screenshots as public fixtures.

## Evolution rules

1. Preserve deterministic placement unless user evidence and synthetic measurements justify a layout change.
2. Do not claim semantic clusters based only on folder prefixes.
3. Keep notes/links within the documented caps and expose sampling in the UI.
4. Every new interaction has a keyboard path, visible focus, and a sensor.
5. Every animation has a finite purpose and a reduced-motion path.
6. Keep the Obsidian public API boundary; do not use private Graph internals.
7. Treat adaptive group geometry, editable group names, DOM integration tests, and dense visual baselines as planned until implemented and verified.
