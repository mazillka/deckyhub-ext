import type { Lookup } from './types';
import { clearPanels, render } from './content/panel.ts';

// Watches GitHub's navigation and draws the DeckyHub panels (content/panel.ts) for the repository page,
// the Releases list and a single release.

let lastUrl = '';
let sequence = 0;
let rendered = false;
// An unlisted repository page whose file list GitHub has not drawn yet: looked at again as the page fills in, for a while.
const WAIT_MS = 15000;
let waiting: { data: Lookup; collapsed: boolean; repo: string; until: number } | null = null;

const NAME = /^[\w.-]+$/;

// Which page this is: a repository (owner/name), its Releases list, or one release (tag). Null for any other page.
function pageOf(pathname: string) {
  const parts = pathname.split('/').filter(Boolean);
  const list = parts.length === 3 && parts[2] === 'releases';
  const isRelease = parts[2] === 'releases' && parts[3] === 'tag' && parts.length > 4;
  const tag = isRelease ? decodeURIComponent(parts.slice(4).join('/')) : '';
  if (parts.length < 2 || !(parts.length === 2 || tag || list) || !NAME.test(parts[0]) || !NAME.test(parts[1])) return null;
  return { repo: `${parts[0]}/${parts[1]}`, tag, list };
}

async function update() {
  const url = location.href;
  if (url === lastUrl && (!rendered || document.querySelector('.dh-panel'))) return;
  lastUrl = url;
  rendered = false;
  waiting = null;
  const current = ++sequence;
  clearPanels();
  const page = pageOf(location.pathname);
  if (!page) return;
  try {
    const startCollapsed = !!(await chrome.storage.local.get('deckyhub_collapse')).deckyhub_collapse;
    const data: Lookup = await chrome.runtime.sendMessage({ type: 'deckyhub:lookup', repo: page.repo });
    if (current === sequence && location.href === url) {
      rendered = render(data, page.tag, page.list, startCollapsed, page.repo);
      if (!rendered && data?.catalogAvailable && !data.app && !page.tag && !page.list) waiting = { data, collapsed: startCollapsed, repo: page.repo, until: Date.now() + WAIT_MS };
    }
  } catch { /* Extension reloaded or unavailable. */ }
}

document.addEventListener('turbo:load', update);
document.addEventListener('pjax:end', update);
// GitHub changes the DOM constantly: look at most once per frame instead of on every mutation batch.
let watching = false;
new MutationObserver(() => {
  if (watching) return;
  watching = true;
  requestAnimationFrame(() => {
    watching = false;
    const panelLost = rendered && !document.querySelector('.dh-panel') && document.querySelector('main');
    if (location.href !== lastUrl || panelLost) update();
    else if (waiting && !rendered) {
      if (Date.now() > waiting.until) waiting = null;
      else rendered = render(waiting.data, '', false, waiting.collapsed, waiting.repo);
    }
  });
}).observe(document.documentElement, { childList: true, subtree: true });
update();
