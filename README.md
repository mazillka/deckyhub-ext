# DeckyHub Security for GitHub

[![Support Development & Maintenance](https://img.shields.io/badge/Support_Development_%26_Maintenance-FF5E5B?style=for-the-badge&logo=kofi&logoColor=white)](https://ko-fi.com/mazillka)

A Chrome extension that displays DeckyHub registry audit warnings and release ZIP scan results on GitHub repositories listed in the registry. It shows stable and pre-release reports when available, including ClamAV and YARA findings and VirusTotal and MetaDefender engine counts, the scanned release and file, and a VirusTotal hash lookup link. Audit warnings include a separate pre-release label. Runs-as-root is shown when reported by the registry.

## Install locally

1. Open `chrome://extensions` in Chrome and enable **Developer mode**.
2. Choose **Load unpacked** and select this folder.
3. Visit a listed repository, for example [CSS Loader](https://github.com/DeckThemes/SDH-CssLoader). The panel appears at the top of the repository content. Reload the GitHub page after updating the extension.

## Data and privacy

The extension fetches the public [registry catalog](https://github.com/mazillka/deckyhub-registry), release-index stats, virus-scan summaries, and VirusTotal and MetaDefender reports from `raw.githubusercontent.com`. It caches them in extension-local storage for 30 minutes and uses the last cached copy if a refresh fails. It does not send browsing history to DeckyHub or make a request for each repository. GitHub and the raw data host can receive normal network request information. The VirusTotal link is opened only when clicked; the extension does not upload files or query VirusTotal itself.

Results describe the release ZIP and version named in the panel, not arbitrary source code or other releases. An absent warning does not mean an audit was completed, and a clean scan does not prove a plugin is safe. The extension does not run scans. Data can be delayed, unavailable, or stale; new releases may not yet have reports.


