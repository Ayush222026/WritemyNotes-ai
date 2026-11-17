(function () {
  'use strict';
  const SUPABASE_URL = 'https://ecykvbuepzvlvjqgfbpo.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_8XgPlRoWwwHK2ridhOQwZQ_T6DjsHhS';
  const ADMIN_EMAIL = 'ayush222009@proton.me';

  if (!window.supabase || !window.supabase.createClient) {
    console.error('Supabase library load nahi hui');
    return;
  }
  const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  function mk(tag, cls, txt) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt !== undefined) e.textContent = txt;
    return e;
  }
  function btn(label, fn, cls) {
    const b = mk('button', cls || 'btn', label);
    b.type = 'button';
    b.addEventListener('click', fn);
    return b;
  }

  /* ---------- App ko shuru mein chhupa do ---------- */
  const appEl = document.querySelector('.app');
  if (appEl) appEl.style.display = 'none';

  /* ---------- Gate screen (login se pehle poori screen) ---------- */
  const gate = mk('div', 'auth-gate');
  const gbox = mk('div', 'auth-gate-box');

  const loadingView = mk('div', 'auth-loading');
  loadingView.appendChild(mk('div', 'pdf-spin'));
  loadingView.appendChild(mk('p', 'muted', 'Check ho raha hai...'));

  const loginView = mk('div', 'auth-login-view');
  loginView.appendChild(mk('div', 'auth-logo', '✍️'));
  loginView.appendChild(mk('h2', '', 'WriteMyNotes AI'));
  loginView.appendChild(mk('p', 'muted', 'Apna email daalo. Usme ek login link aayega, usi se sign in ho jaoge. Koi password nahi chahiye.'));
  const emailIn = document.createElement('input');
  emailIn.type = 'email';
  emailIn.placeholder = 'tumhara@email.com';
  emailIn.className = 'ask-in';
  emailIn.autocomplete = 'email';
  loginView.appendChild(emailIn);
  const msgEl = mk('p', 'muted small', '');
  loginView.appendChild(msgEl);
  const sendB = btn('📧 Login link bhejo', sendLink, 'btn-main');
  sendB.style.width = '100%';
  loginView.appendChild(sendB);

  const sentView = mk('div', 'auth-login-view');
  sentView.style.display = 'none';
  sentView.appendChild(mk('div', 'auth-logo', '📧'));
  sentView.appendChild(mk('h2', '', 'Email check karo'));
  const sentMsg = mk('p', 'muted', '');
  sentView.appendChild(sentMsg);
  sentView.appendChild(mk('p', 'muted small', 'Spam / Promotions folder bhi dekh lena.'));
  const backB = btn('↩️ Dusra email try karo', () => showStep('login'));
  backB.style.width = '100%';
  sentView.appendChild(backB);

  gbox.appendChild(loadingView);
  gbox.appendChild(loginView);
  gbox.appendChild(sentView);
  gate.appendChild(gbox);
  document.body.appendChild(gate);

  function showStep(name) {
    loadingView.style.display = name === 'loading' ? 'block' : 'none';
    loginView.style.display = name === 'login' ? 'block' : 'none';
    sentView.style.display = name === 'sent' ? 'block' : 'none';
    if (name === 'login') { msgEl.textContent = ''; setTimeout(() => emailIn.focus(), 60); }
  }
  showStep('loading');

  async function sendLink() {
    const email = emailIn.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { msgEl.textContent = 'Sahi email likho.'; return; }
    sendB.disabled = true;
    sendB.textContent = 'Bhej raha hoon...';
    msgEl.textContent = '';
    try {
      const { error } = await sb.auth.signInWithOtp({
        email: email,
        options: { emailRedirectTo: location.origin + location.pathname }
      });
      if (error) throw error;
      sentMsg.textContent = '"' + email + '" par login link bhej diya hai.';
      showStep('sent');
      toast('Login link email par bhej diya gaya', 'success');
    } catch (e) {
      console.error(e);
      msgEl.textContent = 'Error: ' + (e && e.message ? e.message : 'bhej nahi paaye');
    }
    sendB.disabled = false;
    sendB.textContent = '📧 Login link bhejo';
  }
  emailIn.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); sendLink(); } });

  /* ---------- Topbar mein chip (naam, admin badge, logout) ---------- */
  const topbar = document.querySelector('.topbar');
  const slot = mk('div');
  slot.id = 'authSlot';
  slot.style.cssText = 'display:flex;align-items:center;gap:8px;margin-left:auto';
  if (topbar) {
    const themeBtn = document.getElementById('themeBtn');
    topbar.insertBefore(slot, themeBtn);
  }

  async function setName(user) {
    const n = prompt('Apna naam likho:');
    if (n === null) return;
    const name = n.trim().slice(0, 60);
    if (!name) return;
    try {
      await sb.from('profiles').upsert({ id: user.id, email: user.email, name: name }, { onConflict: 'id' });
      toast('Naam save ho gaya', 'success');
      paintChip(user, name);
    } catch (e) {
      console.error(e);
      toast('Naam save nahi ho paya', 'error');
    }
  }

  function paintChip(user, name) {
    if (!slot) return;
    slot.textContent = '';
    const chip = mk('div', 'auth-chip');
    chip.appendChild(mk('span', '', name || user.email));
    if (user.email === ADMIN_EMAIL) chip.appendChild(mk('span', 'sm-ok', 'Admin'));
    chip.appendChild(btn('Naam', () => setName(user)));
    chip.appendChild(btn('Logout', async () => { await sb.auth.signOut(); }));
    slot.appendChild(chip);
  }

  async function touchProfile(user) {
    try {
      await sb.from('profiles').upsert({ id: user.id, email: user.email, last_login: new Date().toISOString() }, { onConflict: 'id' });
    } catch (e) { console.error(e); }
  }
  async function getName(user) {
    try {
      const { data } = await sb.from('profiles').select('name').eq('id', user.id).single();
      return (data && data.name) || '';
    } catch (e) { return ''; }
  }

  /* ---------- Login/Logout par app ko dikhana/chhupana ---------- */
  function showApp(user, name) {
    gate.style.display = 'none';
    if (appEl) appEl.style.display = '';
    paintChip(user, name);
  }
  function showGate() {
    if (appEl) appEl.style.display = 'none';
    gate.style.display = 'flex';
    showStep('login');
  }

  let last = null;
  sb.auth.onAuthStateChange(async (event, session) => {
    const user = session && session.user;
    if (user) {
      if (!last || last.id !== user.id) await touchProfile(user);
      last = user;
      const name = await getName(user);
      showApp(user, name);
      if (event === 'SIGNED_IN') toast('Login ho gaye ✓', 'success');
    } else {
      last = null;
      showGate();
    }
  });

  (async function start() {
    const { data } = await sb.auth.getSession();
    const user = data && data.session && data.session.user;
    if (user) {
      last = user;
      await touchProfile(user);
      const name = await getName(user);
      showApp(user, name);
    } else {
      showGate();
    }
  })();

  window.WMN = window.WMN || {};
  window.WMN.auth = { client: sb, isAdmin: user => !!user && user.email === ADMIN_EMAIL };
})();
