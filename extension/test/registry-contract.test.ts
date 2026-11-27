// The registry's shared warning texts and cases (registry/warnings.json and contract-cases.json), which DeckyHub and
// deckyhub.com are tested against too. DECKYHUB_REGISTRY is a checkout's registry/apps.json (CI sets it).
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { badgeList, warnings as copy } from '../src/content/badges.ts';

const folder = process.env.DECKYHUB_REGISTRY ? dirname(process.env.DECKYHUB_REGISTRY) : '';
const read = (name: string) => JSON.parse(readFileSync(join(folder, name), 'utf8'));
// shortcut: a registry branch without the files is skipped, make this a failure once they're on the registry's main.
const skip = !(folder && existsSync(join(folder, 'warnings.json'))) && 'needs a registry checkout with warnings.json';
const SHA = 'a'.repeat(64);

(globalThis as any).document = new JSDOM('<!doctype html><body></body>').window.document;
const badgesOf = (...args: Parameters<typeof badgeList>) =>
  [...(badgeList(...args)?.querySelectorAll('.dh-badge') || [])].map(node => ({ text: node.textContent, kind: node.className.split('dh-badge dh-')[1] }));

test("the warning texts are the registry's", { skip }, () => {
  const published = Object.entries<{ label: string; hint: string }>(read('warnings.json').warnings);
  assert.deepEqual(copy, Object.fromEntries(published.map(([id, item]) => [id, [item.label, item.hint]])));
});

test("the registry's shared warning cases show the same badges", { skip }, () => {
  const table = read('warnings.json').warnings;
  for (const { name, stats, expect } of read('contract-cases.json').warnings) {
    const shown = badgesOf({ catalogAvailable: true, stats }, { fields: [['warnings', ''], ['prereleaseWarnings', 'Pre-release: ']] });
    assert.deepEqual(shown, expect.map(({ id, prerelease }: { id: string; prerelease: boolean }) => ({
      text: (prerelease ? 'Pre-release: ' : '') + table[id].label,
      kind: table[id].tone === 'danger' ? 'danger' : 'warning'
    })), name);
  }
});

test("the registry's shared scan cases give the same badge", { skip }, () => {
  const labels: Record<string, string> = { clean: 'Nothing flagged', infected: 'Threat found', partial: 'Not fully scanned' };
  const { scans } = read('contract-cases.json');
  assert.ok(scans.length);
  for (const item of scans) {
    const record = { tag: 'v1', sha256: SHA, clamav: { result: item.clamav }, ...(item.yara ? { yara: { result: item.yara } } : {}) };
    const external = { [SHA]: {
      virusTotal: item.virusTotal === null ? null : { state: 'complete', stats: { malicious: item.virusTotal, suspicious: 0, harmless: 0, undetected: 10 } },
      metaDefender: item.metaDefender === null ? null : { state: 'complete', flagged: item.metaDefender, total: 10 }
    } };
    const [badge] = badgesOf({ catalogAvailable: true, external }, { scans: [{ record, pre: false }] });
    // The label starts the badge; a partial one may go on to count the scanners that found nothing.
    assert.equal(badge.text?.split(' · ')[0], labels[item.expect.kind], item.name);
  }
});
