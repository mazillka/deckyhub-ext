const box = document.getElementById('collapse') as HTMLInputElement;
chrome.storage.local.get('deckyhub_collapse').then(v => { box.checked = !!v.deckyhub_collapse; });
box.addEventListener('change', () => chrome.storage.local.set({ deckyhub_collapse: box.checked }));
