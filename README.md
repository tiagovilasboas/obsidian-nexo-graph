# Nexo Graph

**A graph view with its own signal.** Nexo Graph maps the links between your Markdown notes into a dark, luminous network with four configurable green groups.

[Download](../../releases/latest) · [Nexo theme](https://github.com/tiagovilasboas/obsidian-nexo) · [Report an issue](../../issues)

## What it does

- Opens a dedicated graph view from the ribbon or command palette.
- Reads Markdown files and resolved links through Obsidian's public plugin API.
- Places notes in four visual groups based on folder prefixes; unmatched notes form a neutral center.
- Supports search highlighting, zoom, drag to pan, and click or keyboard activation to open a note.
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

## Install

1. Download `manifest.json`, `main.js`, and `styles.css` from the [latest release](../../releases/latest).
2. Put them in `<your-vault>/.obsidian/plugins/nexo-graph/`.
3. In Obsidian, turn on community plugins and enable **Nexo Graph**.
4. Choose **Open Nexo Graph** in the command palette or click its ribbon icon.

Community plugin gallery submission is planned. Until then, this is a manual installation.

## Privacy and architecture

All rendering happens locally inside Obsidian. The plugin has no network calls, analytics, bundled dependencies, or access to private Graph internals. It uses `getMarkdownFiles()` and `metadataCache.resolvedLinks` from the public API, and only writes its own group settings.

The plugin is hand-written JavaScript and CSS, with no build step. Edit `main.js` and `styles.css` directly when developing locally.

## Support and feedback

Please use [Issues](../../issues) for bugs and ideas. A funding link will be added if an official support page is created.

Nexo Graph is original software distributed under the [MIT license](LICENSE).
