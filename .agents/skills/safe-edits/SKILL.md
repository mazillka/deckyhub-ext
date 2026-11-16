---
name: safe-edits
description: Avoid the editing and Git mistakes that have bitten this project - CRLF line endings breaking scripted edits, work on the wrong branch, a version bump missing a file, pushes to a made-up or third-party remote, and releasing without the user's OK. Use before bulk-editing files with a script, committing, pushing, bumping a version or tagging.
---

# Safe edits

- **Line endings.** On Windows files are often CRLF while a search string in a script is LF, so `str.replace` finds nothing. Read the file, note whether it had `\r\n`, edit the LF text, write it back the same way.
- **Branch.** Check `git branch --show-current` before editing; start each topic with `git switch -c <topic> origin/main` (this repo has no `develop`). Don't pile a new change on a branch whose PR already merged.
- **Version bumps** touch `extension/manifest.json`, `extension/package.json` and `extension/package-lock.json` (its first two `version` fields); `release.yml` refuses a tag that doesn't match. A pre-release keeps the number and gets the dash in the tag only (`release-extension`).
- **Remotes.** Never push to a URL typed from memory. Merging a PR, tagging and editing a release each need the user's OK for that action.
- **Stores.** `stores.yml` runs after a release; check it too, and say when it fails (it failed once on a pre-release tag).
