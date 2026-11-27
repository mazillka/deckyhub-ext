const BASE = 'https://raw.githubusercontent.com/mazillka/deckyhub-registry/';
import type { External, Lookup, Scans, ScanRecord, Stats, App } from './types';

const SOURCES = {
  catalog: 'main/registry/apps.json',
  stats: 'release-index/stats.json',
  scans: 'virus-scans/plugins-lite.json',
  virustotal: 'virustotal-reports/reports.json',
  metadefender: 'metadefender-reports/reports.json'
};
// Read when the file above isn't there: a registry that doesn't publish the smaller scan file yet, or was rolled back.
const FALLBACKS: Partial<Record<keyof typeof SOURCES, string>> = { scans: 'virus-scans/plugins.json' };
const TTL = 30 * 60 * 1000;
const FETCH_TIMEOUT = 15_000;
const record = (value: unknown): value is Record<string, any> => !!value && typeof value === 'object' && !Array.isArray(value);
const scanRecord = (value: unknown): value is ScanRecord => record(value) && typeof value.tag === 'string';
type SourceName = keyof typeof SOURCES;
interface Source { data: any; stale: boolean; error?: string }

const pending = new Map<SourceName, Promise<Source>>();
// Parsed copies kept while this service worker lives: chrome.storage.local.get() would otherwise
// deserialize all five files (about 4.7 MB of JSON, and growing with the registry) again on every lookup.
const memory = new Map<SourceName, { time: number; data: any }>();

async function load(name: SourceName): Promise<Source> {
  const key = `deckyhub_${name}`;
  let cached = memory.get(name);
  if (!cached) {
    cached = await chrome.storage.local.get(key).then((items) => items[key] as { time: number; data: any } | undefined).catch(() => undefined);
    if (cached) memory.set(name, cached);
  }
  if (cached && Date.now() - cached.time < TTL) return { data: cached.data, stale: false };
  if (!pending.has(name)) {
    pending.set(name, (async () => {
      try {
        const get = (path: string) => fetch(BASE + path, { cache: 'no-cache', signal: AbortSignal.timeout(FETCH_TIMEOUT) });
        let response = await get(SOURCES[name]);
        const fallback = FALLBACKS[name];
        if (response.status === 404 && fallback) response = await get(fallback);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (!record(data) || (name === 'catalog' ? !Array.isArray(data.apps) : (name === 'virustotal' || name === 'metadefender') ? !record(data.reports) : !record(data.plugins))) throw new Error('Invalid registry data');
        const entry = { time: Date.now(), data };
        memory.set(name, entry);
        // A full storage (Chrome allows 10 MB, older versions 5 MB) must not throw away what was just downloaded.
        await chrome.storage.local.set({ [key]: entry }).catch(() => {});
        return { data, stale: false };
      } catch (error) {
        return { data: cached?.data || null, stale: !!cached, error: String(error) };
      } finally { pending.delete(name); }
    })());
  }
  return pending.get(name) as Promise<Source>;
}

chrome.runtime.onMessage.addListener((message: { type?: string; repo?: string }, _sender, sendResponse: (response: Lookup) => void) => {
  if (message?.type !== 'deckyhub:lookup' || !/^[\w.-]+\/[\w.-]+$/.test(message.repo || '')) return;
  Promise.all((Object.keys(SOURCES) as SourceName[]).map(load)).then(([catalog, stats, scans, virustotal, metadefender]) => {
    const repo = (message.repo as string).toLowerCase();
    const rawScan = scans.data?.plugins?.[repo];
    const scanInvalid = rawScan != null && (!record(rawScan) || (rawScan.stable != null && !scanRecord(rawScan.stable)) || (rawScan.prerelease != null && !scanRecord(rawScan.prerelease)) || (rawScan.releases != null && (!Array.isArray(rawScan.releases) || !rawScan.releases.every(scanRecord))));
    const plugin: Scans | undefined = scanInvalid || !record(rawScan) ? undefined : rawScan as Scans;
    const owner = repo.split('/')[0];
    const apps: App[] = Array.isArray(catalog.data?.apps) ? catalog.data.apps.filter((app: unknown) => record(app) && typeof app.repo === 'string' && typeof app.name === 'string') : [];
    const found = apps.find(app => typeof app.repo === 'string' && app.repo.toLowerCase() === repo) || null;
    // Two plugins can share a name (a fork and its original): like DeckyHub and its website, the title says whose it is.
    const shared = found && typeof found.name === 'string' && apps.filter(app => typeof app.name === 'string' && app.name.toLowerCase() === found.name.toLowerCase()).length > 1;
    sendResponse({
      app: shared ? { ...found, name: `${found.name} by ${owner}` } : found,
      catalogAvailable: !!catalog.data,
      more: apps.filter(app => typeof app.repo === 'string' && app.repo.toLowerCase() !== repo && app.repo.toLowerCase().split('/')[0] === owner && typeof app.id === 'string' && typeof app.name === 'string').slice(0, 8).map(({ id, name }) => ({ id, name })),
      stats: stats.data?.plugins?.[repo] || null,
      scans: plugin || null,
      // External reports by lowercase SHA-256, for every scanned release (stable, pre-release and the kept history).
      external: Object.fromEntries([plugin?.stable, plugin?.prerelease, ...(plugin?.releases || [])].map(item => item?.sha256).filter((hash): hash is string => typeof hash === 'string' && /^[a-f0-9]{64}$/i.test(hash)).map((hash): [string, External] => [hash.toLowerCase(), { virusTotal: virustotal.data?.reports?.[hash.toLowerCase()] || null, metaDefender: metadefender.data?.reports?.[hash.toLowerCase()] || null }])),
      virusTotalAvailable: !!virustotal.data,
      metaDefenderAvailable: !!metadefender.data,
      unavailable: [!stats.data && 'audit data', (!scans.data || scanInvalid) && 'scan data'].filter((item): item is string => !!item),
      stale: [catalog, stats, scans, virustotal, metadefender].some(source => source.stale),
    });
  }).catch(() => sendResponse({ catalogAvailable: false }));
  return true;
});
