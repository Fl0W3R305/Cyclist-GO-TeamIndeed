/* Community demo: browser-local posts and interactions; no server or database. */
(() => {
  'use strict';
  const KEY = 'cyclist-go-community-v1';
  const seed = [
    {id:'sample-uq-path',title:'Path conditions near UQ',body:'The shared path beside the river can get busy around the afternoon commute. Please slow down near pedestrians and give people space.',category:'Safety update',author:'Cyclist Go community',created:'2026-10-10T08:00:00.000Z',sample:true,likes:[],comments:[]},
    {id:'sample-weekend-ride',title:'A quieter weekend ride idea',body:'The riverside bikeway is a pleasant option for a relaxed weekend ride. Check current signs and conditions before setting off.',category:'Route tip',author:'Cyclist Go community',created:'2026-10-09T01:30:00.000Z',sample:true,likes:[],comments:[]},
  ];
  const el = id => document.getElementById(id);
  let posts = read(), openComments = new Set(), activeFilter = '', activeSort = '', viewerLocation = null;
<<<<<<< HEAD
=======
  let previousPage = 'nav-mvp';
>>>>>>> 89e4d58b29161ea644adcd276fdfa8ab9f6326ee
  const topicWords = {
    Training: /\b(train(?:ing)?|workouts?|fitness|intervals?|hill[s]?|climb(?:s|ing)?|endurance|laps?|sprints?|exercise)\b/gi,
    Scenic: /\b(scenic|scenery|views?|riverside|river|parks?|sunsets?|relax(?:ed|ing)?|pleasant|beautiful|nature)\b/gi,
    Safe: /\b(safe(?:ty)?|hazards?|traffic|pedestrians?|busy|slow|lighting|potholes?|caution|danger(?:ous)?|protected|accidents?)\b/gi,
  };
  function relevance(post, topic) {
    const category = String(post.category || '').toLowerCase();
    const exact = category === topic.toLowerCase() || (topic === 'Safe' && category === 'safety update');
    const matches = `${post.title} ${post.body}`.match(topicWords[topic]) || [];
    return (exact ? 100 : 0) + matches.length;
  }
  function read() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return structuredClone(seed);
      const list = JSON.parse(raw);
      if (!Array.isArray(list)) throw new Error('Invalid community data');
      return list.filter(p => p && typeof p.id === 'string' && typeof p.title === 'string' && typeof p.body === 'string' && Array.isArray(p.likes) && Array.isArray(p.comments));
    } catch { return structuredClone(seed); }
  }
  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(posts)); return true; }
    catch { el('community-post-error').textContent = 'Browser storage is unavailable. Your change was not saved.'; el('community-post-error').hidden = false; return false; }
  }
  function user() { return window.DemoAuth?.currentUser() || null; }
  function requireLogin() { if (user()) return true; window.DemoAuth?.openLogin(); return false; }
  let routeOwner = null;
  function savedChoices() {
    const select = el('community-post-route');
    const account = user()?.email || null;
    const selected = routeOwner === account ? select.value : '';
    routeOwner = account;
    try {
      const list = window.SavedRoutes?.list() || [];
      select.innerHTML = '<option value="">No route attached</option>' + list.map(p => `<option value="${escapeHTML(p.id)}">${escapeHTML(routeTitle(p))} · ${escapeHTML(p.route.name)} · ${Number(p.route.km).toFixed(2)} km</option>`).join('');
      select.value = list.some(p => p.id === selected) ? selected : '';
      select.disabled = !list.length;
      el('community-route-help').textContent = list.length ? 'Choose a route to include with your post.' : 'No saved routes yet. Save a route first, then share it here.';
    } catch {
      select.innerHTML = '<option value="">No route attached</option>'; select.disabled = true;
      el('community-route-help').textContent = 'Saved routes could not be loaded.';
    }
    previewRoute();
  }
  function routeTitle(p) {
    return p.tag || 'Indooroopilly → ' + (D.destinations.find(d => d.id === p.destination)?.name || 'Saved route');
  }
  function routeCard(p, postId) {
    if (!p?.route) return '';
    return `<div class="community-route-card"><strong>${escapeHTML(routeTitle(p))}</strong><p>${escapeHTML(p.route.name)} · ${Number(p.route.km).toFixed(2)} km · ${Number(p.route.minutes)} min</p>${postId ? `<button type="button" data-community-route="${escapeHTML(postId)}">View shared route →</button>` : ''}</div>`;
  }
  function selectedRoute() {
    const id = el('community-post-route').value;
    return id ? window.SavedRoutes.list().find(p => p.id === id) : null;
  }
  function previewRoute() {
    let p; try { p = selectedRoute(); } catch {}
    el('community-route-preview').hidden = !p;
    el('community-route-preview').innerHTML = p ? routeCard(p) : '';
  }
  function locate() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) { reject(new Error('Location unavailable')); return; }
      navigator.geolocation.getCurrentPosition(p => resolve([p.coords.latitude, p.coords.longitude]), reject, {timeout:10000, maximumAge:60000});
    });
  }
  function hasLocation(p) {
    return Array.isArray(p.location) && p.location.length === 2 && p.location.every(Number.isFinite) && Math.abs(p.location[0]) <= 90 && Math.abs(p.location[1]) <= 180;
  }
  function distance(p) {
    if (!viewerLocation || !hasLocation(p)) return Infinity;
    const rad = n => n * Math.PI / 180;
    const [a,b] = viewerLocation, [c,d] = p.location;
    const h = Math.sin(rad(c-a)/2)**2 + Math.cos(rad(a))*Math.cos(rad(c))*Math.sin(rad(d-b)/2)**2;
    return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1,h)));
  }
  function comparePosts(a,b) {
    const recent = (Date.parse(b.created) || 0) - (Date.parse(a.created) || 0);
    if (activeSort === 'most popular') return b.likes.length-a.likes.length || b.comments.length-a.comments.length || recent;
    if (activeSort === 'closest') {
      const x = distance(a), y = distance(b);
      return (x === y ? 0 : x < y ? -1 : 1) || recent;
    }
    if (activeSort === 'newest') return recent;
    return (activeFilter ? relevance(b, activeFilter)-relevance(a, activeFilter) : 0) || recent;
  }
  function reactions(item, postId, commentIndex) {
    const email = user()?.email;
    const attrs = `data-reaction-post="${escapeHTML(postId)}"` + (commentIndex === undefined ? '' : ` data-reaction-comment="${commentIndex}"`);
    return ['like','dislike'].map(kind => {
      const votes = Array.isArray(item[kind + 's']) ? item[kind + 's'] : [];
      const active = !!email && votes.includes(email);
      return `<button type="button" ${attrs} data-reaction="${kind}" aria-pressed="${active}" class="community-action ${active ? 'is-' + kind + 'd' : ''}">${kind === 'like' ? '👍' : '👎'} <span>${votes.length}</span> ${kind === 'like' ? (active ? 'Liked' : 'Like') : (active ? 'Disliked' : 'Dislike')}</button>`;
    }).join('');
  }
  function render() {
    const loggedIn = !!user();
    el('community-login-prompt').hidden = loggedIn;
    el('community-post-form').hidden = !loggedIn;
    savedChoices();
    const feed = el('community-feed');
    const visiblePosts = posts.filter(p => !activeFilter || relevance(p, activeFilter) > 0)
      .sort(comparePosts);
    el('community-sort-label').textContent = activeSort ? `Sort: ${activeSort}` : 'Sort';
    document.querySelectorAll('[data-community-sort]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.communitySort === activeSort)));
    if (activeSort === 'closest' && viewerLocation) {
      el('community-sort-status').hidden = false;
      el('community-sort-status').textContent = visiblePosts.some(hasLocation) ? 'Sorted by straight-line distance from you. Posts without a location appear last.' : 'These posts have no location yet. Showing newest first.';
    }
    el('community-empty').hidden = visiblePosts.length > 0;
    el('community-empty').textContent = activeFilter ? `No ${activeFilter.toLowerCase()} posts yet. Try another filter or clear the filter.` : 'No posts yet. Be the first to share a useful update.';
    el('community-filter-label').textContent = activeFilter ? `Filter: ${activeFilter}` : 'Filter';
    el('community-filter-clear').hidden = !activeFilter;
    document.querySelectorAll('[data-community-filter]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.communityFilter === activeFilter)));
    feed.innerHTML = visiblePosts.map(p => {
      const when = Number.isFinite(Date.parse(p.created)) ? new Date(p.created).toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'}) : '';
      const comments = p.comments.map((c, index) => `<li><strong>${escapeHTML(c.author)}</strong><span>${escapeHTML(c.text)}</span><div class="community-comment-reactions">${reactions(c, p.id, index)}</div></li>`).join('');
      const isOpen = openComments.has(p.id);
      return `<article class="community-post" data-post="${escapeHTML(p.id)}"><div class="community-post-top"><span class="community-category">${escapeHTML(p.category || 'Local cycling')}</span><time>${escapeHTML(when)}</time></div><h3>${escapeHTML(p.title)}</h3><p class="community-post-body">${escapeHTML(p.body)}</p>${routeCard(p.sharedRoute, p.id)}<p class="community-post-author">Shared by ${escapeHTML(p.author || 'Cyclist')}</p><div class="community-post-actions">${reactions(p, p.id)}<button type="button" data-comments="${escapeHTML(p.id)}" aria-expanded="${isOpen}">☰ <span>${p.comments.length}</span> ${p.comments.length===1?'comment':'comments'}</button></div><section class="community-comments" ${isOpen?'':'hidden'}><ul>${comments || '<li class="community-no-comments">No comments yet.</li>'}</ul>${loggedIn?`<form data-comment-form="${escapeHTML(p.id)}" class="community-comment-form"><label class="visually-hidden" for="comment-${escapeHTML(p.id)}">Write a comment</label><input id="comment-${escapeHTML(p.id)}" name="comment" maxlength="300" required placeholder="Write a helpful comment"><button type="submit">Comment</button></form>`:'<p class="community-comment-login">Log in to leave a comment.</p>'}</section></article>`;
    }).join('');
  }
  function showPage() {
    if (state.view === 'ride') { toast('End your ride before opening Community.'); return; }
    if (el('community-page').hidden) previousPage = el('saved-page').hidden ? 'nav-mvp' : 'nav-saved';
    el('mvp-page').hidden = true; el('saved-page').hidden = true; el('community-page').hidden = false;
    el('nav-mvp').setAttribute('aria-current','false'); el('nav-saved').setAttribute('aria-current','false'); el('nav-community').setAttribute('aria-current','page');
    render(); el('community-title').focus();
  }
  function hidePage() {
    el('community-page').hidden = true;
    el('nav-community').setAttribute('aria-current','false');
  }
  el('community-post-route').addEventListener('change', previewRoute);
  document.addEventListener('cyclist:share-route', event => {
    if (!requireLogin() || state.view === 'ride') return;
    showPage();
    el('community-post-route').value = event.detail.id;
    previewRoute();
    el('community-post-title').focus();
    el('community-post-form').scrollIntoView({behavior:'smooth', block:'start'});
  });
  el('community-sort').addEventListener('click', async event => {
    const button = event.target.closest('[data-community-sort]');
    if (!button) return;
    activeSort = button.dataset.communitySort;
    el('community-sort').open = false;
    el('community-sort-status').hidden = activeSort !== 'closest';
    render();
    el('community-sort-label').focus();
    if (activeSort === 'closest' && !viewerLocation) {
      el('community-sort-status').textContent = 'Getting your location…';
      try { viewerLocation = await locate(); if (activeSort === 'closest') render(); }
      catch { if (activeSort === 'closest') el('community-sort-status').textContent = 'Location unavailable. Allow location access and select closest again. Showing newest first.'; }
    }
  });
  el('community-sort').addEventListener('keydown', event => {
    if (event.key === 'Escape') { el('community-sort').open = false; el('community-sort-label').focus(); }
  });
  el('community-sort').addEventListener('toggle', () => { if (el('community-sort').open) el('community-filter').open = false; });
  el('community-filter').addEventListener('toggle', () => { if (el('community-filter').open) el('community-sort').open = false; });
  el('community-filter').addEventListener('click', event => {
    const button = event.target.closest('[data-community-filter], #community-filter-clear');
    if (!button) return;
    activeFilter = button.dataset.communityFilter || '';
    el('community-filter').open = false;
    render();
    el('community-filter-label').focus();
  });
  document.addEventListener('click', event => {
    if (!el('community-sort').contains(event.target)) el('community-sort').open = false;
    if (!el('community-filter').contains(event.target)) el('community-filter').open = false;
  });
  el('community-filter').addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      el('community-filter').open = false;
      el('community-filter-label').focus();
    }
  });
<<<<<<< HEAD
=======
  el('community-back').addEventListener('click', () => {
    el(previousPage).click();
    el(previousPage).focus();
  });
>>>>>>> 89e4d58b29161ea644adcd276fdfa8ab9f6326ee
  el('nav-community').addEventListener('click', showPage);
  el('nav-mvp').addEventListener('click', hidePage);
  el('nav-saved').addEventListener('click', hidePage);
  el('community-login').addEventListener('click', () => window.DemoAuth?.openLogin());
  document.addEventListener('cyclist:account', render);
  document.addEventListener('cyclist:login', render);
  document.addEventListener('cyclist:authclosed', render);
  el('community-feed').addEventListener('click', event => {
    const routeButton = event.target.closest('[data-community-route]');
    if (routeButton) {
      const post = posts.find(p => p.id === routeButton.dataset.communityRoute);
      try { if (post?.sharedRoute) window.SavedRoutes.open(post.sharedRoute); }
      catch { toast('This shared route could not be opened.'); }
      return;
    }
    const reaction = event.target.closest('[data-reaction]'), toggle = event.target.closest('[data-comments]');
    if (reaction) {
      if (!requireLogin()) return;
      const post = posts.find(p => p.id === reaction.dataset.reactionPost);
      if (!post) return;
      const index = reaction.dataset.reactionComment;
      const item = index === undefined ? post : post.comments[Number(index)];
      const kind = reaction.dataset.reaction;
      if (!item || !['like','dislike'].includes(kind)) return;
      const email = user().email, selected = kind + 's', opposite = kind === 'like' ? 'dislikes' : 'likes';
      const beforeLikes = item.likes, beforeDislikes = item.dislikes;
      const votes = Array.isArray(item[selected]) ? item[selected] : [];
      item[selected] = votes.includes(email) ? votes.filter(x => x !== email) : [...votes,email];
      item[opposite] = (Array.isArray(item[opposite]) ? item[opposite] : []).filter(x => x !== email);
      // Keep unfinished comments when the feed is redrawn.
      const drafts = [...el('community-feed').querySelectorAll('[data-comment-form]')].map(form => [form.dataset.commentForm, form.querySelector('input').value]);
      if (persist()) {
        render();
        el('community-feed').querySelectorAll('[data-comment-form]').forEach(form => {
          form.querySelector('input').value = drafts.find(d => d[0] === form.dataset.commentForm)?.[1] || '';
        });
      } else { item.likes = beforeLikes; item.dislikes = beforeDislikes; }
    } else if (toggle) {
      const id = toggle.dataset.comments; openComments.has(id) ? openComments.delete(id) : openComments.add(id); render();
    }
  });
  el('community-feed').addEventListener('submit', event => {
    const form = event.target.closest('[data-comment-form]'); if (!form) return;
    event.preventDefault(); if (!requireLogin()) return;
    const text = new FormData(form).get('comment')?.trim(); if (!text) return;
    const post = posts.find(p => p.id === form.dataset.commentForm); if (!post) return;
    post.comments.push({likes:[],dislikes:[],author:user().name,text,created:new Date().toISOString()}); openComments.add(post.id);
    if (persist()) render();
  });
  el('community-post-form').addEventListener('submit', async event => {
    event.preventDefault();
    if (!requireLogin() || !event.currentTarget.reportValidity()) return;
    const title = el('community-post-title').value.trim(), body = el('community-post-body').value.trim();
    if (!title || !body) return;
    el('community-post-error').hidden = true;
<<<<<<< HEAD
=======
    el('community-post-success').hidden = true;
>>>>>>> 89e4d58b29161ea644adcd276fdfa8ab9f6326ee
    let sharedRoute = null;
    try {
      const selected = selectedRoute();
      if (el('community-post-route').value && !selected) throw new Error('Missing route');
      if (selected) sharedRoute = JSON.parse(JSON.stringify(selected));
    } catch {
      el('community-post-error').textContent = 'That saved route is no longer available. Please choose another route.';
      el('community-post-error').hidden = false; return;
    }
    const form = event.currentTarget;
    const submit = form.querySelector('[type="submit"]');
    const author = user().name, email = user().email, category = el('community-post-category').value;
    let location = null;
    if (el('community-post-location').checked) {
      submit.disabled = true;
      try { location = await locate(); }
      catch {
        el('community-post-error').textContent = 'Could not get your location. Allow location access, or uncheck Attach my current location to publish without it.';
        el('community-post-error').hidden = false;
        return;
      } finally { submit.disabled = false; }
      if (!user() || user().email !== email) return;
    }
    posts.push({sharedRoute,location,id:`post-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,title,body,category,author,created:new Date().toISOString(),sample:false,likes:[],dislikes:[],comments:[]});
<<<<<<< HEAD
    if (persist()) { form.reset(); activeFilter = ''; activeSort = 'newest'; el('community-sort-status').hidden = true; render(); el('community-feed').scrollIntoView({behavior:'smooth', block:'start'}); }
=======
    if (persist()) {
      form.reset(); activeFilter = ''; activeSort = 'newest'; el('community-sort-status').hidden = true; render();
      el('community-post-success').textContent = 'Post published successfully.';
      el('community-post-success').hidden = false;
      el('community-post-success').scrollIntoView({behavior:'smooth', block:'start'});
    }
>>>>>>> 89e4d58b29161ea644adcd276fdfa8ab9f6326ee
  });
  render();
})();
