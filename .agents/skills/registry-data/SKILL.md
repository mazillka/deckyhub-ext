---
name: registry-data
description: Change or diagnose how the Deckyhub extension fetches, caches, interprets, and displays registry audit and scan data.
---

# Registry data

Inspect `extension/src/background.ts` for the current source paths and shapes, caching, and lookup response; inspect `extension/src/contentscript.ts` for display behavior. The sources include the catalog on `main`, audit stats on `release-index`, scan summaries on `virus-scans`, and hash-indexed VirusTotal and MetaDefender reports on their respective report branches. Coordinate contract changes with the registry repository and preserve compatibility with published and cached data.

The service worker caches each source in extension-local storage for 30 minutes, shares in-flight requests, and falls back to a stale cached copy when refresh fails. Preserve the distinction between missing, unavailable, stale, incomplete and clean results. The displayed scan concerns the specified release ZIP, not arbitrary source code; avoid overstating the meaning of findings or a clean result.

Match repository identifiers case-insensitively and associate external reports only with validated SHA-256 hashes. Treat fetched values as untrusted when rendering text or constructing links. Do not introduce per-page data collection or new remote requests without updating permissions and the README's privacy description.

Verify changes against representative stable and pre-release data, missing or malformed reports, and failed refresh with and without a cached copy. Run the production build; report any browser or data checks not performed.
