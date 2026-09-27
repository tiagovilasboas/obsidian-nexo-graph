# Nexo Graph

**A graph view with its own signal.** Nexo Graph maps the links between your Markdown notes into a dark, luminous network with four configurable green groups.

[Download preview 0.1.0](../../releases/tag/0.1.0) · [Nexo theme](https://github.com/tiagovilasboas/obsidian-nexo) · [Report an issue](../../issues)

[![Buy me a coffee](https://raw.githubusercontent.com/tiagovilasboas/tiagovilasboas/main/assets/buy-me-a-coffee.svg)](https://buymeacoffee.com/nexoobsidian)

## What it does

- Opens a dedicated graph view from the ribbon or command palette.
- Reads Markdown files and resolved links through Obsidian's public plugin API.
- Places notes in four visual groups based on folder prefixes; unmatched notes form a neutral center.
- Supports search highlighting, zoom, drag to pan, and click or keyboard activation to open a note.
- Filters groups and can focus on notes connected to the last active note at one, two, or three link hops.
- Highlights a note's neighbors on hover/focus, shows link direction, and offers a context-menu action to open a note.
- Keyboard users can open that context menu with **Shift+F10** or the Context Menu key while a note is focused; reciprocal links share one edge with arrows at both ends.
- Keeps group settings in the vault's plugin data and updates when links or files change.

The graph uses a stable layout. For large vaults, it displays the 500 most connected notes and up to 1,600 links so the view remains responsive. The footer shows how many notes are visible. It does not modify notes, Obsidian's native Graph settings, or `.obsidian/graph.json`.

## Palette

| Group | Default folder prefix | Color |
| --- | --- | --- |
| Personal | `pages/pessoal/` | Mint `#84f5b2` |
| Career | `pages/carreira/` | Signal `#00ff41` |
| Operations | `pages/ops/` | Lime `#b8ff5a` |
| Meta | `pages/meta/` | Aqua `#00e5a0` |

Change prefixes and colors in **Settings → Community plugins → Nexo Graph**. Nexo Graph works without the Nexo theme, though the two share a palette.

Use the group toggles above the graph to focus on selected areas. Open Nexo Graph while viewing a note, then choose **Local** and a hop depth to explore its neighborhood.

## Install

1. Download `manifest.json`, `main.js`, and `styles.css` from [preview 0.1.0](../../releases/tag/0.1.0).
2. Put them in `<your-vault>/.obsidian/plugins/nexo-graph/`.
3. In Obsidian, turn on community plugins and enable **Nexo Graph**.
4. Choose **Open Nexo Graph** in the command palette or click its ribbon icon.

Community plugin gallery submission is planned. The manifest includes a funding link for the listing; until submission, this is a manual installation.

## Privacy and architecture

All rendering happens locally inside Obsidian. The plugin has no network calls, analytics, bundled dependencies, or access to private Graph internals. It uses `getMarkdownFiles()` and `metadataCache.resolvedLinks` from the public API, and only writes its own group settings.

The plugin is hand-written JavaScript and CSS, with no build step. Edit `main.js` and `styles.css` directly when developing locally.

## Support and feedback

Support development of Nexo Graph on [Buy Me a Coffee](https://buymeacoffee.com/nexoobsidian), or use [Issues](../../issues) for bugs and ideas.

Nexo Graph is original software distributed under the [MIT license](LICENSE).
