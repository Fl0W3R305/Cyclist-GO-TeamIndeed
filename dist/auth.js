/* Classroom demo accounts only: local browser storage; route saving requires a demo account. */
(() => {
  const USERS = 'cyclist-go-demo-accounts-v1';
  // Each fresh page load starts logged out for repeated demonstrations.
  let activeEmail = null;
  const el = id => document.getElementById(id);
  let register = false, busy = false;
  function accounts() {
    const value = JSON.parse(localStorage.getItem(USERS) || '[]');
    if (!Array.isArray(value)) throw new Error('Saved accounts could not be read.');
    return value;
  }
  function currentUser() {
    try { return accounts().find(u => u.email === activeEmail); } catch { return null; }
  }
  function update() {
    const user = currentUser();
    el('demo-account-button').textContent = user ? user.name : 'Log in';
    el('demo-account-name').textContent = user?.name || '';
    el('demo-account-email').textContent = user?.email || '';
    document.dispatchEvent(new Event('cyclist:account'));
  }
  function mode(value) {
    register = value;
    el('demo-auth-form').reset();
    el('demo-auth-error').hidden = true;
    el('demo-name-field').hidden = !register;
    el('demo-confirm-field').hidden = !register;
    el('demo-name').required = register;
    el('demo-confirm').required = register;
    el('demo-password').type = 'password';
    el('demo-show-password').textContent = 'Show';
    el('demo-password').minLength = register ? 8 : 1;
    el('demo-password').autocomplete = register ? 'new-password' : 'current-password';
    el('demo-auth-title').textContent = register ? 'Create your account' : 'Welcome back';
    el('demo-auth-submit').textContent = register ? 'Create account →' : 'Log in →';
    el('demo-auth-switch').textContent = register ? 'Already have an account? Log in' : 'New here? Create an account';
  }
  async function hash(password, salt) {
    if (!crypto.subtle) throw new Error('Please open this demo using HTTPS or localhost (VS Code Live Server) to create or log in to an account.');
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({name:'PBKDF2',salt:Uint8Array.from(salt),iterations:100000,hash:'SHA-256'},key,256);
    return Array.from(new Uint8Array(bits), b => b.toString(16).padStart(2,'0')).join('');
  }
  window.DemoAuth = { currentUser, openLogin() { mode(false); el('demo-auth-dialog').showModal(); } };
  el('demo-account-button').addEventListener('click', () => {
    update();
    if (currentUser()) el('demo-account-dialog').showModal();
    else { mode(false); el('demo-auth-dialog').showModal(); }
  });
  el('demo-auth-switch').addEventListener('click', () => { if (!busy) mode(!register); });
  document.querySelectorAll('[data-demo-close]').forEach(button => button.addEventListener('click', () => el(button.dataset.demoClose).close()));
  el('demo-show-password').addEventListener('click', () => {
    const show = el('demo-password').type === 'password';
    el('demo-password').type = show ? 'text' : 'password';
    el('demo-show-password').textContent = show ? 'Hide' : 'Show';
  });
  el('demo-auth-form').addEventListener('submit', async event => {
    event.preventDefault();
    if (busy || !el('demo-auth-form').reportValidity()) return;
    busy = true; el('demo-auth-submit').disabled = true; el('demo-auth-switch').disabled = true;
    el('demo-auth-error').hidden = true;
    try {
      const email = el('demo-email').value.trim().toLowerCase(), password = el('demo-password').value;
      const users = accounts(); let user;
      if (register) {
        const name = el('demo-name').value.trim();
        if (name.length < 2) throw new Error('Please enter a username with at least 2 characters.');
        if (password !== el('demo-confirm').value) throw new Error('The passwords do not match.');
        if (users.some(u => u.email === email)) throw new Error('This email already has an account. Please log in.');
        const salt = Array.from(crypto.getRandomValues(new Uint8Array(16)));
        user = {name,email,salt,hash:await hash(password,salt)};
        // Recheck after hashing in case another tab registered the same address.
        const latest = accounts();
        if (latest.some(u => u.email === email)) throw new Error('This email already has an account. Please log in.');
        localStorage.setItem(USERS,JSON.stringify([...latest,user]));
      } else {
        user = users.find(u => u.email === email);
        if (!user || await hash(password,user.salt) !== user.hash) throw new Error('Email or password is incorrect.');
      }
      activeEmail = user.email;
      el('demo-auth-form').reset(); el('demo-auth-dialog').close(); update();
      if (typeof toast === 'function') toast('Welcome, '+user.name+'.');
      document.dispatchEvent(new Event('cyclist:login'));
    } catch (error) {
      el('demo-auth-error').textContent = error.name === 'QuotaExceededError' || error.name === 'SecurityError' ? 'Browser storage is unavailable. Allow local storage and try again.' : error.message;
      el('demo-auth-error').hidden = false;
    } finally { busy = false; el('demo-auth-submit').disabled = false; el('demo-auth-switch').disabled = false; }
  });
  el('demo-logout').addEventListener('click', () => {
    try { activeEmail = null; update(); el('demo-account-dialog').close(); }
    catch { el('demo-account-email').textContent = 'Could not log out. Browser storage is unavailable.'; }
  });
  el('demo-auth-dialog').addEventListener('close', () => { if (!busy) el('demo-auth-form').reset(); document.dispatchEvent(new Event('cyclist:authclosed')); });
  window.addEventListener('storage', update);
  update();
})();
