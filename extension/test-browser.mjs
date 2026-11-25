// Exercise the packaged MV3 extension against deterministic GitHub and registry fixtures.
import { chromium } from 'playwright';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';

const profile = await mkdtemp(path.join(tmpdir(), 'deckyhub-extension-'));
const extension = path.resolve('dist');
let context;
try {
  context = await chromium.launchPersistentContext(profile, {
    channel: 'chromium',
    headless: true,
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`]
  });
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  await worker.evaluate(async () => {
    const files = {
      catalog: { apps: [{ id: 'one', name: 'Example', repo: 'owner/one' }] },
      stats: { plugins: { 'owner/one': { root: true } } },
      scans: { plugins: {} }, virustotal: { reports: {} }, metadefender: { reports: {} }
    };
    const items = Object.fromEntries(Object.entries(files).map(([key, data]) => [`deckyhub_${key}`, { time: Date.now(), data }]));
    await chrome.storage.local.set(items);
  });
  const page = await context.newPage();
  await page.route('https://github.com/**', route => route.fulfill({ contentType: 'text/html', body: '<html><body><main><div class="Box-body"></div></main></body></html>' }));
  await page.goto('https://github.com/owner/one');
  await page.locator('.dh-panel').waitFor();
  assert.match(await page.locator('.dh-panel').innerText(), /Example/);
  assert.match(await page.locator('.dh-panel').innerText(), /Runs as root/);
  await page.goto('https://github.com/owner/one/releases/tag/v1');
  await page.locator('.dh-panel').waitFor();
  assert.match(await page.locator('.dh-panel').innerText(), /No scan report/i);
  await page.goto('https://github.com/other/unknown');
  assert.equal(await page.locator('.dh-panel').count(), 0);
  console.log('Packaged extension: repo, release, and unlisted page passed');
} finally {
  await context?.close();
  await rm(profile, { recursive: true, force: true });
}
