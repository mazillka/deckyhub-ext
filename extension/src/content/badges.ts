import type { Lookup, ScanRecord, Stats, Verdict } from '../types';
import { el, newTabLink } from './dom.ts';
import { externalCounts, type Found } from './scans.ts';

// The same safety badges deckyhub.com shows.

// A copy of the registry's registry/warnings.json (test/registry-contract.test.ts compares them): change texts there first.
export const warnings: Record<string, [string, string]> = {
  blocked: ['Blocked by audit', 'The audit blocked this release, for example for suspected malware or a broken archive.'],
  'private-data': ['Reads private data', 'The audit found code that may access Steam login data, SSH keys or secrets from the environment.'],
  persistence: ['Changes system startup', 'The audit found code that may change shell profiles, preloaded libraries, kernel modules or device rules. Such changes can keep working outside Decky.'],
  'not-in-source': ['Very high risk: Download includes code that is not in GitHub', 'The downloaded release contains code the audit could not match to the published source. This could hide malicious changes. Review the release before installing; a mismatch does not prove malware.'],
  obfuscated: ['Hidden code', "The audit found encoded or packed code that's hard to read."],
  'no-tls-check': ['Skips HTTPS checks', 'The audit found code that turns off certificate checks, so what it downloads could be tampered with.'],
  'runs-downloads': ['Runs downloaded scripts', 'The audit found code that downloads a script and runs it straight away.'],
  vulnerable: ['Known vulnerabilities', 'The audit found bundled libraries with published security flaws.']
};
const SCAN_RESULT_WORDS: Record<string, string> = { clean: 'no threats found', infected: 'threat found', incomplete: 'only partly scanned', error: "couldn't be scanned" };
const SCAN_BADGES = { clean: ['Nothing flagged', 'good'], infected: ['Threat found', 'danger'], partial: ['Not fully scanned', 'warning'] } as const;
const SOURCE_RULES = ['source_path_missing', 'source_file_differs'];
const STORE_NOTE = 'The Decky store lists a plugin with this name. The store names no repository, so check that it is this one.';

type AuditField = 'warnings' | 'prereleaseWarnings';
type AddBadge = (text: string, kind: string, ...description: (string | Node)[]) => void;
export type BadgeFields = [AuditField, string][];

// Which audit warnings belong to a release: the ones kept for the channel its scan names.
export function fieldsFor(channel?: Found['channel']): BadgeFields {
  if (channel === 'stable') return [['warnings', '']];
  return channel === 'prerelease' ? [['prereleaseWarnings', '']] : [];
}

const includes = (codes: string[] | undefined, code: string) => Array.isArray(codes) && codes.includes(code);

// What marked a plugin as AI-assisted, with each "(address)" on GitHub as a short link. Anything else stays text.
const aiEvidence = (entries: string[]) => entries.join(', ')
  .split(/\((https:\/\/github\.com\/[^\s()]+)\)/)
  .flatMap((part, i) => (i % 2 ? ['(', newTabLink(part.includes('/commit/') ? 'commit' : 'link', part), ')'] : [part]));

function rootBadge(add: AddBadge, stats: Stats) {
  if (stats.root === true) add('Runs as root', 'warning', 'The plugin backend runs with root privileges and can read or change system files and user data. Some plugins need this access.');
}

// The New project badge, as the app and the site decide it: a repository under 30 days old.
const isNewProject = (created: unknown) => typeof created === 'string' && Date.now() - Date.parse(created) < 30 * 24 * 60 * 60 * 1000;

// Background facts about the repository: new project, fork, Decky store, Rust, AI. Release pages show none.
function backgroundBadges(add: AddBadge, stats: Stats) {
  if (isNewProject(stats.created)) add('New project', 'unknown', "This plugin's GitHub repository was created less than 30 days ago. That says nothing about its quality or safety.");
  if (typeof stats.fork === 'string') add('Fork', 'unknown', `A fork of ${stats.fork}: its code started as a copy of that project.`);
  if (stats.store) add('In Decky store', 'unknown', STORE_NOTE);
  if (stats.rust === true) add('Rust', 'unknown', 'Its repository has Rust code, so part of the plugin is written in Rust. That says nothing about its quality or safety.');
  if (Array.isArray(stats.ai) && stats.ai.length) {
    add('AI', 'unknown', 'Its repository has instructions for AI coding assistants, or says it is made with AI (', ...aiEvidence(stats.ai), '). That says nothing about its quality or safety.');
  }
}

function auditBadges(add: AddBadge, stats: Stats, fields: BadgeFields) {
  for (const [field, prefix] of fields) {
    const codes = stats[field];
    if (!Array.isArray(codes)) continue;
    for (const code of codes) {
      if (field === 'prereleaseWarnings' && includes(stats.warnings, code)) continue;
      const [title, description] = warnings[code] || [String(code), 'The registry reported this audit finding; see the registry for details.'];
      add(prefix + title, code === 'blocked' || code === 'not-in-source' ? 'danger' : 'warning', description);
    }
  }
}

// The audit found code in the release ZIP that is not in the GitHub source, and the registry's warnings do not already say so.
function notInSourceBadge(add: AddBadge, data: Lookup, record: ScanRecord, stats: Stats) {
  const findings = Array.isArray(record.audit?.source?.findings) ? record.audit.source.findings : [];
  const sourceFindings = findings.filter(f => f && SOURCE_RULES.includes(f.rule || '') && typeof f.path === 'string');
  const hashValid = typeof record.sha256 === 'string' && /^[a-f0-9]{64}$/i.test(record.sha256);
  const covered = (record === data.scans?.stable && includes(stats.warnings, 'not-in-source'))
    || (record === data.scans?.prerelease && includes(stats.prereleaseWarnings, 'not-in-source'));
  if (!hashValid || !sourceFindings.length || covered) return;
  const sources = Array.from(new Set(sourceFindings.map(f => `${f.rule}: ${f.path}`))).join('; ');
  add('Very high risk: Download includes code that is not in GitHub', 'danger', `The audit could not match code in release ZIP ${record.file || 'the ZIP'} (${record.tag}): ${sources}. This could hide malicious changes. Review the release before installing; a mismatch does not prove malware.`);
}

// Nothing flagged only once all four scanners (ClamAV, YARA, VirusTotal, MetaDefender) have reported and none flagged it; two clean reports out of four say less than that.
function scanVerdict(results: string[]): keyof typeof SCAN_BADGES {
  if (results.includes('infected')) return 'infected';
  return results.length >= 4 && results.every(result => result === 'clean') ? 'clean' : 'partial';
}

const foundNote = (verdict: Verdict) => (Array.isArray(verdict.found) && verdict.found.length ? ` (${verdict.found.join(', ')})` : '');

function scanBadge(add: AddBadge, data: Lookup, { record, pre }: Found) {
  if (!record.clamav) return;
  const counts = externalCounts(data, record);
  const results = [record.clamav.result, record.yara?.result].filter((value): value is string => !!value)
    .concat(counts.map(([, flagged]) => (flagged ? 'infected' : 'clean')));
  const verdict = scanVerdict(results);
  const [name, kind] = SCAN_BADGES[verdict];
  // The count the app shows: how many of the four scanners have reported finding nothing.
  const passed = results.filter(result => result === 'clean').length;
  const label = verdict === 'partial' ? `${name} · ${passed}/4` : name;
  const verdicts = ([['ClamAV', record.clamav], ['YARA', record.yara]] as [string, Verdict | undefined][])
    .filter((pair): pair is [string, Verdict] => !!pair[1]);
  const detail = verdicts
    .map(([name, verdict]) => `${name}: ${(verdict.result && SCAN_RESULT_WORDS[verdict.result]) || verdict.result}${foundNote(verdict)}`)
    .concat(counts.map(([name, flagged, total]) => `${name}: ${flagged} of ${total} engines flagged it`)).join('; ');
  const reported = verdict === 'partial' ? `. ${passed} of 4 scanners have reported finding nothing` : '';
  const caveat = kind === 'danger' ? '' : " A clean scan isn't proof of safety.";
  add((pre ? 'Pre-release: ' : '') + label, kind, `Virus scan of ${record.file || 'the ZIP'} (${record.tag}): ${detail}${reported}.${caveat}`);
}

// all: repo-level facts too (fork, store, AI); fields: which audit warnings; scans: the releases to describe.
export function badgeList(data: Lookup, { all = false, fields = [], scans = [] }: { all?: boolean; fields?: BadgeFields; scans?: Found[] }) {
  const items = el('ul', '', 'dh-warning-list');
  const add: AddBadge = (text, kind, ...description) => {
    const item = el('li');
    item.append(el('span', text, `dh-badge dh-${kind}`), ' ', ...description);
    items.append(item);
  };
  const stats: Stats = data.stats || {};
  // Store-only entries (registry `store: true`) carry no other badge: nothing here is installed from GitHub.
  if (data.app?.store === true) {
    if (all && stats.store) add('In Decky store', 'unknown', STORE_NOTE);
    return items.childNodes.length ? items : null;
  }
  // Listed as deckyhub.com lists them: scan results, audit warnings, root, then the background facts.
  for (const found of scans) scanBadge(add, data, found);
  auditBadges(add, stats, fields);
  for (const found of scans) notInSourceBadge(add, data, found.record, stats);
  rootBadge(add, stats);
  // What a pre-release is, for the release it describes: the repo page lists the latest of both channels.
  if (!all && scans.some(({ pre }) => pre)) add('Pre-release', 'warning', 'This is a pre-release, so it may be unfinished or buggy. DeckyHub installs it only if you choose its Pre-release channel.');
  if (all) backgroundBadges(add, stats);
  return items.childNodes.length ? items : null;
}
