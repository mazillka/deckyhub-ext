---
name: update-dependencies
description: Keep the Deckyhub extension's packages and GitHub Actions up to date in one pull request. Use when asked to update, upgrade or bump packages or dependencies, when a Dependabot PR needs folding in, before a release, or at the start of any change that touches the build.
---

# Keeping the extension's dependencies current

Two places pin versions. Update both together, in one PR, so a release never ships half-updated:

| Where | Manager | Check | Update |
| --- | --- | --- | --- |
| `extension/package.json` + `package-lock.json` | npm | `npm outdated` (from `extension/`) | `npm install <pkg>@latest ...` |
| `.github/workflows/*.yml` | pinned commit SHA plus a `# vX.Y.Z` comment | `gh release list -R <owner>/<action> --limit 1` per action | replace both the SHA and the comment |

## Steps

1. Branch from `origin/main` (`update-dependencies-<yyyy-mm-dd>`) and open the PR against `main`. Never update on `main` or on a feature branch. Never merge without the user's OK.
2. Run both checks. If nothing is outdated, stop and say so: don't open an empty PR.
3. Update. Rules:
   - TypeScript stays on 5.x: `ts-loader` does not run on TypeScript 7. Say so in the PR if a newer major is held back for this.
   - `@types/chrome` follows what the manifest and the code really use; read its changelog on a minor bump too, because its types change often.
   - For an Action, take the SHA the release tag points at (`gh api repos/<owner>/<action>/git/ref/tags/<tag> --jq .object.sha`, following an annotated tag to its commit), never a branch. Keep the `# vX.Y.Z` comment in step with it.
   - Node in the workflows stays on the version the build needs (22 today); raise it only when a dependency requires it.
   - A **major** bump: read the package's changelog for breaking changes before running anything, and say in the PR what changed and why the code still fits.
4. Verify from `extension/`: `npm ci && npm run build-all` must type-check and build both packages (Chromium `dist/`, Firefox `dist-firefox/`). Then follow `manual-testing` on a GitHub repository page, a releases page and a single release in a real browser, because there is no automated test script. If one update breaks something you can't fix cleanly, pin that package back to its last working version, finish the rest, and list it in the PR as held back with the reason.
5. Check what the build now asks for: `extension/manifest.json` permissions and hosts must not change because of an update. If webpack or a plugin changes the output, compare the two ZIPs' file lists with the previous release's.
6. Commit and open the PR titled `chore(deps): update <names>`, listing each package or Action with its old and new version, and anything held back.
7. A dependency-only update changes the built extension, so it is worth a patch release. Release only when the user asks, following `release-extension`; the notes say "updated dependencies" and nothing user-visible changes.

Run this skill before every release, and whenever `npm audit` or a security alert names a package here.
