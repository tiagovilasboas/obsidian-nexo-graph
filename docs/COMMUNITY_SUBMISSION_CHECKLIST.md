# Obsidian Community plugin submission checklist

This checklist prepares the first Nexo Graph listing. Release 0.4.0 is published; the Community directory submission still requires the maintainer's account and final install/runtime evidence.

## Repository and release

- [x] Repository is public: <https://github.com/tiagovilasboas/obsidian-nexo-graph>.
- [x] Root `README.md`, `LICENSE`, and `manifest.json` are present.
- [x] `manifest.json` uses plugin id `nexo-graph`, a semver version, a minimum app version, a short action-oriented description, and the maintainer's funding link.
- [x] Stable release `0.4.0` is the latest release and its tag matches the manifest version.
- [x] Release assets are `main.js`, `manifest.json`, and `styles.css`; the release verifier compares them with the tag.
- [x] Release `0.4.0` assets were downloaded and compared byte-for-byte with their tagged source; the release verification workflow passed on 29 September 2026.
- [x] README includes an original animated Signal Field illustration using synthetic data; it is clearly labeled as an illustration, not an Obsidian runtime screenshot.
- [x] The plugin uses Obsidian's public plugin API, has no bundled dependencies or telemetry, and declares `isDesktopOnly: false`.
- [ ] Reconfirm the plugin id is still unique in the official directory immediately before submission.
- [ ] Complete a clean-install review of the published `0.4.0` files, including console output and persistence of group settings. A synthetic dense vault was opened in Obsidian 1.13.7 and rendered 500 notes / 1,600 links with filters and graph controls. This runtime smoke did not verify console output or settings persistence and does not prove support for the declared minimum Obsidian 1.13.0.
- [ ] Add a real Obsidian runtime screenshot captured from the synthetic showcase vault before submitting the plugin listing; the README animation is not a substitute.

## Account and listing

- [ ] Sign in to the Obsidian Community directory with the maintainer's Obsidian account; the current browser tab is at the sign-in form.
- [ ] Connect the maintainer's GitHub account to verify repository ownership.
- [ ] Link the GitHub account, then select **Plugins → New plugin** and submit `https://github.com/tiagovilasboas/obsidian-nexo-graph`.
- [ ] Review automated feedback and resolve any reported issues before expecting in-app installation.
- [ ] Confirm the listing is public and installable from Obsidian after approval.

## Blocking items

Account sign-in and GitHub authorization must be completed by the maintainer. The directory requires both before a listing can be submitted. No credentials should be shared in this repository or chat.

## Official references

- [Submit your plugin](https://docs.obsidian.md/plugins/releasing/submit-plugin)
- [Plugin submission requirements](https://docs.obsidian.md/community-directory/submission-requirements-for-plugins)
- [Set up and claim a Community directory profile](https://docs.obsidian.md/community-directory/set-up-and-claim)
