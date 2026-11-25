// A GitHub repository that is not in the registry but looks like a Decky plugin gets a link that opens the registry's
// "Add a plugin" issue form with the repository filled in. The extension sends nothing itself: the person reads the
// form on GitHub and submits it, or not.

const ISSUE_FORM = 'https://github.com/mazillka/deckyhub-registry/issues/new?template=add_plugin.yml';
const REPO = /^[\w.-]+\/[\w.-]+$/;

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Decky Loader needs a plugin.json at a plugin's root, so a link to it in the repository's file list is the sign.
// A branch name with a slash in it is not matched: such a repository just gets no link.
export function looksLikeDeckyPlugin(repo: string) {
  if (!REPO.test(repo)) return false;
  const atRoot = new RegExp(`^/${escapeRegExp(repo)}/blob/[^/]+/plugin\\.json$`, 'i');
  return [...document.querySelectorAll('a[href$="/plugin.json"]')].some(link => atRoot.test(link.getAttribute('href') || ''));
}

// The issue form with its title and repository field filled in (GitHub fills a form field from the query parameter named after its id).
export function suggestionLink(repo: string) {
  if (!REPO.test(repo)) return null;
  return `${ISSUE_FORM}&title=${encodeURIComponent(`Add ${repo.split('/')[1]}`)}&repo=${encodeURIComponent(`https://github.com/${repo}`)}`;
}
