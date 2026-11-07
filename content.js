(() => {
  const ID = 'deckyhub-security-panel';
  const warnings = {
    blocked: ['Blocked by audit', 'The automated audit classified this release as blocked, for example because of suspected malware or a broken archive.'],
    'private-data': ['Reads private data', 'The audit found code that may access private data, such as Steam login data, SSH keys, or environment secrets.'],
    persistence: ['Changes system startup', 'The audit found code that may change startup behavior, such as shell profiles, kernel modules, or udev rules.'],
    'not-in-source': ['Code not in its repository', 'The release ZIP contains scripts or programs that the audit could not match to the repository source.'],
    obfuscated: ['Hidden code', 'The audit found encoded, packed, or otherwise obfuscated code.'],
    'no-tls-check': ['Skips HTTPS checks', 'The audit found code that disables HTTPS certificate verification.'],
    'runs-downloads': ['Runs downloaded scripts', 'The audit found code that downloads a script and runs it.'],
    vulnerable: ['Known vulnerabilities', 'The audit found bundled software with published security vulnerabilities.']
  };
  let lastUrl = '', sequence = 0, rendered = false;
  const el = (tag, text, className) => {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    if (className) node.className = className;
    return node;
  };
  function badge(parent, text, kind) { parent.append(el('span', text, `dh-badge dh-${kind}`)); }
  function scanner(parent, name, report) {
    const state = report?.result;
    const labels = { clean: 'No threats found', infected: 'Threat found', incomplete: 'Incomplete', error: 'Scan error' };
    const kind = state === 'clean' ? 'good' : state === 'infected' ? 'danger' : 'unknown';
    const row = el('div', '', 'dh-scan');
    row.append(el('strong', name));
    badge(row, labels[state] || 'Not scanned yet', kind);
    if (report?.scannedAt) row.append(el('span', `Scanned ${report.scannedAt}`, 'dh-muted'));
    parent.append(row);
    if (report?.found) parent.append(el('p', `Findings: ${Array.isArray(report.found) ? report.found.join(', ') : report.found}`, 'dh-detail'));
    if (report?.reason) parent.append(el('p', report.reason, 'dh-detail'));
  }
  function virusTotal(parent, report, available) {
    const row = el('div', '', 'dh-scan');
    row.append(el('strong', 'VirusTotal'));
    const counts = ['malicious', 'suspicious', 'harmless', 'undetected'].map(key => report?.stats?.[key]);
    if (report?.state === 'complete' && counts.every(n => Number.isSafeInteger(n) && n >= 0) && counts.reduce((a, b) => a + b, 0) > 0) {
      const flagged = counts[0] + counts[1], total = counts.reduce((a, b) => a + b, 0);
      badge(row, `${flagged} of ${total} engines flagged this ZIP`, flagged ? 'danger' : 'good');
      if (report.scannedAt) {
        const date = typeof report.scannedAt === 'number' ? new Date(report.scannedAt * 1000) : new Date(report.scannedAt);
        if (!Number.isNaN(date.getTime())) row.append(el('span', `Scanned ${date.toISOString().slice(0, 10)}`, 'dh-muted'));
      }
    } else {
      const labels = { pending: 'Scan pending', waiting: 'Scan pending', error: 'Scan error', unsupported: 'ZIP too large for VirusTotal' };
      badge(row, !available ? 'Report unavailable' : labels[report?.state] || (report?.state === 'complete' ? 'Invalid report' : 'Not scanned yet'), 'unknown');
    }
    parent.append(row);
  }
  function metaDefender(parent, report, available) {
    const row = el('div', '', 'dh-scan');
    row.append(el('strong', 'MetaDefender'));
    const { flagged, total } = report || {};
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
      const labels = { pending: 'Scan pending', waiting: 'Scan pending', error: 'Scan error', unsupported: 'ZIP too large for MetaDefender' };
      badge(row, !available ? 'Report unavailable' : labels[report?.state] || (report?.state === 'complete' ? 'Invalid report' : 'Not scanned yet'), 'unknown');
    }
    parent.append(row);
  }
  function render(data, repo) {
    document.getElementById(ID)?.remove();
    if (!data?.catalogAvailable || !data.app) return;
    const target = document.querySelector('main') || document.querySelector('#repo-content-pjax-container');
    if (!target) return;
    const panel = el('section', '', 'dh-panel'); panel.id = ID;
    panel.setAttribute('aria-label', 'DeckyHub security information');
    const head = el('div', '', 'dh-head');
    head.append(el('strong', 'DeckyHub security'), el('span', data.app.name, 'dh-muted'));
    if (typeof data.app.id === 'string' && /^[a-z0-9][a-z0-9-]*$/.test(data.app.id)) {
      const link = el('a', 'View on DeckyHub ↗');
      link.href = `https://deckyhub.com/plugins/${encodeURIComponent(data.app.id)}.html`;
      link.target = '_blank'; link.rel = 'noopener noreferrer'; head.append(link);
    }
    panel.append(head);
    const notes = el('section', '', 'dh-warnings');
    const items = el('ul', '', 'dh-warning-list');
    function warning(title, description, suffix = '') {
      const item = el('li');
      item.append(el('strong', title + suffix), document.createTextNode(` — ${description}`));
      items.append(item);
    }
    if (data.stats?.root === true) warning('Runs as root', 'The plugin backend runs with root privileges and can read or change system files and user data. Some plugins need this access.');
    for (const [field, suffix] of [['warnings', ''], ['prereleaseWarnings', ' (pre-release)']]) {
      if (Array.isArray(data.stats?.[field])) for (const code of data.stats[field]) {
        const [title, description] = warnings[code] || [String(code), 'The registry reported this audit finding; see the registry for details.'];
        warning(title, description, suffix);
      }
    }
    if (items.childNodes.length) {
      notes.append(el('strong', 'Warnings'), items, el('p', 'Audit findings indicate potential concerns and are not proof of harm.', 'dh-footnote'));
      if (Array.isArray(data.stats?.warnings) && data.stats.warnings.length || Array.isArray(data.stats?.prereleaseWarnings) && data.stats.prereleaseWarnings.length) {
        const audit = el('a', 'View audit ↗'); audit.href = 'https://decky-extended-plugins.beallio.com/audit';
        audit.target = '_blank'; audit.rel = 'noopener noreferrer'; notes.append(audit);
      }
      panel.append(notes);
    }
    const channels = data.scans || {};
    if (!channels.stable && !channels.prerelease) panel.append(el('p', 'No release scan report available yet.', 'dh-muted'));
    for (const [key, label] of [['stable', 'Stable'], ['prerelease', 'Pre-release']]) {
      const channel = channels[key]; if (!channel) continue;
      const section = el('div', '', 'dh-channel');
      section.append(el('div', `${label} · ${channel.tag || 'Unknown release'}${channel.file ? ` · ${channel.file}` : ''}`, 'dh-release'));
      scanner(section, 'ClamAV', channel.clamav); scanner(section, 'YARA', channel.yara);
      virusTotal(section, data.virusTotal?.[key], data.virusTotalAvailable);
      metaDefender(section, data.metaDefender?.[key], data.metaDefenderAvailable);
      if (/^[a-f0-9]{64}$/i.test(channel.sha256 || '')) {
        const vt = el('a', 'Look up SHA-256 on VirusTotal ↗'); vt.href = `https://www.virustotal.com/gui/file/${channel.sha256}`; vt.target = '_blank'; vt.rel = 'noopener noreferrer'; section.append(vt);
      }
      panel.append(section);
    }
    if (channels.stable || channels.prerelease) {
      const raw = el('a', 'Registry ClamAV and YARA reports (all ZIPs) ↗');
      raw.href = 'https://github.com/mazillka/deckyhub-registry/blob/virus-scans/scans.json';
      raw.target = '_blank'; raw.rel = 'noopener noreferrer';
      const source = el('p', '', 'dh-detail'); source.append(raw); panel.append(source);
    }
    if (data.unavailable?.length) panel.append(el('p', `Unavailable: ${data.unavailable.join(', ')}.`, 'dh-notice'));
    if (data.stale) panel.append(el('p', 'Showing cached data because the registry could not be reached.', 'dh-notice'));
    panel.append(el('p', 'Reports cover the listed release ZIPs, not the current source. A clean scan does not guarantee safety; audit warnings may be unavailable.', 'dh-footnote'));
    target.prepend(panel); rendered = true;
  }
  async function update() {
    const url = location.href;
    if (url === lastUrl && (!rendered || document.getElementById(ID))) return;
    lastUrl = url; rendered = false;
    const current = ++sequence;
    document.getElementById(ID)?.remove();
    const parts = location.pathname.split('/').filter(Boolean);
    if (parts.length < 2 || !/^[\w.-]+$/.test(parts[0]) || !/^[\w.-]+$/.test(parts[1])) return;
    const repo = `${parts[0]}/${parts[1]}`;
    try { const data = await chrome.runtime.sendMessage({ type: 'deckyhub:lookup', repo }); if (current === sequence && location.href === url) render(data, repo); } catch (_) { /* Extension reloaded or unavailable. */ }
  }
  document.addEventListener('turbo:load', update);
  document.addEventListener('pjax:end', update);
  new MutationObserver(() => { if (location.href !== lastUrl || (rendered && !document.getElementById(ID) && document.querySelector('main'))) update(); }).observe(document.documentElement, { childList: true, subtree: true });
  update();
})();





