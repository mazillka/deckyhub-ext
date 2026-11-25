---
name: manual-testing
description: Check a Deckyhub extension change in a real browser, since the repo has no automated tests. Use before calling a behavior change done.
---

# Manual testing

There is no test script. `npm run typecheck` and `npm run build-all` catch type and build errors only; the behavior is checked by hand.

Load `extension/dist/` unpacked (Chrome/Edge: Extensions → Developer mode → Load unpacked; Firefox: `dist-firefox/manifest.json` under about:debugging). Reload the extension and the GitHub tab after every rebuild.

Use a plugin that has stable and pre-release scans, for example `MWGIH/DeckyMultiFrameGen`, and check:

- **Repo page** (`/owner/repo`): one panel with the name, DeckyHub links, Collapse button and the safety badges; no scan tables.
- **Releases list** (`/releases`): one block per release card. Releases without a scan say so; the newest stable/pre-release show badges and reports.
- **Single release** (`/releases/tag/<tag>`): the same block as in the list.
- **Links**: View on DeckyHub ends in `#v-<tag>`, Send to device in `?tag=<tag>#remote-install`.
- **Collapse**: the button works, and the popup's "Collapse panels by default" setting applies after a reload.
- **Navigation**: move between repos and tabs without a reload (Turbo): no stale or duplicate panels.
- **Not listed / unavailable**: an unlisted repo shows nothing; with the network blocked and a cached copy, the stale notice appears.

Report which checks you could not do.
