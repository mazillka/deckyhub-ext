import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const manifest = read('../manifest.json');

test('the manifest and package.json carry the same version', () => {
  assert.equal(manifest.version, read('../package.json').version);
});

test('permissions stay as narrow as the features need', () => {
  assert.deepEqual(manifest.permissions, ['storage']);
  assert.deepEqual(manifest.host_permissions, ['https://raw.githubusercontent.com/mazillka/deckyhub-registry/*']);
  assert.deepEqual(manifest.content_scripts.map((script: any) => script.matches), [['https://github.com/*']]);
});

test('every file the manifest names is built from a source file', () => {
  const sources = new Set(['background.js', 'contentscript.js', 'content.css', 'popup.html']);
  const named = [manifest.background.service_worker, ...manifest.content_scripts.flatMap((script: any) => [...script.js, ...script.css]), manifest.action.default_popup];
  for (const file of named) assert.ok(sources.has(file), `${file} has no source`);
  for (const icon of [...Object.values(manifest.icons), ...Object.values(manifest.action.default_icon)] as string[]) {
    assert.ok(readFileSync(new URL(`../${icon}`, import.meta.url)).length > 0, icon);
  }
});
