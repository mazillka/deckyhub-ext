# DeckyHub Security agent guide

This repository contains a Manifest V3 Chrome extension that displays DeckyHub registry security information on GitHub. The source and build configuration are in `extension/`; the installed artifact is `extension/dist/`.

- `extension/src/background.js` fetches, validates and caches registry data and answers lookup messages.
- `extension/src/contentscript.js` observes GitHub navigation and renders the panel; `extension/src/content.css` styles it.
- `extension/manifest.json` declares permissions and entry points; `extension/webpack.config.mjs` creates the unpacked build and ZIP.
- Follow the relevant shared skills in `.agents/skills/`. Read the public README when changing installation, privacy or user-visible behavior.

From `extension/`, run `npm ci` and `npm run build-prod` to validate the build. For behavior changes, also check the unpacked `dist/` extension on GitHub, including navigation and unavailable or stale data when relevant; report if browser testing was not possible. CI runs the production build on Node 20 and 22. There is no automated test script currently.

Keep the extension's permissions and network access as narrow as its features require. Do not claim scan results prove safety, or describe missing reports as clean.
