---
name: regression-guard
description: Check an extension change reaches every place it must and breaks nothing before calling it done - both browser builds, every GitHub page it renders on, parity with the plugin and deckyhub.com, and a test that fails without the fix. Use before finishing or opening a PR for any badge, wording, data-handling or manifest change, and when fixing a bug.
---

# Regression guard

A change is done when it holds on every page and in both browsers, not when one repository page looks right.

## 1. List every place it must reach

- **Three GitHub views.** The repository page, the Releases list and a single release each render their own block (`extension/src/content/panel.ts`: `render`, `releaseBlock`; `extension/src/content/badges.ts`: `badgeList` with `all` for repo-level facts). A badge or warning must be right in each, and `all` decides which views show repo-level facts such as Fork, In Decky store, AI and Rust.
- **Special registry entries.** A store-only entry (`app.store === true`) carries only the In Decky store badge; a repo missing from the registry shows nothing; stale cached data shows the cached notice; an unknown audit code must still render, never throw.
- **Parity.** The extension says what deckyhub.com and the plugin say, in the same words, never stronger (`badge-parity`). A badge added or reworded here is also added there, and the README and `store/chrome-listing.md` list the badges too.
- **Registry fields are additive.** The extension reads `stats.json` and `apps.json` as published (`registry-data`); a field it doesn't know must be ignored, a missing one must not crash.
- **Permissions and data sources.** A new host or permission is a README privacy change and a release note (`release-extension`).
- **Both browsers.** Chromium (`dist/`) and Firefox (`dist-firefox/`) build from the same source.

## 2. A bug gets a test that fails without the fix

Put it in `extension/test/` (run by `npm test`). Watch it fail on the old code first; a test that was never red proves nothing.

## 3. Run what CI runs

```bash
cd extension
npm ci
npm run build-all    # typecheck, tests, both builds
```

`manual-testing` covers checking it in a real browser; say plainly when that wasn't done.

## 4. Say what you did not check

End with what was skipped (a browser, a GitHub view, the Firefox build) and any risk.
