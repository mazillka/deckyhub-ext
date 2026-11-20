import type { Lookup, MetaDefenderReport, ScanRecord, Verdict, VirusTotalReport } from '../types';
import { badge, el, newTabLink } from './dom.ts';

// A release the registry scanned, and whether it is a pre-release.
export interface Found { record: ScanRecord; pre: boolean; channel?: 'stable' | 'prerelease' }

const RAW_REPORTS = 'https://github.com/mazillka/deckyhub-registry/blob/virus-scans/scans.json';
const SHA256 = /^[a-f0-9]{64}$/i;
const VIRUSTOTAL_KEYS = ['malicious', 'suspicious', 'harmless', 'undetected'];
const SCANNER_LABELS: Record<string, string> = { clean: 'No threats found', infected: 'Threat found', incomplete: 'Incomplete', error: 'Scan error' };
const ENGINE_LABELS: Record<string, string> = { pending: 'Scan pending', waiting: 'Scan pending', error: 'Scan error' };

// The release the registry scanned for this tag, and whether it is a pre-release.
export function recordFor(data: Lookup, tag?: string): Found | null {
  const channels = data.scans || {};
  for (const [key, pre] of [['stable', false], ['prerelease', true]] as const) {
    if (tag && channels[key]?.tag === tag) return { record: channels[key] as ScanRecord, pre, channel: key };
  }
  const found = (channels.releases || []).find(item => item.tag === tag);
  return found ? { record: found, pre: !!found.prerelease } : null;
}

const externalOf = (data: Lookup, record: ScanRecord) => data.external?.[String(record.sha256 || '').toLowerCase()];

// The four VirusTotal counts of a finished report, or null when it is not finished, not valid or counts nothing.
function virusTotalCounts(report?: VirusTotalReport | null) {
  const counts = VIRUSTOTAL_KEYS.map(key => report?.stats?.[key] ?? -1);
  const total = counts.reduce((sum, count) => sum + count, 0);
  const valid = report?.state === 'complete' && counts.every(count => Number.isSafeInteger(count) && count >= 0) && total > 0;
  return valid ? { flagged: counts[0] + counts[1], total } : null;
}

function metaDefenderCounts(report?: MetaDefenderReport | null) {
  const { flagged = -1, total = -1 } = report || {};
  const counted = Number.isSafeInteger(flagged) && Number.isSafeInteger(total) && flagged >= 0 && total > 0 && flagged <= total;
  const valid = report?.state === 'complete' && counted;
  return valid ? { flagged, total } : null;
}

// The finished VirusTotal and MetaDefender reports of a record, as [scanner, engines that flagged it, engines].
export function externalCounts(data: Lookup, record: ScanRecord) {
  const ext = externalOf(data, record);
  const out: [string, number, number][] = [];
  const virusTotal = virusTotalCounts(ext?.virusTotal);
  if (virusTotal) out.push(['VirusTotal', virusTotal.flagged, virusTotal.total]);
  const metaDefender = metaDefenderCounts(ext?.metaDefender);
  if (metaDefender) out.push(['MetaDefender', metaDefender.flagged, metaDefender.total]);
  return out;
}

function scanner(parent: Element, name: string, report?: Verdict) {
  const state = report?.result;
  const kind = state === 'clean' ? 'good' : state === 'infected' || !state ? 'danger' : 'unknown';
  const row = el('div', '', 'dh-scan');
  row.append(el('strong', name));
  badge(row, (state && SCANNER_LABELS[state]) || 'Not scanned yet', kind);
  if (report?.scannedAt) row.append(el('span', `Scanned ${report.scannedAt}`, 'dh-muted'));
  parent.append(row);
  if (report?.found) parent.append(el('p', `Findings: ${Array.isArray(report.found) ? report.found.join(', ') : report.found}`, 'dh-detail'));
  if (report?.reason) parent.append(el('p', report.reason, 'dh-detail'));
}

// "Scanned 2026-01-31": a number is seconds since 1970, a string any date text. Nothing is shown for an invalid date.
function scannedOn(row: Element, scannedAt?: string | number) {
  if (!scannedAt) return;
  const date = typeof scannedAt === 'number' ? new Date(scannedAt * 1000) : new Date(scannedAt);
  if (!Number.isNaN(date.getTime())) row.append(el('span', `Scanned ${date.toISOString().slice(0, 10)}`, 'dh-muted'));
}

function enginesFlagged(row: Element, counts: { flagged: number; total: number }) {
  badge(row, `${counts.flagged} of ${counts.total} engines flagged this ZIP`, counts.flagged ? 'danger' : 'good');
}

// The report is missing, pending or not usable. Only a missing report that should be there reads as a problem.
function unusableReport(row: Element, state: string | undefined, available: boolean | undefined, tooLarge: string) {
  const labels: Record<string, string> = { ...ENGINE_LABELS, unsupported: tooLarge };
  const pending = state === 'pending' || state === 'waiting' || !state;
  const label = !available ? 'Report unavailable' : (state && labels[state]) || (state === 'complete' ? 'Invalid report' : 'Not scanned yet');
  badge(row, label, available && pending ? 'danger' : 'unknown');
}

function virusTotal(parent: Element, report: VirusTotalReport | null | undefined, available?: boolean) {
  const row = el('div', '', 'dh-scan');
  row.append(el('strong', 'VirusTotal'));
  const counts = virusTotalCounts(report);
  if (counts) {
    enginesFlagged(row, counts);
    scannedOn(row, report?.scannedAt);
  } else unusableReport(row, report?.state, available, 'ZIP too large for VirusTotal');
  parent.append(row);
}

function metaDefender(parent: Element, report: MetaDefenderReport | null | undefined, available?: boolean) {
  const row = el('div', '', 'dh-scan');
  row.append(el('strong', 'MetaDefender'));
  const counts = metaDefenderCounts(report);
  if (counts && report) {
    enginesFlagged(row, counts);
    scannedOn(row, report.scannedAt);
    if (typeof report.dataId === 'string' && /^[A-Za-z0-9_-]+$/.test(report.dataId)) {
      row.append(newTabLink('View report ↗', `https://metadefender.opswat.com/results/file/${report.dataId}/regular/overview`));
    }
  } else unusableReport(row, report?.state, available, 'ZIP too large for MetaDefender');
  parent.append(row);
}

function channelSection(data: Lookup, { record, pre }: Found) {
  const section = el('div', '', 'dh-channel');
  section.append(el('h3', `${pre ? 'Pre-release' : 'Stable'} · ${record.tag || 'Unknown release'}`, 'dh-release'));
  if (record.file) section.append(el('p', record.file, 'dh-file'));
  scanner(section, 'ClamAV', record.clamav);
  scanner(section, 'YARA', record.yara);
  const ext = externalOf(data, record);
  virusTotal(section, ext?.virusTotal, data.virusTotalAvailable);
  metaDefender(section, ext?.metaDefender, data.metaDefenderAvailable);
  if (SHA256.test(record.sha256 || '')) {
    section.append(newTabLink('Look up SHA-256 on VirusTotal ↗', `https://www.virustotal.com/gui/file/${record.sha256}`));
  }
  return section;
}

// The scan reports of one release.
export function scanBlock(data: Lookup, tag: string) {
  const box = el('div');
  const found = recordFor(data, tag);
  if (!found) {
    box.append(el('p', 'No scan report for this release. The registry scans only the latest stable and pre-release ZIPs.', 'dh-muted'));
    return box;
  }
  const reports = el('div', '', 'dh-reports');
  reports.append(channelSection(data, found));
  box.append(reports);
  const source = el('p', '', 'dh-detail');
  source.append(newTabLink('Registry ClamAV and YARA reports (all ZIPs) ↗', RAW_REPORTS));
  box.append(source);
  return box;
}
