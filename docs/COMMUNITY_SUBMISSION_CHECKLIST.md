# Obsidian Community plugin submission checklist

This checklist prepares the first Nexo Graph listing. It does not submit the plugin or publish a release.

## Repository and release

- [x] Repository is public: <https://github.com/tiagovilasboas/obsidian-nexo-graph>.
- [x] Root `README.md`, `LICENSE`, and `manifest.json` are present.
- [x] `manifest.json` uses plugin id `nexo-graph`, a semver version, a minimum app version, a short action-oriented description, and the maintainer's funding link.
- [x] Stable release `0.3.0` is the latest release and its tag matches the manifest version.
- [x] Release assets are `main.js`, `manifest.json`, and `styles.css`; the release verifier compares them with the tag.
- [x] The plugin uses Obsidian's public plugin API, has no bundled dependencies or telemetry, and declares `isDesktopOnly: false`.
- [ ] Reconfirm the plugin id is still unique in the official directory immediately before submission.
- [ ] Complete a clean-install review of the released files, including console output and persistence of group settings. The current synthetic-vault observation confirmed view load, group filters, and local graph depths; it did not verify console output or settings persistence.

## Account and listing

- [ ] Sign in to the Obsidian Community directory with the maintainer's Obsidian account.
- [ ] Connect the maintainer's GitHub account to verify repository ownership.
- [ ] Select **Plugins → New plugin** and submit `https://github.com/tiagovilasboas/obsidian-nexo-graph`.
- [ ] Review automated feedback and resolve any reported issues before expecting in-app installation.
- [ ] Confirm the listing is public and installable from Obsidian after approval.

## Blocking items

Account sign-in and GitHub authorization must be completed by the maintainer. The directory requires both before a listing can be submitted. No credentials should be shared in this repository or chat.

## Official references

- [Submit your plugin](https://docs.obsidian.md/plugins/releasing/submit-plugin)
- [Plugin submission requirements](https://docs.obsidian.md/community-directory/submission-requirements-for-plugins)
- [Set up and claim a Community directory profile](https://docs.obsidian.md/community-directory/set-up-and-claim)
