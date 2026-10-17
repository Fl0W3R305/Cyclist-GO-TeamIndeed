/* Complete route snapshots, scoped to local classroom demo accounts. */
(() => {
  const el = id => document.getElementById(id);
  let editing = null, pending = null;
  const owner = () => window.DemoAuth.currentUser()?.email || null;
  const key = () => 'cyclist-go-saved-routes-v1:' + owner();
  const identity = (destination, route) => destination + ':' + route.signature;
  function read() {
    if (!owner()) return [];
    const list = JSON.parse(localStorage.getItem(key()) || '[]');
    if (!Array.isArray(list)) throw new Error('Invalid saved routes');
    return list.filter(p => p && typeof p.id === 'string' && D.destinations.some(d => d.id === p.destination) && p.route && Array.isArray(p.route.points));
  }
  function error(message) { el('saved-error').textContent = message; el('saved-error').hidden = !message; }
  function write(list) {
    if (!owner()) return false;
    try { localStorage.setItem(key(), JSON.stringify(list)); error(''); render(); return true; }
    catch { error('Could not save your routes. Allow browser storage and try again.'); toast('Could not save. Check browser storage.'); return false; }
  }
  function render() {
    const user = owner();
    el('saved-login').hidden = !!user;
    el('saved-add').hidden = !user;
    el('saved-scope').textContent = user ? 'Your saved routes · Stored for this demo account in this browser.' : '';
    try {
      const list = read();
      el('saved-list').innerHTML = list.map(p => {
        const d = D.destinations.find(d => d.id === p.destination), r = p.route, id = escapeHTML(p.id);
        return `<li class="saved-row"><button class="saved-open" data-saved-open="${id}" type="button"><span class="saved-place-icon" aria-hidden="true">${d.icon}</span><span><strong>${escapeHTML(p.tag || 'Indooroopilly → ' + d.name)}</strong><span class="saved-address">${escapeHTML(r.name)} · ${Number(r.km).toFixed(2)} km · ${Number(r.minutes)} min</span><span class="saved-address">${Math.round(r.bikeway*100)}% bikeways · ${Math.round(r.offroad*100)}% off-road</span><span class="saved-route-hint">View saved route →</span></span></button><div class="saved-row-tools"><button data-saved-tag="${id}" type="button">Label</button><button data-saved-remove="${id}" type="button">Remove</button></div></li>`;
      }).join('');
      el('saved-empty').hidden = !user || list.length > 0;
      const r = current(), exists = r && list.some(p => p.id === identity(state.destination,r));
      el('save-route').disabled = !r;
      el('save-route').textContent = exists ? '★ Route saved' : '☆ Save route';
      el('save-route').setAttribute('aria-pressed', String(!!exists));
    } catch {
      el('saved-list').replaceChildren(); el('saved-empty').hidden = true;
      error('Saved routes could not be read. Check that browser storage is available.');
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
  function saveRoute(snapshot) {
    if (!owner()) return;
    try {
      const list = read();
      if (list.some(p => p.id === snapshot.id)) { toast('This route is already saved.'); return; }
      if (write([...list,snapshot])) toast('Route saved. Find it in Saved.');
    } catch { error('Could not save this route. Check browser storage.'); }
  }
  function add() { page(false); showView('plan'); el('destination').focus(); }
  el('nav-mvp').addEventListener('click', () => page(false));
  el('nav-saved').addEventListener('click', () => page(true));
  el('saved-add').addEventListener('click', add);
  el('saved-explore').addEventListener('click', add);
  el('saved-login-button').addEventListener('click', () => window.DemoAuth.openLogin());
  el('save-route').addEventListener('click', () => {
    if (state.view !== 'summary' || !current()) return;
    const snapshot = {id:identity(state.destination,current()),destination:state.destination,route:JSON.parse(JSON.stringify(current())),tag:'',savedAt:Date.now()};
    if (!owner()) { pending=snapshot; window.DemoAuth.openLogin(); }
    else saveRoute(snapshot);
  });
  el('saved-list').addEventListener('click', e => {
    if (!owner()) { render(); return; }
    try {
      const list = read(), open = e.target.closest('[data-saved-open]'), tag = e.target.closest('[data-saved-tag]'), remove = e.target.closest('[data-saved-remove]');
      if (open) {
        const p = list.find(p => p.id === open.dataset.savedOpen); if (!p) return;
        // Keep the exact stored path and measurements; clear filters so it is visible.
        const routes = Preferences.evaluate(D.buildRoutes(p.destination));
        const snapshot = JSON.parse(JSON.stringify(p.route));
        const index = routes.findIndex(r => r.id === snapshot.id);
        if (index < 0) throw new Error('Route mode unavailable');
        routes[index] = snapshot;
        Preferences.selected.clear(); Preferences.render();
        chooseDestination(p.destination); state.routes=routes; state.selected=snapshot.id;
        state.samples=sampleHazards(routes,p.destination); state.filter='all';
        state.rider?.remove(); state.rider=null;
        page(false); showView('compare'); applyPreferences(); fit(); el('start-ride').focus();
      }
      if (tag) {
        const p = list.find(p => p.id === tag.dataset.savedTag); if (!p) return;
        editing = {id:p.id,owner:owner()}; el('saved-tag').value=p.tag || '';
        el('saved-tag-place').textContent=D.destinations.find(d => d.id===p.destination).name + ' · ' + p.route.name;
        el('saved-tag-dialog').showModal(); el('saved-tag').focus();
      }
      if (remove) {
        const p=list.find(p=>p.id===remove.dataset.savedRemove), account=owner();
        if(p && write(list.filter(x=>x.id!==p.id))) toast('Route removed from Saved.',()=>{
          try { if(owner()!==account)return; const now=read(); if(!now.some(x=>x.id===p.id))write([...now,p]); } catch {error('Could not restore this route.');}
        });
      }
    } catch {error('Could not open or update this saved route.');}
  });
  el('saved-tag-cancel').addEventListener('click',()=>el('saved-tag-dialog').close());
  el('saved-tag-form').addEventListener('submit',e=>{
    e.preventDefault();
    try {
      if(!editing || !owner() || editing.owner!==owner()){el('saved-tag-dialog').close();return;}
      if(write(read().map(p=>p.id===editing.id?{...p,tag:el('saved-tag').value.trim().slice(0,30)}:p)))el('saved-tag-dialog').close();
    } catch {error('Could not save this label.');}
  });
  document.addEventListener('cyclist:login',()=>{const snapshot=pending;pending=null;if(snapshot)saveRoute(snapshot);render();});
  document.addEventListener('cyclist:authclosed',()=>{if(!owner())pending=null;});
  document.addEventListener('cyclist:destination',render);
  document.addEventListener('cyclist:view',()=>{el('nav-saved').disabled=state.view==='ride';render();});
  document.addEventListener('cyclist:account',()=>{el('saved-tag-dialog').close();editing=null;error('');render();});
  window.addEventListener('storage',()=>{pending=null;editing=null;el('saved-tag-dialog').close();error('');render();});
  render();
})();
