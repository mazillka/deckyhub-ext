import type { Lookup, MetaDefenderReport, ScanRecord, Stats, Verdict, VirusTotalReport } from './types';

interface Found { record: ScanRecord; pre: boolean; channel?: 'stable' | 'prerelease' }

(() => {
  const ID = 'deckyhub-security-panel';
  const warnings: Record<string, [string, string]> = {
    blocked: ['Blocked by audit', 'The automated audit classified this release as blocked, for example because of suspected malware or a broken archive.'],
    'private-data': ['Reads private data', 'The audit found code that may access private data, such as Steam login data, SSH keys, or environment secrets.'],
    persistence: ['Changes system startup', 'The audit found code that may change startup behavior, such as shell profiles, kernel modules, or udev rules.'],
    'not-in-source': ['Code not in its repository', 'The release ZIP contains scripts or programs that the audit could not match to the repository source.'],
    obfuscated: ['Hidden code', 'The audit found encoded, packed, or otherwise obfuscated code.'],
    'no-tls-check': ['Skips HTTPS checks', 'The audit found code that disables HTTPS certificate verification.'],
    'runs-downloads': ['Runs downloaded scripts', 'The audit found code that downloads a script and runs it.'],
    vulnerable: ['Known vulnerabilities', 'The audit found bundled software with published security vulnerabilities.']
  };
  const clear = () => document.querySelectorAll('.dh-panel').forEach(n => n.remove());
  let startCollapsed = false;
  let lastUrl = '', sequence = 0, rendered = false;
  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, className?: string): HTMLElementTagNameMap[K] => {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    if (className) node.className = className;
    return node;
  };
  function badge(parent: Element, text: string, kind: string) { parent.append(el('span', text, `dh-badge dh-${kind}`)); }
  function scanner(parent: Element, name: string, report?: Verdict) {
    const state = report?.result;
    const labels: Record<string, string> = { clean: 'No threats found', infected: 'Threat found', incomplete: 'Incomplete', error: 'Scan error' };
    const kind = state === 'clean' ? 'good' : state === 'infected' || !state ? 'danger' : 'unknown';
    const row = el('div', '', 'dh-scan');
    row.append(el('strong', name));
    badge(row, (state && labels[state]) || 'Not scanned yet', kind);
    if (report?.scannedAt) row.append(el('span', `Scanned ${report.scannedAt}`, 'dh-muted'));
    parent.append(row);
    if (report?.found) parent.append(el('p', `Findings: ${Array.isArray(report.found) ? report.found.join(', ') : report.found}`, 'dh-detail'));
    if (report?.reason) parent.append(el('p', report.reason, 'dh-detail'));
  }
  function virusTotal(parent: Element, report: VirusTotalReport | null | undefined, available?: boolean) {
    const row = el('div', '', 'dh-scan');
    row.append(el('strong', 'VirusTotal'));
    const counts = ['malicious', 'suspicious', 'harmless', 'undetected'].map(key => report?.stats?.[key] ?? -1);
    if (report?.state === 'complete' && counts.every(n => Number.isSafeInteger(n) && n >= 0) && counts.reduce((a, b) => a + b, 0) > 0) {
      const flagged = counts[0] + counts[1], total = counts.reduce((a, b) => a + b, 0);
      badge(row, `${flagged} of ${total} engines flagged this ZIP`, flagged ? 'danger' : 'good');
      if (report.scannedAt) {
        const date = typeof report.scannedAt === 'number' ? new Date(report.scannedAt * 1000) : new Date(report.scannedAt);
        if (!Number.isNaN(date.getTime())) row.append(el('span', `Scanned ${date.toISOString().slice(0, 10)}`, 'dh-muted'));
      }
    } else {
      const labels: Record<string, string> = { pending: 'Scan pending', waiting: 'Scan pending', error: 'Scan error', unsupported: 'ZIP too large for VirusTotal' };
      const state = report?.state;
      const pending = state === 'pending' || state === 'waiting' || !state;
      badge(row, !available ? 'Report unavailable' : (state && labels[state]) || (state === 'complete' ? 'Invalid report' : 'Not scanned yet'), available && pending ? 'danger' : 'unknown');
    }
    parent.append(row);
  }
  function metaDefender(parent: Element, report: MetaDefenderReport | null | undefined, available?: boolean) {
    const row = el('div', '', 'dh-scan');
    row.append(el('strong', 'MetaDefender'));
    const { flagged = -1, total = -1 } = report || {};
    if (report?.state === 'complete' && Number.isSafeInteger(flagged) && Number.isSafeInteger(total) && flagged >= 0 && total > 0 && flagged <= total) {
      badge(row, `${flagged} of ${total} engines flagged this ZIP`, flagged ? 'danger' : 'good');
      if (report.scannedAt) {
        const date = new Date(report.scannedAt);
        if (!Number.isNaN(date.getTime())) row.append(el('span', `Scanned ${date.toISOString().slice(0, 10)}`, 'dh-muted'));
      }
      if (typeof report.dataId === 'string' && /^[A-Za-z0-9_-]+$/.test(report.dataId)) {
        const link = el('a', 'View report ↗');
        link.href = `https://metadefender.opswat.com/results/file/${report.dataId}/regular/overview`;
        link.target = '_blank'; link.rel = 'noopener noreferrer'; row.append(link);
      }
    } else {
      const labels: Record<string, string> = { pending: 'Scan pending', waiting: 'Scan pending', error: 'Scan error', unsupported: 'ZIP too large for MetaDefender' };
      const state = report?.state;
      const pending = state === 'pending' || state === 'waiting' || !state;
      badge(row, !available ? 'Report unavailable' : (state && labels[state]) || (state === 'complete' ? 'Invalid report' : 'Not scanned yet'), available && pending ? 'danger' : 'unknown');
    }
    parent.append(row);
  }
  function brandBlock(title: string) {
    const brand = el('div', '', 'dh-brand');
    const icon = el('img', '', 'dh-icon');
    icon.src = chrome.runtime.getURL('icons/icon48.png');
    icon.alt = '';
    icon.width = icon.height = 40;
    const identity = el('div', '', 'dh-identity');
    identity.append(el('h2', title, 'dh-title'), el('span', 'Deckyhub', 'dh-muted'));
    brand.append(icon, identity);
    return brand;
  }
  function toggle(panel: Element, head: Element) {
    const button = el('button', startCollapsed ? 'Expand' : 'Collapse', 'dh-toggle');
    button.type = 'button'; button.setAttribute('aria-expanded', String(!startCollapsed));
    panel.classList.toggle('dh-collapsed', startCollapsed);
    button.addEventListener('click', () => {
      const closed = panel.classList.toggle('dh-collapsed');
      button.textContent = closed ? 'Expand' : 'Collapse'; button.setAttribute('aria-expanded', String(!closed));
    });
    head.append(button);
  }
  function siteLinks(data: Lookup, tag?: string) {
    const id = data.app?.id;
    if (typeof id !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(id)) return null;
    const link = el('a', 'View on DeckyHub ↗', 'dh-site-link');
    link.href = `https://deckyhub.com/plugins/${encodeURIComponent(id)}.html${tag ? `#v-${encodeURIComponent(tag)}` : ''}`;
    link.target = '_blank'; link.rel = 'noopener noreferrer';
    const install = el('a', 'Send to device (experimental) ↗', 'dh-install-link');
    install.href = `https://deckyhub.com/develop/plugins/${encodeURIComponent(id)}.html${tag ? `?tag=${encodeURIComponent(tag)}` : ''}#remote-install`;
    install.target = '_blank'; install.rel = 'noopener noreferrer';
    const actions = el('div', '', 'dh-actions');
    actions.append(link, install);
    return actions;
  }
  // The release the registry scanned for this tag, and whether it is a pre-release.
  function recordFor(data: Lookup, tag?: string): Found | null {
    const channels = data.scans || {};
    for (const [key, pre] of [['stable', false], ['prerelease', true]] as const) if (tag && channels[key]?.tag === tag) return { record: channels[key] as ScanRecord, pre, channel: key };
    const found = (channels.releases || []).find(item => item.tag === tag);
    return found ? { record: found, pre: !!found.prerelease } : null;
  }
  function externalCounts(data: Lookup, record: ScanRecord) {
    const ext = data.external?.[String(record.sha256 || '').toLowerCase()];
    const out: [string, number, number][] = [];
    const vt = ext?.virusTotal, vtCounts = ['malicious', 'suspicious', 'harmless', 'undetected'].map(key => vt?.stats?.[key] ?? -1);
    const vtTotal = vtCounts.reduce((x, y) => x + y, 0);
    if (vt?.state === 'complete' && vtCounts.every(n => Number.isSafeInteger(n) && n >= 0) && vtTotal > 0) out.push(['VirusTotal', vtCounts[0] + vtCounts[1], vtTotal]);
    const md = ext?.metaDefender;
    if (md?.state === 'complete' && md.flagged !== undefined && md.total !== undefined && Number.isSafeInteger(md.flagged) && Number.isSafeInteger(md.total) && md.flagged >= 0 && md.total > 0 && md.flagged <= md.total) out.push(['MetaDefender', md.flagged, md.total]);
    return out;
  }
  // The same safety badges deckyhub.com shows. all: repo-level facts too (fork, store, AI); fields: which audit warnings; scans: [{record, pre}].
  function badgeList(data: Lookup, { all = false, fields = [], scans = [] }: { all?: boolean; fields?: ['warnings' | 'prereleaseWarnings', string][]; scans?: Found[] }) {
    const items = el('ul', '', 'dh-warning-list');
    const add = (text: string, kind: string, description: string) => { const item = el('li'); item.append(el('span', text, `dh-badge dh-${kind}`), document.createTextNode(` ${description}`)); items.append(item); };
    const stats: Stats = data.stats || {};
    if (stats.root === true) add('Runs as root', 'warning', 'The plugin backend runs with root privileges and can read or change system files and user data. Some plugins need this access.');
    if (all && typeof stats.fork === 'string') add('Fork', 'unknown', `A fork of ${stats.fork}: its code started as a copy of that project.`);
    if (all && stats.store) add('In Decky store', 'unknown', 'The Decky store lists a plugin with this name. The store names no repository, so check that it is this one.');
    if (all && Array.isArray(stats.ai) && stats.ai.length) add('AI', 'unknown', `Its repository has instructions for AI coding assistants, or says it is made with AI (${stats.ai.join(', ')}). That says nothing about its quality or safety.`);
    for (const [field, prefix] of fields) {
      const codes = stats[field];
      if (!Array.isArray(codes)) continue;
      for (const code of codes) {
        if (field === 'prereleaseWarnings' && Array.isArray(stats.warnings) && stats.warnings.includes(code)) continue;
        const [title, description] = warnings[code] || [String(code), 'The registry reported this audit finding; see the registry for details.'];
        add(prefix + title, code === 'blocked' ? 'danger' : 'warning', description);
      }
    }
    const names: Record<string, string> = { clean: 'no threats found', infected: 'threat found', incomplete: 'only partly scanned', error: "couldn't be scanned" };
    for (const { record, pre } of scans) {
      if (!record.clamav) continue;
      const counts = externalCounts(data, record);
      const results = [record.clamav.result, record.yara?.result].filter((value): value is string => !!value).concat(counts.map(([, flagged]) => (flagged ? 'infected' : 'clean')));
      const kind = results.includes('infected') ? 'infected' : results.some(result => result !== 'clean') ? 'partial' : 'clean';
      const label = { clean: ['No threats', 'good'], infected: ['Threat found', 'danger'], partial: ['Not fully scanned', 'warning'] }[kind] as [string, string];
      const detail = ([['ClamAV', record.clamav], ['YARA', record.yara]] as [string, Verdict | undefined][]).filter((pair): pair is [string, Verdict] => !!pair[1])
        .map(([name, scan]) => `${name}: ${(scan.result && names[scan.result]) || scan.result}${Array.isArray(scan.found) && scan.found.length ? ` (${scan.found.join(', ')})` : ''}`)
        .concat(counts.map(([name, flagged, total]) => `${name}: ${flagged} of ${total} engines flagged it`)).join('; ');
      add((pre ? 'Pre-release: ' : '') + label[0], label[1], `Virus scan of ${record.file || 'the ZIP'} (${record.tag}): ${detail}. A clean scan isn't proof of safety.`);
    }
    return items.childNodes.length ? items : null;
  }
  function notices(data: Lookup, parent: Element) {
    if (data.unavailable?.length) parent.append(el('p', `Unavailable: ${data.unavailable.join(', ')}.`, 'dh-notice'));
    if (data.stale) parent.append(el('p', 'Showing cached data because the registry could not be reached.', 'dh-notice'));
  }
  function releaseBlock(data: Lookup, tag: string) {
    const block = el('section', '', 'dh-panel');
    const head = el('div', '', 'dh-head'), actions = siteLinks(data, tag);
    head.append(brandBlock(data.app?.name || '')); if (actions) head.append(actions);
    toggle(block, head); block.append(head);
    // Audit warnings are kept per channel; they belong to the release that channel's scan names.
    const found = recordFor(data, tag);
    const fields: ['warnings' | 'prereleaseWarnings', string][] = found?.channel === 'stable' ? [['warnings', '']] : found?.channel === 'prerelease' ? [['prereleaseWarnings', '']] : [];
    const items = badgeList(data, { fields, scans: found ? [found] : [] });
    if (items) block.append(el('h3', 'Safety information', 'dh-section-title'), items, el('p', 'Audit findings indicate potential concerns and are not proof of harm.', 'dh-footnote'));
    block.append(scanBlock(data, tag)); notices(data, block);
    block.append(el('p', 'Reports cover the listed release ZIPs, not the current source. A clean scan does not guarantee safety.', 'dh-footnote'));
    return block;
  }
  function scanBlock(data: Lookup, tag: string) {
    const box = el('div');
    const reports = el('div', '', 'dh-reports');
    const found = recordFor(data, tag);
    if (found) {
      const { record, pre } = found;
      const section = el('div', '', 'dh-channel');
      section.append(el('h3', `${pre ? 'Pre-release' : 'Stable'} · ${record.tag || 'Unknown release'}`, 'dh-release'));
      if (record.file) section.append(el('p', record.file, 'dh-file'));
      scanner(section, 'ClamAV', record.clamav); scanner(section, 'YARA', record.yara);
      const ext = data.external?.[String(record.sha256 || '').toLowerCase()];
      virusTotal(section, ext?.virusTotal, data.virusTotalAvailable);
      metaDefender(section, ext?.metaDefender, data.metaDefenderAvailable);
      if (/^[a-f0-9]{64}$/i.test(record.sha256 || '')) {
        const vt = el('a', 'Look up SHA-256 on VirusTotal ↗'); vt.href = `https://www.virustotal.com/gui/file/${record.sha256}`; vt.target = '_blank'; vt.rel = 'noopener noreferrer'; section.append(vt);
      }
      reports.append(section);
    }
    if (!reports.childElementCount) box.append(el('p', 'No scan report for this release. The registry scans only the latest stable and pre-release ZIPs.', 'dh-muted'));
    else {
      box.append(reports);
      const raw = el('a', 'Registry ClamAV and YARA reports (all ZIPs) ↗');
      raw.href = 'https://github.com/mazillka/deckyhub-registry/blob/virus-scans/scans.json';
      raw.target = '_blank'; raw.rel = 'noopener noreferrer';
      const source = el('p', '', 'dh-detail'); source.append(raw); box.append(source);
    }
    return box;
  }
  function render(data: Lookup, tag: string, list: boolean) {
    clear();
    if (!data?.catalogAvailable || !data.app) return;
    const target = document.querySelector('main') || document.querySelector('#repo-content-pjax-container');
    if (!target) return;
    if (list) {
      const seen = new Set<Element>();
      for (const link of target.querySelectorAll('a[href*="/releases/tag/"]')) {
        const card = link.closest('.Box-body'), rel = decodeURIComponent((link.getAttribute('href') || '').split('/releases/tag/')[1] || '');
        if (!card || seen.has(card)) continue; seen.add(card);
        card.append(releaseBlock(data, rel));
      }
      rendered = true; return;
    }
    if (tag) {
      (target.querySelector('.Box-body') || target).append(releaseBlock(data, tag));
      rendered = true; return;
    }
    const panel = el('section', '', 'dh-panel'); panel.id = ID;
    panel.setAttribute('aria-label', 'DeckyHub security information');
    const head = el('div', '', 'dh-head');
    const brand = brandBlock(data.app.name);
    head.append(brand);
    const actions = siteLinks(data); if (actions) head.append(actions);
    toggle(panel, head); panel.append(head);
    const notes = el('section', '', 'dh-warnings');
    const latest = [recordFor(data, data.scans?.stable?.tag), recordFor(data, data.scans?.prerelease?.tag)].filter((item, index, list): item is Found => !!item && list.findIndex(other => other?.record === item.record) === index);
    const items = badgeList(data, { all: true, fields: [['warnings', ''], ['prereleaseWarnings', 'Pre-release: ']], scans: latest });
    if (items) {
      notes.append(el('h3', 'Safety information', 'dh-section-title'), items, el('p', 'Audit findings indicate potential concerns and are not proof of harm.', 'dh-footnote'));
      if (Array.isArray(data.stats?.warnings) && data.stats.warnings.length || Array.isArray(data.stats?.prereleaseWarnings) && data.stats.prereleaseWarnings.length) {
        const audit = el('a', 'View audit ↗'); audit.href = 'https://decky-extended-plugins.beallio.com/audit';
        audit.target = '_blank'; audit.rel = 'noopener noreferrer'; notes.append(audit);
      }
      panel.append(notes);
    }
    // Repo page: general info only. Scan reports belong to each release.
    panel.append(el('p', 'Open a release to see its scan reports. Audit warnings indicate potential concerns and are not proof of harm.', 'dh-footnote'));
    notices(data, panel);
    target.prepend(panel); rendered = true;
  }
  async function update() {
    const url = location.href;
    if (url === lastUrl && (!rendered || document.querySelector('.dh-panel'))) return;
    lastUrl = url; rendered = false;
    const current = ++sequence;
    clear();
    const parts = location.pathname.split('/').filter(Boolean);
    const list = parts.length === 3 && parts[2] === 'releases';
    const tag = parts[2] === 'releases' && parts[3] === 'tag' && parts.length > 4 ? decodeURIComponent(parts.slice(4).join('/')) : '';
    if (parts.length < 2 || !(parts.length === 2 || tag || list) || !/^[\w.-]+$/.test(parts[0]) || !/^[\w.-]+$/.test(parts[1])) return;
    const repo = `${parts[0]}/${parts[1]}`;
    try { startCollapsed = !!(await chrome.storage.local.get('deckyhub_collapse')).deckyhub_collapse; const data: Lookup = await chrome.runtime.sendMessage({ type: 'deckyhub:lookup', repo }); if (current === sequence && location.href === url) render(data, tag, list); } catch { /* Extension reloaded or unavailable. */ }
  }
  document.addEventListener('turbo:load', update);
  document.addEventListener('pjax:end', update);
  new MutationObserver(() => { if (location.href !== lastUrl || (rendered && !document.querySelector('.dh-panel') && document.querySelector('main'))) update(); }).observe(document.documentElement, { childList: true, subtree: true });
  update();
})();
