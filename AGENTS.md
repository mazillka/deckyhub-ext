# Deckyhub extension agent guide

This repository contains a Manifest V3 browser extension (Chromium browsers and Firefox) written in TypeScript. It shows DeckyHub registry safety information on GitHub repository, releases and release pages. Source and build configuration are in `extension/`; the installed artifact is `extension/dist/` (Chromium: Chrome, Edge, Opera, Brave, Vivaldi) or `extension/dist-firefox/` (Firefox, `npm run build-firefox`).

- `extension/src/background.ts` fetches, validates and caches registry data and answers lookup messages; `extension/src/types.ts` has the shapes it and the content script share.
- `extension/src/contentscript.ts` observes GitHub navigation and renders the panels (repo page, release list cards, single release); `extension/src/content.css` styles them.
- `extension/src/popup.ts`, `popup.html` and `popup.css` are the toolbar popup with the "collapse by default" setting (`chrome.storage.local`, key `deckyhub_collapse`).
- `extension/manifest.json` declares permissions and entry points; `extension/webpack.config.mjs` builds with ts-loader and creates the unpacked build and ZIP per browser, and adds what only Firefox's manifest needs (`FIREFOX` there).
- Skills are in `.agents/skills/` (index: [SKILLS.md](SKILLS.md)): `extension-development`, `registry-data`, `badge-parity`, `manual-testing`, `release-extension`. Read the public README when changing installation, privacy or user-visible behavior.

From `extension/`, run `npm ci` and `npm run build-all`: it type-checks (`npm run typecheck`, `tsc --noEmit`) and builds both packages. TypeScript is pinned to 5.x because ts-loader does not run on TypeScript 7. There is no automated test script: for behavior changes follow `manual-testing` and report what you could not check. CI builds both packages on Node 22 and keeps each ZIP as a workflow artifact.

Releases follow `release-extension`: same `version` in `extension/manifest.json` and `extension/package.json`, merged to `main`, then the tag `vX.Y.Z`. Never merge a PR without the user's OK.  After the release is built, `.github/workflows/stores.yml` publishes it to the Chrome, Firefox and Edge stores whose secrets are set (listed at the top of that file); Opera is a manual upload.

Keep the extension's permissions and network access as narrow as its features require. Do not claim scan results prove safety, or describe missing reports as clean. Registry data is untrusted: build DOM with text nodes and validate anything used in a URL.
