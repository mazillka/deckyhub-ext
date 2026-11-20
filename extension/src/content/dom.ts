// Small DOM helpers the panels are built from. Registry data is untrusted: text goes in as text, never as HTML.

export const SLUG = /^[a-z0-9][a-z0-9-]*$/;

export const el = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, className?: string): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
};

export function badge(parent: Element, text: string, kind: string) {
  parent.append(el('span', text, `dh-badge dh-${kind}`));
}

// A link that opens in a new tab and gives the page it opens no handle on this one.
export function newTabLink(text: string, href: string, className?: string) {
  const link = el('a', text, className);
  link.href = href;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  return link;
}
