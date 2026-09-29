# Changelog

## 0.4.0

- Improve graph node outlines and keyboard focus, show the active Local control, enlarge toolbar targets, and respect increased contrast and reduced motion preferences.
- Refine the Signal Field core: thinner branches, smaller nodes, softer glow, and quieter label hierarchy.
- Reduce node size and soften node fills; use a thinner, translucent visual hierarchy for selection and neighbors.
- Expand the default graph framing, simplify the ambient background, reduce dense-graph node size, soften hover emphasis, and preserve 9 px click targets with a transparent hit area.
- Pass published release tags to the asset verifier as quoted data instead of interpolating event input into shell source.
- Suppress lower-priority automatic labels when their estimated text boxes collide in dense graphs.
- Add Obsidian API stub checks for live graph refresh events and per-vault settings migration/persistence.
- Separate node keyboard actions: Enter opens, Space toggles persistent neighbor selection, Escape clears search/selection, and the context-menu shortcut remains available.
- Keep keyboard selections visually and accessibly exposed after focus moves.
- Let vault owners name the four configurable graph groups, with the names reflected in filters, legend, and populated Signal Field domains.
- Replace separate folder islands with a deterministic circular neural mesh; resolved links gently attract neighbors while local repulsion and a core exclusion preserve clear space.
- Keep Signal Field edges quiet at rest and make focused relationships stand out; group colors and filters remain available throughout the shared field.
- Refresh the open graph after vault file and metadata changes so new notes and edited links appear without reopening the view.
- Clarify that folder prefixes group notes while resolved Markdown links create graph edges.

- Support multiple folder prefixes per graph group for vaults with broader knowledge architectures.
- Exclude configured path prefixes from the graph while leaving vault notes untouched.
- Report how many notes are excluded by path filters in the graph footer.
- Keep existing single-prefix settings compatible.

## 0.3.0

- Balance large graphs across folder groups and link-group pairs so dense scopes cannot monopolize the view.
- Adapt graph layout and label density for larger vaults; reveal matching and focused labels on demand.
- Report node and link sampling limits in the graph footer.
- Update support links to the maintainer's page.

## 0.2.1

- Add filters and local graph exploration.
- Improve graph interactions, link direction cues, and release asset verification.
