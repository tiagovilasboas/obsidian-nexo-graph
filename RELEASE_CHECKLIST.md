# Release checklist

Use this checklist so the version users install matches the code and the README.

## Before publishing

- Update `manifest.json` with the release version; use a patch for fixes and a minor version for compatible features.
- Run the repository's quality workflow and require it to pass on the release commit.
- Confirm `main.js` is generated from `src/main.js` and `src/graph-engine.js` with `node scripts/bundle.mjs --check`.
- Review the changelog, install instructions, minimum Obsidian version, privacy statement, and the links in the release assets.
- Install the candidate files into a clean synthetic vault and open the graph view in Obsidian.

## Publish and verify

- Create a Git tag identical to `manifest.json`'s version.
- Attach exactly `main.js`, `manifest.json`, and `styles.css` from that tag to the GitHub release.
- Mark the release as latest only after the assets are uploaded and the notes describe the shipped behavior.
- Confirm the **Verify release assets** workflow passes. It downloads each asset and compares it byte-for-byte with the tagged source.
- Install the published assets in a clean vault and confirm the plugin loads, settings persist, graph limits are disclosed, and the help links work.

If post-publish verification fails, publish a corrected version; do not silently replace assets under an existing tag.
