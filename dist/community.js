/* Community demo: browser-local posts and interactions; no server or database. */
(() => {
  'use strict';
  const KEY = 'cyclist-go-community-v1';
  const seed = [
    {id:'sample-uq-path',title:'Path conditions near UQ',body:'The shared path beside the river can get busy around the afternoon commute. Please slow down near pedestrians and give people space.',category:'Safety update',author:'Cyclist Go community',created:'2026-10-10T08:00:00.000Z',sample:true,likes:[],comments:[]},
    {id:'sample-weekend-ride',title:'A quieter weekend ride idea',body:'The riverside bikeway is a pleasant option for a relaxed weekend ride. Check current signs and conditions before setting off.',category:'Route tip',author:'Cyclist Go community',created:'2026-10-09T01:30:00.000Z',sample:true,likes:[],comments:[]},
  ];
  const el = id => document.getElementById(id);
  let posts = read(), openComments = new Set();
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
  function render() {
    const loggedIn = !!user();
    el('community-login-prompt').hidden = loggedIn;
    el('community-post-form').hidden = !loggedIn;
    const feed = el('community-feed');
    el('community-count').textContent = `${posts.length} ${posts.length === 1 ? 'post' : 'posts'}`;
    el('community-empty').hidden = posts.length > 0;
    feed.innerHTML = [...posts].sort((a,b) => Date.parse(b.created)-Date.parse(a.created)).map(p => {
      const liked = loggedIn && p.likes.includes(user().email);
      const when = Number.isFinite(Date.parse(p.created)) ? new Date(p.created).toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'}) : '';
      const comments = p.comments.map(c => `<li><strong>${escapeHTML(c.author)}</strong><span>${escapeHTML(c.text)}</span></li>`).join('');
      const isOpen = openComments.has(p.id);
      return `<article class="community-post" data-post="${escapeHTML(p.id)}"><div class="community-post-top"><span class="community-category">${escapeHTML(p.category || 'Local cycling')}</span><time>${escapeHTML(when)}</time></div><h3>${escapeHTML(p.title)}</h3><p class="community-post-body">${escapeHTML(p.body)}</p><p class="community-post-author">Shared by ${escapeHTML(p.author || 'Cyclist')}</p><div class="community-post-actions"><button type="button" data-like="${escapeHTML(p.id)}" aria-pressed="${liked}" class="community-action ${liked?'is-liked':''}">♥ <span>${p.likes.length}</span> ${liked?'Liked':'Like'}</button><button type="button" data-comments="${escapeHTML(p.id)}" aria-expanded="${isOpen}">☰ <span>${p.comments.length}</span> ${p.comments.length===1?'comment':'comments'}</button></div><section class="community-comments" ${isOpen?'':'hidden'}><ul>${comments || '<li class="community-no-comments">No comments yet.</li>'}</ul>${loggedIn?`<form data-comment-form="${escapeHTML(p.id)}" class="community-comment-form"><label class="visually-hidden" for="comment-${escapeHTML(p.id)}">Write a comment</label><input id="comment-${escapeHTML(p.id)}" name="comment" maxlength="300" required placeholder="Write a helpful comment"><button type="submit">Comment</button></form>`:'<p class="community-comment-login">Log in to leave a comment.</p>'}</section></article>`;
    }).join('');
  }
  function showPage() {
    if (state.view === 'ride') { toast('End your ride before opening Community.'); return; }
    el('mvp-page').hidden = true; el('saved-page').hidden = true; el('community-page').hidden = false;
    el('nav-mvp').setAttribute('aria-current','false'); el('nav-saved').setAttribute('aria-current','false'); el('nav-community').setAttribute('aria-current','page');
    render(); el('community-title').focus();
  }
  function hidePage() {
    el('community-page').hidden = true;
    el('nav-community').setAttribute('aria-current','false');
  }
  el('nav-community').addEventListener('click', showPage);
  el('nav-mvp').addEventListener('click', hidePage);
  el('nav-saved').addEventListener('click', hidePage);
  el('community-login').addEventListener('click', () => window.DemoAuth?.openLogin());
  document.addEventListener('cyclist:account', render);
  document.addEventListener('cyclist:login', render);
  document.addEventListener('cyclist:authclosed', render);
  el('community-feed').addEventListener('click', event => {
    const like = event.target.closest('[data-like]'), toggle = event.target.closest('[data-comments]');
    if (like) {
      if (!requireLogin()) return;
      const post = posts.find(p => p.id === like.dataset.like); if (!post) return;
      const email = user().email; post.likes = post.likes.includes(email) ? post.likes.filter(x => x !== email) : [...post.likes,email];
      if (persist()) render();
    } else if (toggle) {
      const id = toggle.dataset.comments; openComments.has(id) ? openComments.delete(id) : openComments.add(id); render();
    }
  });
  el('community-feed').addEventListener('submit', event => {
    const form = event.target.closest('[data-comment-form]'); if (!form) return;
    event.preventDefault(); if (!requireLogin()) return;
    const text = new FormData(form).get('comment')?.trim(); if (!text) return;
    const post = posts.find(p => p.id === form.dataset.commentForm); if (!post) return;
    post.comments.push({author:user().name,text,created:new Date().toISOString()}); openComments.add(post.id);
    if (persist()) render();
  });
  el('community-post-form').addEventListener('submit', event => {
    event.preventDefault();
    if (!requireLogin() || !event.currentTarget.reportValidity()) return;
    const title = el('community-post-title').value.trim(), body = el('community-post-body').value.trim();
    if (!title || !body) return;
    el('community-post-error').hidden = true;
    posts.push({id:`post-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,title,body,category:el('community-post-category').value,author:user().name,created:new Date().toISOString(),sample:false,likes:[],comments:[]});
    if (persist()) { event.currentTarget.reset(); render(); }
  });
  render();
})();
