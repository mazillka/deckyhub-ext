const BASE = 'https://raw.githubusercontent.com/mazillka/deckyhub-registry/';
import type { External, Lookup, Scans, Stats, App } from './types';

const SOURCES = {
  catalog: 'main/registry/apps.json',
  stats: 'release-index/stats.json',
  scans: 'virus-scans/plugins.json',
  virustotal: 'virustotal-reports/reports.json',
  metadefender: 'metadefender-reports/reports.json'
};
const TTL = 30 * 60 * 1000;
type SourceName = keyof typeof SOURCES;
interface Source { data: any; stale: boolean; error?: string }

const pending = new Map<SourceName, Promise<Source>>();
// Parsed copies kept while this service worker lives: chrome.storage.local.get() would otherwise
// deserialize all five files (about 1.4 MB of JSON) again on every lookup.
const memory = new Map<SourceName, { time: number; data: any }>();

async function load(name: SourceName): Promise<Source> {
  const key = `deckyhub_${name}`;
  let cached = memory.get(name);
  if (!cached) {
    cached = (await chrome.storage.local.get(key))[key] as { time: number; data: any } | undefined;
    if (cached) memory.set(name, cached);
  }
  if (cached && Date.now() - cached.time < TTL) return { data: cached.data, stale: false };
  if (!pending.has(name)) {
    pending.set(name, (async () => {
      try {
        const response = await fetch(BASE + SOURCES[name], { cache: 'no-cache' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (name === 'catalog' ? !Array.isArray(data.apps) : (name === 'virustotal' || name === 'metadefender') ? !data.reports || typeof data.reports !== 'object' || Array.isArray(data.reports) : !data.plugins || typeof data.plugins !== 'object') throw new Error('Invalid registry data');
        const entry = { time: Date.now(), data };
        memory.set(name, entry);
        await chrome.storage.local.set({ [key]: entry });
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
    const plugin: (Scans & { stable?: { sha256?: string } }) | undefined = scans.data?.plugins?.[repo];
    sendResponse({
      app: catalog.data?.apps.find((app: App) => typeof app.repo === 'string' && app.repo.toLowerCase() === repo) || null,
      catalogAvailable: !!catalog.data,
      stats: stats.data?.plugins?.[repo] || null,
      scans: scans.data?.plugins?.[repo] || null,
      // External reports by lowercase SHA-256, for every scanned release (stable, pre-release and the kept history).
      external: Object.fromEntries([plugin?.stable, plugin?.prerelease, ...(plugin?.releases || [])].map(item => item?.sha256).filter((hash): hash is string => typeof hash === 'string' && /^[a-f0-9]{64}$/i.test(hash)).map((hash): [string, External] => [hash.toLowerCase(), { virusTotal: virustotal.data?.reports?.[hash.toLowerCase()] || null, metaDefender: metadefender.data?.reports?.[hash.toLowerCase()] || null }])),
      virusTotalAvailable: !!virustotal.data,
      metaDefenderAvailable: !!metadefender.data,
      unavailable: [!stats.data && 'audit data', !scans.data && 'scan data'].filter((item): item is string => !!item),
      stale: [catalog, stats, scans, virustotal, metadefender].some(source => source.stale),
    });
  }).catch(() => sendResponse({ catalogAvailable: false }));
  return true;
});
