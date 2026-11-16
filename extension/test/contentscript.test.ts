import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';

const SHA = 'b'.repeat(64);
const app = { id: 'my-plugin', name: 'My Plugin', repo: 'o/r' };
const scans = {
  stable: { tag: 'v1.0', file: 'p.zip', sha256: SHA, clamav: { result: 'clean' }, yara: { result: 'infected', found: ['Bad'] } },
  releases: []
};
const external = { [SHA]: { virusTotal: { state: 'complete', stats: { malicious: 1, suspicious: 1, harmless: 5, undetected: 3 } }, metaDefender: { state: 'complete', flagged: 0, total: 20, dataId: 'abc_123' } } };

let dom: JSDOM;
let messages: any[];
let loads = 0;

async function open(path: string, answer: any, { collapsed = false, html = '<main></main>' } = {}) {
  dom = new JSDOM(`<!doctype html><body>${html}</body>`, { url: `https://github.com${path}` });
  messages = [];
  const g = globalThis as any;
  g.document = dom.window.document;
  Object.defineProperty(g, 'location', { get: () => dom.window.location, configurable: true });
  g.MutationObserver = dom.window.MutationObserver;
  g.requestAnimationFrame = (fn: () => void) => setTimeout(fn, 0);
  g.chrome = {
    runtime: {
      getURL: (name: string) => `chrome-extension://id/${name}`,
      sendMessage: async (message: unknown) => (messages.push(message), answer)
    },
    storage: { local: { get: async () => ({ deckyhub_collapse: collapsed }) } }
  };
  await import(`../src/contentscript.ts?run=${loads++}`);
  for (let i = 0; i < 20 && !dom.window.document.querySelector('.dh-panel'); i++) await new Promise(resolve => setTimeout(resolve, 5));
  return dom.window.document;
}

const lookup = (extra: object = {}) => ({ catalogAvailable: true, app, stats: null, scans: null, ...extra });
const text = (root: ParentNode, selector: string) => [...root.querySelectorAll(selector)].map(node => node.textContent);


test('a repo page asks the background for that repo and shows a panel', async () => {
  const document = await open('/o/r', lookup());
  assert.deepEqual(messages, [{ type: 'deckyhub:lookup', repo: 'o/r' }]);
  assert.equal(document.querySelectorAll('.dh-panel').length, 1);
  assert.equal(document.querySelector('.dh-title')?.textContent, 'My Plugin');
});

test('pages that are not a repo, its releases or a release ask for nothing', async () => {
  for (const path of ['/', '/o', '/o/r/issues', '/o/r/pulls/3', '/o/r/releases/tag']) {
    const document = await open(path, lookup());
    assert.deepEqual(messages, [], path);
    assert.equal(document.querySelector('.dh-panel'), null, path);
  }
});

test('nothing is shown for a repo the registry does not list, or when it is unreachable', async () => {
  assert.equal((await open('/o/r', lookup({ app: null }))).querySelector('.dh-panel'), null);
  assert.equal((await open('/o/r', { catalogAvailable: false }))?.querySelector('.dh-panel'), null);
});

test('links to DeckyHub use the plugin id, encoded', async () => {
  const document = await open('/o/r', lookup());
  assert.equal(document.querySelector<HTMLAnchorElement>('.dh-site-link')?.href, 'https://deckyhub.com/plugins/my-plugin.html');
  const link = document.querySelector<HTMLAnchorElement>('.dh-install-link');
  assert.equal(link?.href, 'https://deckyhub.com/develop/plugins/my-plugin.html#remote-install');
  assert.equal(link?.rel, 'noopener noreferrer');
});

test('an id that could break out of a URL gets no links at all', async () => {
  for (const id of ['../x', 'a b', 'A', '-x', 'x?y=1', undefined]) {
    const document = await open('/o/r', lookup({ app: { ...app, id } }));
    assert.equal(document.querySelector('.dh-actions'), null, String(id));
  }
});

test('registry text is shown as text, never as markup', async () => {
  const name = '<img src=x onerror="window.pwned=1">';
  const document = await open('/o/r', lookup({ app: { ...app, name }, stats: { fork: '<b>o/x</b>' } }));
  assert.equal(document.querySelector('.dh-title')?.textContent, name);
  assert.equal(document.querySelector('.dh-panel img[src="x"]'), null);
  assert.equal(document.querySelector('.dh-panel b'), null);
});

test('the Collapse button collapses and expands the panel, and the saved setting starts it collapsed', async () => {
  let document = await open('/o/r', lookup());
  const panel = document.querySelector('.dh-panel')!;
  const button = document.querySelector<HTMLButtonElement>('.dh-toggle')!;
  assert.equal(button.textContent, 'Collapse');
  button.click();
  assert.ok(panel.classList.contains('dh-collapsed'));
  assert.equal(button.textContent, 'Expand');
  assert.equal(button.getAttribute('aria-expanded'), 'false');
  button.click();
  assert.ok(!panel.classList.contains('dh-collapsed'));
  document = await open('/o/r', lookup(), { collapsed: true });
  assert.ok(document.querySelector('.dh-panel')?.classList.contains('dh-collapsed'));
});

test('the repo page shows repo-level badges and known audit warnings, pre-release ones marked', async () => {
  const stats = { root: true, fork: 'up/stream', store: { downloads: 1 }, ai: ['CLAUDE.md'], warnings: ['obfuscated', 'blocked'], prereleaseWarnings: ['obfuscated', 'vulnerable', 'brand-new'] };
  const document = await open('/o/r', lookup({ stats }));
  const badges = text(document, '.dh-warning-list .dh-badge');
  assert.deepEqual(badges, ['Runs as root', 'Fork', 'In Decky store', 'AI', 'Hidden code', 'Blocked by audit', 'Pre-release: Known vulnerabilities', 'Pre-release: brand-new']);
  assert.ok(document.querySelector('.dh-badge.dh-danger')?.textContent === 'Blocked by audit');
  assert.ok(document.querySelector('a[href="https://decky-extended-plugins.beallio.com/audit"]'));
});

test('a missing report is never described as clean', async () => {
  const document = await open('/o/r', lookup());
  assert.equal(document.querySelector('.dh-warning-list'), null);
  assert.match(document.querySelector('.dh-panel')!.textContent!, /Audit warnings indicate potential concerns and are not proof of harm/);
});

test('unavailable data and a stale cache are stated', async () => {
  const document = await open('/o/r', lookup({ scans, unavailable: ['audit data'], stale: true }));
  assert.deepEqual(text(document, '.dh-notice'), ['Unavailable: audit data.', 'Showing cached data because the registry could not be reached.']);
});

test('a source mismatch is a very-high-risk badge naming the files, unless the audit already warned', async () => {
  const mismatch = { ...scans, stable: { ...scans.stable, audit: { source: { findings: [{ rule: 'source_file_differs', path: 'main.py' }, { rule: 'other', path: 'x' }] } } } };
  let document = await open('/o/r', lookup({ scans: mismatch, stats: {} }));
  const risk = [...document.querySelectorAll('.dh-warning-list li')].find(li => li.textContent!.includes('Very high risk'));
  assert.ok(risk?.querySelector('.dh-danger'));
  assert.match(risk!.textContent!, /Very high risk: Download includes code that is not in GitHub/);
  assert.match(risk!.textContent!, /source_file_differs: main\.py/);
  assert.doesNotMatch(risk!.textContent!, /other: x/);
  document = await open('/o/r', lookup({ scans: mismatch, stats: { warnings: ['not-in-source'] } }));
  assert.equal(text(document, '.dh-warning-list .dh-badge').filter(badge => badge!.includes('Very high risk')).length, 1);
});

test('a release page shows that release\'s scans and the lookup link, only for a real hash', async () => {
  const document = await open('/o/r/releases/tag/v1.0', lookup({ scans, external, virusTotalAvailable: true, metaDefenderAvailable: true }), { html: '<main><div class="Box-body"></div></main>' });
  const block = document.querySelector('.Box-body .dh-panel')!;
  assert.ok(block);
  assert.deepEqual(text(block, '.dh-release'), ['Stable · v1.0']);
  assert.ok(text(block, '.dh-scan .dh-badge').includes('No threats found'));
  assert.ok(text(block, '.dh-scan .dh-badge').includes('Threat found'));
  assert.ok(text(block, '.dh-scan .dh-badge').includes('2 of 10 engines flagged this ZIP'));
  assert.ok(text(block, '.dh-scan .dh-badge').includes('0 of 20 engines flagged this ZIP'));
  assert.equal(block.querySelector<HTMLAnchorElement>('a[href^="https://www.virustotal.com/"]')?.href, `https://www.virustotal.com/gui/file/${SHA}`);
  assert.equal(block.querySelector<HTMLAnchorElement>('a[href*="metadefender"]')?.href, 'https://metadefender.opswat.com/results/file/abc_123/regular/overview');
  assert.match(block.querySelector<HTMLAnchorElement>('.dh-site-link')!.href, /#v-v1\.0$/);
  const bad = { ...scans, stable: { ...scans.stable, sha256: 'zz' } };
  const other = await open('/o/r/releases/tag/v1.0', lookup({ scans: bad }), { html: '<main><div class="Box-body"></div></main>' });
  assert.equal(other.querySelector('a[href*="virustotal"]'), null);
});

test('an unsafe MetaDefender id gets no link', async () => {
  const hostile = { [SHA]: { metaDefender: { state: 'complete', flagged: 0, total: 5, dataId: '../../evil?x=1' } } };
  const document = await open('/o/r/releases/tag/v1.0', lookup({ scans, external: hostile, metaDefenderAvailable: true }), { html: '<main><div class="Box-body"></div></main>' });
  assert.equal(document.querySelector('a[href*="metadefender"]'), null);
});

test('a release with no scan report says so', async () => {
  const document = await open('/o/r/releases/tag/v9', lookup({ scans }), { html: '<main><div class="Box-body"></div></main>' });
  assert.match(document.querySelector('.dh-panel')!.textContent!, /No scan report for this release/);
});

test('a pre-release scan is labelled and takes the pre-release warnings', async () => {
  const pre = { prerelease: { tag: 'v2-rc', sha256: SHA, clamav: { result: 'clean' } } };
  const document = await open('/o/r/releases/tag/v2-rc', lookup({ scans: pre, stats: { warnings: ['blocked'], prereleaseWarnings: ['vulnerable'] } }), { html: '<main><div class="Box-body"></div></main>' });
  assert.deepEqual(text(document, '.dh-release'), ['Pre-release · v2-rc']);
  const badges = text(document, '.dh-warning-list .dh-badge');
  assert.ok(badges.includes('Known vulnerabilities'));
  assert.ok(!badges.includes('Blocked by audit'));
});

test('the releases list gets one block per release card, once each', async () => {
  const html = `<main>${['v1.0', 'v0.9'].map(tag => `<div class="Box-body"><a href="/o/r/releases/tag/${tag}">${tag}</a><a href="/o/r/releases/tag/${tag}">again</a></div>`).join('')}</main>`;
  const document = await open('/o/r/releases', lookup({ scans }), { html });
  assert.equal(document.querySelectorAll('.Box-body .dh-panel').length, 2);
});

test('VirusTotal and MetaDefender reports that do not add up are not trusted', async () => {
  const odd = { [SHA]: { virusTotal: { state: 'complete', stats: { malicious: -1, suspicious: 0, harmless: 1, undetected: 1 } }, metaDefender: { state: 'complete', flagged: 9, total: 3 } } };
  const document = await open('/o/r/releases/tag/v1.0', lookup({ scans, external: odd, virusTotalAvailable: true, metaDefenderAvailable: true }), { html: '<main><div class="Box-body"></div></main>' });
  const badges = text(document, '.dh-scan .dh-badge');
  assert.equal(badges.filter(badge => badge === 'Invalid report').length, 2);
  assert.ok(!badges.some(badge => badge!.includes('engines flagged')));
});

test('store-only plugins direct users to the Decky Store and hide old GitHub reports and install links', async () => {
  const old = lookup({ app: { ...app, store: true }, stats: { root: true, warnings: ['not-in-source'] }, scans, external, virusTotalAvailable: true, metaDefenderAvailable: true });
  const paths = [
    ['/o/r', '<main></main>'],
    ['/o/r/releases/tag/v1.0', '<main><div class="Box-body"></div></main>'],
    ['/o/r/releases', '<main><div class="Box-body"><a href="/o/r/releases/tag/v1.0">v1.0</a></div></main>'],
  ];
  for (const [path, html] of paths) {
    const document = await open(path, old, { html });
    const panel = document.querySelector('.dh-panel');
    assert.ok(panel, path);
    assert.match(panel.textContent!, /available through the Decky Store/);
    assert.match(panel.textContent!, /does not scan the store version/);
    assert.equal(panel.querySelector('.dh-warning-list'), null, path);
    assert.equal(panel.querySelector('.dh-scan'), null, path);
    assert.equal(panel.querySelector('.dh-install-link'), null, path);
  }
});

test('a repo with no scan record says it is not scanned yet, and one with a scan does not', async () => {
  let document = await open('/o/r', lookup());
  assert.match(text(document, '.dh-notice').join(' '), /Not scanned yet/);
  document = await open('/o/r', lookup({ scans }));
  assert.doesNotMatch(text(document, '.dh-notice').join(' '), /Not scanned yet/);
  // Scan data that failed to load is "unavailable", not "not scanned".
  document = await open('/o/r', lookup({ unavailable: ['scan data'] }));
  assert.doesNotMatch(text(document, '.dh-notice').join(' '), /Not scanned yet/);
});

test('a pre-release page explains what a pre-release is, a stable release does not', async () => {
  const pre = { prerelease: { tag: 'v2-rc', sha256: SHA, clamav: { result: 'clean' } } };
  let document = await open('/o/r/releases/tag/v2-rc', lookup({ scans: pre }), { html: '<main><div class="Box-body"></div></main>' });
  assert.match(document.querySelector('.dh-warning-list')!.textContent!, /pre-release, so it may be unfinished or buggy/);
  document = await open('/o/r/releases/tag/v1.0', lookup({ scans }), { html: '<main><div class="Box-body"></div></main>' });
  assert.doesNotMatch(document.querySelector('.dh-panel')!.textContent!, /unfinished or buggy/);
});
