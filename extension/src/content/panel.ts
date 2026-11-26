import type { Lookup } from '../types';
import { badgeList, fieldsFor } from './badges.ts';
import { SLUG, el, newTabLink } from './dom.ts';
import { recordFor, scanBlock, type Found } from './scans.ts';
import { looksLikeDeckyPlugin, suggestionLink } from './suggest.ts';

// The panels on GitHub's pages: the repository page, each card of the Releases list, and a single release.

const ID = 'deckyhub-security-panel';
const STORE_NOTICE = 'This plugin is available through the Decky Store. Install it from Decky Loader’s Store. DeckyHub does not scan the store version.';
const AUDIT_FOOTNOTE = 'Audit findings indicate potential concerns and are not proof of harm.';

export const clearPanels = () => document.querySelectorAll('.dh-panel').forEach(node => node.remove());

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

// The Collapse / Expand button; the panel starts closed when the popup's setting says so.
function toggle(panel: Element, head: Element, startCollapsed: boolean) {
  const button = el('button', startCollapsed ? 'Expand' : 'Collapse', 'dh-toggle');
  button.type = 'button';
  button.setAttribute('aria-expanded', String(!startCollapsed));
  panel.classList.toggle('dh-collapsed', startCollapsed);
  button.addEventListener('click', () => {
    const closed = panel.classList.toggle('dh-collapsed');
    button.textContent = closed ? 'Expand' : 'Collapse';
    button.setAttribute('aria-expanded', String(!closed));
  });
  head.append(button);
}

function siteLinks(data: Lookup, tag?: string) {
  const id = data.app?.id;
  if (typeof id !== 'string' || !SLUG.test(id)) return null;
  const page = `https://deckyhub.com/plugins/${encodeURIComponent(id)}.html`;
  const installPage = `https://deckyhub.com/develop/plugins/${encodeURIComponent(id)}.html`;
  const actions = el('div', '', 'dh-actions');
  actions.append(newTabLink('View on DeckyHub ↗', `${page}${tag ? `#v-${encodeURIComponent(tag)}` : ''}`, 'dh-site-link'));
  if (data.app?.store !== true) {
    actions.append(newTabLink('Send to device (experimental) ↗', `${installPage}${tag ? `?tag=${encodeURIComponent(tag)}` : ''}#remote-install`, 'dh-install-link'));
  }
  // A search, not a link to a review: what it finds may be unrelated or nothing.
  actions.append(newTabLink('Search YouTube ↗', `https://www.youtube.com/results?search_query=${encodeURIComponent(`${data.app?.name} Decky`)}`, 'dh-youtube-link'));
  return actions;
}

// The registry's other plugins by this repository's owner, linked to their DeckyHub pages (names are text; an id that is not a slug gets no link).
function moreFromAuthor(data: Lookup, owner: string) {
  const items = (data.more || []).filter(item => typeof item?.id === 'string' && SLUG.test(item.id) && typeof item.name === 'string');
  if (!items.length) return null;
  const section = el('section', '', 'dh-more');
  section.append(el('h3', `More from ${owner} on DeckyHub`, 'dh-section-title'));
  const list = el('ul', '', 'dh-more-list');
  for (const item of items) {
    const row = el('li');
    row.append(newTabLink(item.name, `https://deckyhub.com/plugins/${encodeURIComponent(item.id as string)}.html`));
    list.append(row);
  }
  section.append(list);
  return section;
}

function notices(data: Lookup, parent: Element) {
  if (data.unavailable?.length) parent.append(el('p', `Unavailable: ${data.unavailable.join(', ')}.`, 'dh-notice'));
  if (data.stale) parent.append(el('p', 'Showing cached data because the registry could not be reached.', 'dh-notice'));
}

function panelHead(panel: Element, title: string, actions: Element | null, startCollapsed: boolean) {
  const head = el('div', '', 'dh-head');
  head.append(brandBlock(title));
  if (actions) head.append(actions);
  toggle(panel, head, startCollapsed);
  panel.append(head);
}

// One release: on the Releases list under each card, and on a release's own page.
function releaseBlock(data: Lookup, tag: string, startCollapsed: boolean) {
  const block = el('section', '', 'dh-panel');
  panelHead(block, data.app?.name || '', siteLinks(data, tag), startCollapsed);
  if (data.app?.store === true) {
    block.append(el('p', STORE_NOTICE, 'dh-notice'));
    return block;
  }
  // Audit warnings are kept per channel; they belong to the release that channel's scan names.
  const found = recordFor(data, tag);
  const items = badgeList(data, { fields: fieldsFor(found?.channel), scans: found ? [found] : [] });
  if (items) block.append(el('h3', 'Safety information', 'dh-section-title'), items, el('p', AUDIT_FOOTNOTE, 'dh-footnote'));
  block.append(scanBlock(data, tag));
  notices(data, block);
  block.append(el('p', 'Reports cover the listed release ZIPs, not the current source. A clean scan does not guarantee safety.', 'dh-footnote'));
  return block;
}

// The latest stable and pre-release scans, once each (they can be the same release).
function latestScans(data: Lookup) {
  return [recordFor(data, data.scans?.stable?.tag), recordFor(data, data.scans?.prerelease?.tag)]
    .filter((item, index, list): item is Found => !!item && list.findIndex(other => other?.record === item.record) === index);
}

const hasWarnings = (codes?: string[]) => Array.isArray(codes) && codes.length > 0;

function safetyInformation(data: Lookup) {
  const items = badgeList(data, { all: true, fields: [['warnings', ''], ['prereleaseWarnings', 'Pre-release: ']], scans: latestScans(data) });
  if (!items) return null;
  const notes = el('section', '', 'dh-warnings');
  notes.append(el('h3', 'Safety information', 'dh-section-title'), items, el('p', AUDIT_FOOTNOTE, 'dh-footnote'));
  if (hasWarnings(data.stats?.warnings) || hasWarnings(data.stats?.prereleaseWarnings)) {
    notes.append(newTabLink('View audit ↗', 'https://decky-extended-plugins.beallio.com/audit'));
  }
  return notes;
}

// The repository page: general info only. Scan reports belong to each release.
function repositoryPanel(data: Lookup, startCollapsed: boolean) {
  const app = data.app!;
  const panel = el('section', '', 'dh-panel');
  panel.id = ID;
  panel.setAttribute('aria-label', 'DeckyHub security information');
  panelHead(panel, app.name, siteLinks(data), startCollapsed);
  const more = moreFromAuthor(data, location.pathname.split('/').filter(Boolean)[0]);
  if (app.store === true) {
    panel.append(el('p', STORE_NOTICE, 'dh-notice'));
    if (more) panel.append(more);
    return panel;
  }
  const notes = safetyInformation(data);
  if (notes) panel.append(notes);
  // No scan record at all must not read as all clear.
  if (!data.scans && !data.unavailable?.includes('scan data')) panel.append(el('p', 'Not scanned yet. The registry has no virus scan result for this plugin’s releases, so this panel can’t tell you anything about them, either way.', 'dh-notice'));
  panel.append(el('p', 'Open a release to see its scan reports. Audit warnings indicate potential concerns and are not proof of harm.', 'dh-footnote'));
  if (more) panel.append(more);
  notices(data, panel);
  return panel;
}

// A repository the registry does not list but that looks like a Decky plugin: no information, and a way to suggest it.
function suggestionPanel(repo: string, startCollapsed: boolean) {
  const href = suggestionLink(repo);
  if (!href) return null;
  const panel = el('section', '', 'dh-panel');
  panel.id = ID;
  panel.setAttribute('aria-label', 'DeckyHub suggestion');
  const actions = el('div', '', 'dh-actions');
  actions.append(newTabLink('Suggest it for DeckyHub ↗', href, 'dh-site-link'));
  panelHead(panel, 'Not in DeckyHub’s list', actions, startCollapsed);
  panel.append(
    el('p', 'DeckyHub has no audit findings or virus scans for this repository because it is not in DeckyHub’s list.', 'dh-notice'),
    el('p', 'It looks like a Decky plugin (a plugin.json at its root). The link opens a form in the DeckyHub registry that you can read and submit yourself; this extension sends nothing.', 'dh-footnote')
  );
  return panel;
}

// A block under each release card of the Releases list.
function addToReleaseCards(target: Element, data: Lookup, startCollapsed: boolean) {
  const seen = new Set<Element>();
  for (const link of target.querySelectorAll('a[href*="/releases/tag/"]')) {
    const card = link.closest('.Box-body');
    const tag = decodeURIComponent((link.getAttribute('href') || '').split('/releases/tag/')[1] || '');
    if (!card || seen.has(card)) continue;
    seen.add(card);
    card.append(releaseBlock(data, tag, startCollapsed));
  }
}

// Draws the panels for what the registry answered. True when it drew (or looked for) them, false when this page has none.
export function render(data: Lookup, tag: string, list: boolean, startCollapsed: boolean, repo = '') {
  clearPanels();
  if (!data?.catalogAvailable) return false;
  const target = document.querySelector('main') || document.querySelector('#repo-content-pjax-container');
  if (!target) return false;
  if (!data.app) {
    // Only the repository page itself, and only when its file list shows a plugin.json.
    const suggestion = !tag && !list && looksLikeDeckyPlugin(repo) ? suggestionPanel(repo, startCollapsed) : null;
    if (suggestion) target.prepend(suggestion);
    return !!suggestion;
  }
  if (list) addToReleaseCards(target, data, startCollapsed);
  else if (tag) (target.querySelector('.Box-body') || target).append(releaseBlock(data, tag, startCollapsed));
  else target.prepend(repositoryPanel(data, startCollapsed));
  return true;
}
