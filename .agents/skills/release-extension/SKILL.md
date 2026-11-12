---
name: release-extension
description: Cut a Deckyhub extension release: bump the version, merge to main, tag, and replace the generated notes. Use when the user asks to release, ship or publish the extension.
---

# Release the extension

1. Set the same `version` in `extension/manifest.json` and `extension/package.json` (browsers accept numbers only, so a pre-release keeps the number and gets the dash in the tag).
2. From `extension/`, run `npm ci && npm run build-all`. It must type-check and build both packages.
3. Merge to `main` through a pull request. Never merge without the user's OK.
4. Tag that commit `vX.Y.Z` (`vX.Y.Z-rc.N` for a pre-release) and push the tag. `release.yml` checks the tag against both versions, builds both packages, and attaches them with `SHA256SUMS.txt`.
5. Replace the generated notes with plain-language ones: what people will notice (new badges, new pages covered), not file names.

If the user-visible behavior, permissions or data sources changed, update the README first (see its Privacy section). A new permission or host is a release note too.

## Stores

`stores.yml` runs after `release.yml` succeeds and uploads the release's packages to the Chrome Web Store, Firefox Add-ons and Microsoft Edge Add-ons, each only when its secrets exist (the list is at the top of the workflow). Pre-release tags are skipped. Run it by hand from the Actions tab with a tag to retry. Opera has no upload API: upload `deckyhub-security-chromium-<tag>.zip` to Opera Add-ons yourself. The stores review each upload, so a release is not live right away. A store's first submission and listing are made by hand.
