import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';

type Listener = (message: unknown, sender: unknown, send: (response: any) => void) => boolean | undefined;

const SHA = 'a'.repeat(64);
const files: Record<string, unknown> = {
  'main/registry/apps.json': {
    apps: [
      { id: 'one', name: 'One', repo: 'Owner/One' },
      { id: 'two', name: 'Two', repo: 'owner/Two' },
      { id: 'other', name: 'Other', repo: 'someone/Other' }
    ]
  },
  'release-index/stats.json': { plugins: { 'owner/one': { root: true, warnings: ['obfuscated'] } } },
  'virus-scans/plugins.json': {
    plugins: { 'owner/one': { stable: { tag: 'v1', sha256: SHA.toUpperCase() }, releases: [{ tag: 'v0', sha256: 'abc123' }] } }
  },
  'virustotal-reports/reports.json': { reports: { [SHA]: { state: 'complete' } } },
  'metadefender-reports/reports.json': { reports: {} }
};

let listener: Listener;
let store: Record<string, unknown>;
let requested: string[];
let failing: Set<string>;
let now = 1_000_000;
let imports = 0;

beforeEach(async () => {
  store = {};
  requested = [];
  failing = new Set();
  now = 1_000_000;
  Date.now = () => now;
  (globalThis as any).chrome = {
    storage: {
      local: {
        get: async (key: string) => (key in store ? { [key]: store[key] } : {}),
        set: async (items: Record<string, unknown>) => void Object.assign(store, items)
      }
    },
    runtime: { onMessage: { addListener: (fn: Listener) => (listener = fn) } }
  };
  (globalThis as any).fetch = async (url: string) => {
    const path = url.replace('https://raw.githubusercontent.com/mazillka/deckyhub-registry/', '');
    requested.push(path);
    if (failing.has(path)) return { ok: false, status: 503, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => structuredClone(files[path]) };
  };
  // A fresh copy of the module each time: it keeps its cache in module state.
  await import(`../src/background.ts?run=${imports++}`);
});

const lookup = (repo: string) =>
  new Promise<any>(resolve => {
    const handled = listener({ type: 'deckyhub:lookup', repo }, {}, resolve);
    if (handled !== true) resolve(undefined);
  });

test('ignores messages that are not a lookup of a well-formed owner/name', async () => {
  for (const message of [{ type: 'other', repo: 'a/b' }, { type: 'deckyhub:lookup' }, { type: 'deckyhub:lookup', repo: 'a/b/c' }, { type: 'deckyhub:lookup', repo: 'a b/c' }, null]) {
    assert.equal(listener(message, {}, () => assert.fail('must not answer')), undefined);
  }
  assert.deepEqual(requested, []);
});

test('answers with the plugin, its stats and scans, whatever the case of the repo', async () => {
  const answer = await lookup('OWNER/one');
  assert.equal(answer.app.id, 'one');
  assert.equal(answer.catalogAvailable, true);
  assert.deepEqual(answer.stats, { root: true, warnings: ['obfuscated'] });
  assert.equal(answer.scans.stable.tag, 'v1');
  assert.deepEqual(answer.unavailable, []);
  assert.equal(answer.stale, false);
});

test('lists the other registry plugins by the same owner, never the plugin itself or another owner', async () => {
  const answer = await lookup('OWNER/one');
  assert.deepEqual(answer.more, [{ id: 'two', name: 'Two' }]);
  assert.deepEqual((await lookup('someone/Other')).more, []);
  assert.deepEqual((await lookup('nobody/nothing')).more, []);
});

test('attaches external reports only for valid SHA-256 hashes, by lowercase hash', async () => {
  const answer = await lookup('owner/one');
  assert.deepEqual(Object.keys(answer.external), [SHA]);
  assert.deepEqual(answer.external[SHA], { virusTotal: { state: 'complete' }, metaDefender: null });
  assert.equal(answer.virusTotalAvailable, true);
});

test('a repo the registry does not list gets no app, stats or scans', async () => {
  const answer = await lookup('nobody/nothing');
  assert.equal(answer.app, null);
  assert.equal(answer.stats, null);
  assert.equal(answer.scans, null);
  assert.deepEqual(answer.external, {});
  assert.equal(answer.catalogAvailable, true);
});

test('fetches each registry file once within the cache time, and again after it', async () => {
  await lookup('owner/one');
  assert.equal(requested.length, 5);
  await lookup('owner/one');
  assert.equal(requested.length, 5);
  now += 31 * 60 * 1000;
  await lookup('owner/one');
  assert.equal(requested.length, 10);
});

test('requests are never cached by the browser and only go to the registry', async () => {
  await lookup('owner/one');
  assert.deepEqual(requested.sort(), Object.keys(files).sort());
});

test('with the registry down and nothing cached, it says what is unavailable', async () => {
  for (const path of Object.keys(files)) failing.add(path);
  const answer = await lookup('owner/one');
  assert.equal(answer.catalogAvailable, false);
  assert.equal(answer.app, null);
  assert.deepEqual(answer.unavailable, ['audit data', 'scan data']);
  assert.equal(answer.stale, false);
});

test('with the registry down it falls back to the cached copy and says it is stale', async () => {
  await lookup('owner/one');
  now += 31 * 60 * 1000;
  for (const path of Object.keys(files)) failing.add(path);
  const answer = await lookup('owner/one');
  assert.equal(answer.app.id, 'one');
  assert.equal(answer.stale, true);
});

test('data of the wrong shape is refused, not cached', async () => {
  files['main/registry/apps.json'] = { apps: 'nope' };
  try {
    const answer = await lookup('owner/one');
    assert.equal(answer.catalogAvailable, false);
    assert.equal(store.deckyhub_catalog, undefined);
  } finally {
    files['main/registry/apps.json'] = { apps: [{ id: 'one', name: 'One', repo: 'Owner/One' }] };
  }
});
