const BASE = 'https://raw.githubusercontent.com/mazillka/deckyhub-registry/';
const SOURCES = {
  catalog: 'main/registry/apps.json',
  stats: 'release-index/stats.json',
  scans: 'virus-scans/plugins.json',
  virustotal: 'virustotal-reports/reports.json',
  metadefender: 'metadefender-reports/reports.json'
};
const TTL = 30 * 60 * 1000;
const pending = new Map();

async function load(name) {
  const key = `deckyhub_${name}`;
  const cached = (await chrome.storage.local.get(key))[key];
  if (cached && Date.now() - cached.time < TTL) return { data: cached.data, stale: false };
  if (!pending.has(name)) {
    pending.set(name, (async () => {
      try {
        const response = await fetch(BASE + SOURCES[name], { cache: 'no-cache' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (name === 'catalog' ? !Array.isArray(data.apps) : (name === 'virustotal' || name === 'metadefender') ? !data.reports || typeof data.reports !== 'object' || Array.isArray(data.reports) : !data.plugins || typeof data.plugins !== 'object') throw new Error('Invalid registry data');
        await chrome.storage.local.set({ [key]: { time: Date.now(), data } });
        return { data, stale: false };
      } catch (error) {
        return { data: cached?.data || null, stale: !!cached, error: String(error) };
      } finally { pending.delete(name); }
    })());
  }
  return pending.get(name);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== 'deckyhub:lookup' || !/^[\w.-]+\/[\w.-]+$/.test(message.repo || '')) return;
  Promise.all(Object.keys(SOURCES).map(load)).then(([catalog, stats, scans, virustotal, metadefender]) => {
    const repo = message.repo.toLowerCase();
    sendResponse({
      app: catalog.data?.apps.find(app => typeof app.repo === 'string' && app.repo.toLowerCase() === repo) || null,
      catalogAvailable: !!catalog.data,
      stats: stats.data?.plugins?.[repo] || null,
      scans: scans.data?.plugins?.[repo] || null,
      virusTotal: Object.fromEntries(['stable', 'prerelease'].map(channel => {
        const hash = scans.data?.plugins?.[repo]?.[channel]?.sha256;
        return [channel, typeof hash === 'string' && /^[a-f0-9]{64}$/i.test(hash) ? virustotal.data?.reports?.[hash.toLowerCase()] || null : null];
      })),
      virusTotalAvailable: !!virustotal.data,
      metaDefender: Object.fromEntries(['stable', 'prerelease'].map(channel => {
        const hash = scans.data?.plugins?.[repo]?.[channel]?.sha256;
        return [channel, typeof hash === 'string' && /^[a-f0-9]{64}$/i.test(hash) ? metadefender.data?.reports?.[hash.toLowerCase()] || null : null];
      })),
      metaDefenderAvailable: !!metadefender.data,
      unavailable: [!stats.data && 'audit data', !scans.data && 'scan data'].filter(Boolean),
      stale: [catalog, stats, scans, virustotal, metadefender].some(source => source.stale),
      statsUpdated: stats.data?.generatedAt,
      scansUpdated: scans.data?.generatedAt
    });
  }).catch(() => sendResponse({ catalogAvailable: false }));
  return true;
});


