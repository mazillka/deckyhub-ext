---
name: extension-development
description: Implement or diagnose DeckyHub Security browser extension behavior, build configuration, manifest, GitHub page integration, and manual validation.
---

# Extension development

Work in `extension/`. Webpack builds `src/background.js` into `background.js` and `src/contentscript.js` into `contentscript.js`; it copies `src/content.css` and `manifest.json` into `dist/` and produces `extension.zip`. Edit source rather than generated output.

For GitHub page changes, account for Turbo/PJAX navigation, asynchronous responses arriving after navigation, repeated DOM mutations, and removal of the panel. Preserve accessible labels, GitHub theme variables, and safe DOM construction: registry-provided strings are untrusted, so use text nodes and validate values used in URLs. Keep manifest permissions and content-script matches limited to what is needed.

Run `npm ci` and `npm run build-prod` from `extension/` as appropriate. For visible or lifecycle changes, load `extension/dist/` as an unpacked extension and check a listed repository, an unlisted page, navigation between repositories, and relevant error states. Report any manual checks that could not be performed. Update README installation or privacy details when behavior changes.

For registry fetching or interpreting reports, also read [registry-data](../registry-data/SKILL.md).
