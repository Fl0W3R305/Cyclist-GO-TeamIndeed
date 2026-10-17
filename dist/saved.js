/* Saved destinations only: no route is fixed when a place is saved.
   Uses the existing browser-only demo account model, with a separate guest list. */
(() => {
  const el = id => document.getElementById(id);
  let editing = null;
  function owner() {
    const email = localStorage.getItem('cyclist-go-demo-session-v1');
    const users = JSON.parse(localStorage.getItem('cyclist-go-demo-accounts-v1') || '[]');
    return Array.isArray(users) && users.some(u => u.email === email) ? email : 'guest';
  }
  function key() { return 'cyclist-go-saved-places-v1:' + owner(); }
  function read() {
    const list = JSON.parse(localStorage.getItem(key()) || '[]');
    if (!Array.isArray(list)) throw new Error('Invalid saved places');
    return list.filter((p, i) => p && D.destinations.some(d => d.id === p.id) && list.findIndex(x => x?.id === p.id) === i).map(p => ({id:p.id, tag:typeof p.tag === 'string' ? p.tag.slice(0,30) : ''}));
  }
  function error(message) { el('saved-error').textContent = message; el('saved-error').hidden = !message; }
  function write(list) {
    try { localStorage.setItem(key(), JSON.stringify(list)); error(''); render(); return true; }
    catch { error('Could not save your places. Allow browser storage and try again.'); toast('Could not save. Check browser storage.'); return false; }
  }
  function render() {
    try {
      const list = read();
      el('saved-scope').textContent = owner() === 'guest' ? 'Guest saved places · Stored in this browser.' : 'Your saved places · Stored for this demo account in this browser.';
      el('saved-list').innerHTML = list.map(p => {
        const d = D.destinations.find(d => d.id === p.id);
        return `<li class="saved-row"><button class="saved-open" data-saved-open="${d.id}" type="button"><span class="saved-place-icon" aria-hidden="true">${d.icon}</span><span><strong>${escapeHTML(p.tag || d.name)}</strong><span class="saved-address">${escapeHTML(p.tag ? d.name : d.detail)}</span><span class="saved-route-hint">Choose a route →</span></span></button><div class="saved-row-tools"><button data-saved-tag="${d.id}" type="button" aria-label="Edit label for ${escapeHTML(d.name)}">Label</button><button data-saved-remove="${d.id}" type="button" aria-label="Remove ${escapeHTML(d.name)} from saved places">Remove</button></div></li>`;
      }).join('');
      el('saved-empty').hidden = list.length > 0;
      document.querySelectorAll('[data-save-place]').forEach(b => {
        const exists = list.some(p => p.id === state.destination);
        b.disabled = !D.destinations.some(d => d.id === state.destination);
        b.textContent = exists ? '★ Destination saved' : '☆ Save destination';
        b.setAttribute('aria-pressed', String(exists));
      });
    } catch {
      el('saved-list').replaceChildren(); el('saved-empty').hidden = true;
      error('Saved places could not be read. Check that browser storage is available.');
    }
  }
  function page(saved) {
    if (saved && state.view === 'ride') { toast('End your ride before opening Saved.'); return; }
    el('mvp-page').hidden = saved; el('saved-page').hidden = !saved;
    el('nav-mvp').setAttribute('aria-current', saved ? 'false' : 'page');
    el('nav-saved').setAttribute('aria-current', saved ? 'page' : 'false');
    if (saved) { render(); el('saved-title').focus(); }
    else setTimeout(() => { state.map?.invalidateSize(); if (current()) fit(); }, 0);
  }
  function add() { page(false); showView('plan'); el('destination').focus(); }
  el('nav-mvp').addEventListener('click', () => page(false));
  el('nav-saved').addEventListener('click', () => page(true));
  el('saved-add').addEventListener('click', add);
  el('saved-explore').addEventListener('click', add);
  document.querySelectorAll('[data-save-place]').forEach(b => b.addEventListener('click', () => {
    if (!dest()) return;
    try {
      const list = read();
      if (list.some(p => p.id === state.destination)) { toast('Already saved. Find it in Saved.'); return; }
      if (write([...list, {id:state.destination, tag:''}])) toast(dest().name + ' added to Saved.');
    } catch { toast('Could not save. Check browser storage.'); }
  }));
  el('saved-list').addEventListener('click', e => {
    const open = e.target.closest('[data-saved-open]');
    if (open) { page(false); chooseDestination(open.dataset.savedOpen); plan(); el('edit-destination').focus(); return; }
    const tag = e.target.closest('[data-saved-tag]');
    const remove = e.target.closest('[data-saved-remove]');
    try {
      const list = read();
      if (tag) {
        const p = list.find(p => p.id === tag.dataset.savedTag); if (!p) return;
        editing = {id:p.id, owner:owner()}; el('saved-tag').value = p.tag;
        el('saved-tag-place').textContent = D.destinations.find(d => d.id === p.id).name;
        el('saved-tag-dialog').showModal(); el('saved-tag').focus();
      }
      if (remove) {
        const p = list.find(p => p.id === remove.dataset.savedRemove), account = owner();
        if (p && write(list.filter(x => x.id !== p.id))) toast('Place removed from Saved.', () => {
          try { if (owner() !== account) return; const now = read(); if (!now.some(x => x.id === p.id)) write([...now,p]); } catch { error('Could not restore this place.'); }
        });
      }
    } catch { error('Could not read saved places.'); }
  });
  el('saved-tag-cancel').addEventListener('click', () => el('saved-tag-dialog').close());
  el('saved-tag-form').addEventListener('submit', e => {
    e.preventDefault();
    try {
      if (!editing || editing.owner !== owner()) { el('saved-tag-dialog').close(); return; }
      if (write(read().map(p => p.id === editing.id ? {...p, tag:el('saved-tag').value.trim().slice(0,30)} : p))) el('saved-tag-dialog').close();
    } catch { error('Could not save this label.'); }
  });
  document.addEventListener('cyclist:destination', render);
  document.addEventListener('cyclist:view', () => { el('nav-saved').disabled = state.view === 'ride'; render(); });
  document.addEventListener('cyclist:account', () => { el('saved-tag-dialog').close(); error(''); render(); });
  window.addEventListener('storage', () => { error(''); render(); });
  render();
})();
