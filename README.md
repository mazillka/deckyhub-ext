# DeckyHub Security for GitHub

[![Support Development & Maintenance](https://img.shields.io/badge/Support_Development_%26_Maintenance-FF5E5B?style=for-the-badge&logo=kofi&logoColor=white)](https://ko-fi.com/mazillka)

A browser extension for Chrome, Edge, Opera, Brave, Vivaldi and Firefox that displays DeckyHub registry audit warnings and release ZIP scan results on GitHub repositories listed in the registry. It shows stable and pre-release reports when available, including ClamAV and YARA findings and VirusTotal and MetaDefender engine counts, the scanned release and file, and a VirusTotal hash lookup link. Audit warnings include a separate pre-release label. Runs-as-root is shown when reported by the registry.

## Install locally

1. Run `npm ci` and `npm run build-prod` in the `extension` directory (Node.js and npm are required).
2. Open `chrome://extensions` in Chrome and enable **Developer mode**.
3. Choose **Load unpacked** and select the `extension/dist` folder.
   In Edge, Opera, Brave or Vivaldi, open that browser's extensions page instead; the folder is the same.
4. Visit a listed repository, for example [CSS Loader](https://github.com/DeckThemes/SDH-CssLoader). The panel appears at the top of the repository content. Reload the GitHub page after updating the extension.

### Firefox

1. Run `npm ci` and `npm run build-firefox` in the `extension` directory.
2. Open `about:debugging#/runtime/this-firefox` and choose **Load Temporary Add-on**.
3. Select `extension/dist-firefox/manifest.json`. Firefox 127 or newer is needed, and it removes a temporary add-on when it closes.

### Ready-made packages

Each [release](https://github.com/mazillka/deckyhub-ext/releases) has both packages built for you: `deckyhub-security-chromium-vX.Y.Z.zip` for Chrome, Edge, Opera, Brave and Vivaldi, and `deckyhub-security-firefox-vX.Y.Z.zip` for Firefox. Unzip the Chromium one and load the folder as above; in Firefox, pick the ZIP itself under **Load Temporary Add-on**.

## Data and privacy

The extension fetches the public [registry catalog](https://github.com/mazillka/deckyhub-registry), release-index stats, virus-scan summaries, and VirusTotal and MetaDefender reports from `raw.githubusercontent.com`. It caches them in extension-local storage for 30 minutes and uses the last cached copy if a refresh fails. It does not send browsing history to DeckyHub or make a request for each repository. GitHub and the raw data host can receive normal network request information. The VirusTotal link is opened only when clicked; the extension does not upload files or query VirusTotal itself.

Results describe the release ZIP and version named in the panel, not arbitrary source code or other releases. An absent warning does not mean an audit was completed, and a clean scan does not prove a plugin is safe. The extension does not run scans. Data can be delayed, unavailable, or stale; new releases may not yet have reports.



