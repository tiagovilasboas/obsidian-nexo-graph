# Changelog

## Unreleased

- Let vault owners name the four configurable graph groups, with the names reflected in filters, legend, and populated Signal Field domains.
- Place only populated configured groups around the neutral core; keep unclassified notes neutral outside the central mark.
- Keep Signal Field placement deterministic and route cross-domain links around the core as active group geometry changes.
- Refresh the open graph after vault file and metadata changes so new notes and edited links appear without reopening the view.
- Clarify that folder prefixes group notes while resolved Markdown links create graph edges.

## 0.4.0

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
