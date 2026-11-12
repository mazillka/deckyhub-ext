# Chrome Web Store listing: text to paste

Dashboard: https://chrome.google.com/webstore/devconsole (open the Deckyhub item).

## Store listing tab

- **Language:** English
- **Category:** Developer Tools
- **Icon (128×128):** `extension/icons/icon128.png`
- **Screenshot (1280×800 or 640×400, at least one):** load `extension/dist` as an unpacked extension, open <https://github.com/MWGIH/DeckyMultiFrameGen/releases>, and take a screenshot of the browser window. Crop or resize to 1280×800.
- **Homepage URL:** https://github.com/mazillka/deckyhub-ext

**Summary (max 132 characters):**

> See DeckyHub audit warnings and virus-scan results for Decky plugins on their GitHub repository and release pages.

**Detailed description:**

> Deckyhub shows what the DeckyHub registry knows about a Decky Loader plugin right on its GitHub page.
>
> • Repository page: safety badges (runs as root, audit warnings, fork, listed in the Decky store, made with AI, latest virus-scan result) and links to the plugin's DeckyHub page.
> • Releases page and each release: a block per release with its audit warnings and ClamAV, YARA, VirusTotal and MetaDefender scan results, and links that open that exact version on DeckyHub, including "Send to device (experimental)".
> • Every panel can be collapsed, and a setting in the toolbar popup starts them collapsed.
>
> The extension only reads public registry files, keeps them for 30 minutes and sends no browsing data anywhere. A clean scan is not proof that a plugin is safe, and a missing warning does not mean it was audited. Not affiliated with Valve or the Decky Loader project.

## Privacy practices tab

- **Single purpose:** Show DeckyHub registry safety information (audit warnings and virus-scan results) on GitHub repository and release pages for plugins the registry lists.
- **storage justification:** Caches the public registry files for 30 minutes and remembers the "collapse panels by default" setting.
- **Host permission justification (`https://raw.githubusercontent.com/mazillka/deckyhub-registry/*`):** The extension downloads the public registry files (plugin list, audit stats and scan reports) from this one path. No other host is contacted. It also runs on `https://github.com/*` as a content script to draw the panels there.
- **Remote code:** No. All code ships in the package.
- **Data usage:** collects none of the listed data types. Tick none.
- **Certify:** all three statements are true: data is not sold, not used for unrelated purposes, and not used for creditworthiness. Tick all three.
- **Privacy policy URL:** https://github.com/mazillka/deckyhub-ext#privacy

## Then

Submit for review. After the first version is accepted, later releases are uploaded by `.github/workflows/stores.yml`.
