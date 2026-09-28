# Obsidian API compatibility

`manifest.json` currently declares `minAppVersion: 1.13.0`. The release gate keeps an explicit registry of the Obsidian public API calls this plugin relies on and checks that each call remains present in its source file and that its documented API floor does not exceed the manifest floor.

| Public API used | API floor in the official TypeScript declaration | Source |
| --- | --- | --- |
| `Plugin.registerView`, `addRibbonIcon`, `addCommand`, `addSettingTab`, `registerEvent` | `0.9.7` | `src/main.js` |
| `Vault.getMarkdownFiles` | `0.9.7` | `src/graph-engine.js` |
| `Workspace.getLeaf('tab')` | `0.16.0` | `src/main.js` |

The highest annotated floor above is `0.16.0`, below the declared `1.13.0`. The static contract is a regression sensor for these registered calls; code review must add new Obsidian API usage to the registry with its official `@since` floor. Some declarations, including `MetadataCache.resolvedLinks` and its `resolved` event, do not include an `@since` annotation, so the registry does not invent a historical floor for them.

The installed application smoke test was observed on Obsidian `1.13.7`. That proves the current graph loads in that runtime; it does not prove compatibility with every earlier version down to `1.13.0`. Before release, run a clean synthetic-vault smoke test on the lowest supported app version or raise `minAppVersion` to the lowest version actually verified. The community submission guidance requires `minAppVersion` to represent the minimum version the plugin supports.

The computational guide/sensor pair is the explicit API inventory here plus `scripts/check-api-compatibility.mjs` in CI. This covers **architecture fitness** and **behaviour**: source API call inventory is computacional; compatibility judgement and the clean-install smoke test remain inferenciais.
