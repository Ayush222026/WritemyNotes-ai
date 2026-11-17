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

  /* ---------- Style ---------- */
  const sty = document.createElement('style');
  sty.textContent =
    '.auth-chip{display:flex;align-items:center;gap:8px;border:1px solid var(--border);background:var(--card);' +
    'border-radius:20px;padding:6px 6px 6px 12px;font-size:12px;font-weight:600;cursor:default;white-space:nowrap}' +
    '.auth-chip button{border:none;background:var(--bg);color:var(--text);border-radius:14px;padding:6px 10px;' +
    'font:inherit;font-size:11px;cursor:pointer}' +
    '#authLoginBtn{border:1px solid var(--border);background:var(--grad);color:#fff;border-radius:20px;' +
    'padding:9px 16px;font:inherit;font-weight:600;font-size:13px;cursor:pointer;white-space:nowrap}';
  document.head.appendChild(sty);

  /* ---------- Topbar mein jagah banao ---------- */
  const topbar = document.querySelector('.topbar');
  const slot = mk('div');
  slot.id = 'authSlot';
  slot.style.cssText = 'display:flex;align-items:center;gap:8px;margin-left:auto';
  if (topbar) {
    const themeBtn = document.getElementById('themeBtn');
    topbar.insertBefore(slot, themeBtn);
  }

  /* ---------- Login modal (email box) ---------- */
  const ov = mk('div', 'pdf-ov');
  ov.id = 'authOv';
  const bx = mk('div', 'pdf-box');
  bx.appendChild(mk('h3', '', '🔑 Login / Signup'));
  bx.appendChild(mk('p', 'muted small', 'Apna email daalo. Usme ek login link aayega, usi se sign in ho jaoge. Koi password nahi chahiye.'));
  const emailIn = document.createElement('input');
  emailIn.type = 'email';
  emailIn.placeholder = 'tumhara@email.com';
  emailIn.className = 'ask-in';
  emailIn.autocomplete = 'email';
  bx.appendChild(emailIn);
  const msgEl = mk('p', 'muted small', '');
  bx.appendChild(msgEl);
  const btns = mk('div', 'ask-btns');
  const sendB = btn('📧 Link bhejo', sendLink, 'btn-main');
  const closeB = btn('Band karo', () => ov.classList.remove('show'));
  btns.appendChild(sendB);
  btns.appendChild(closeB);
  bx.appendChild(btns);
  ov.appendChild(bx);
  document.body.appendChild(ov);

  function openModal() {
    emailIn.value = '';
    msgEl.textContent = '';
    sendB.disabled = false;
    sendB.textContent = '📧 Link bhejo';
    ov.classList.add('show');
    setTimeout(() => emailIn.focus(), 60);
  }

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
      msgEl.textContent = '✓ Link bhej diya. Apna email (aur Spam folder) check karo.';
      sendB.textContent = '✓ Bhej diya';
      toast('Login link email par bhej diya gaya', 'success');
    } catch (e) {
      console.error(e);
      msgEl.textContent = 'Error: ' + (e && e.message ? e.message : 'bhej nahi paaye');
      sendB.disabled = false;
      sendB.textContent = '📧 Link bhejo';
    }
  }

  emailIn.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); sendLink(); } });

  /* ---------- Profile row banao / update karo ---------- */
  async function touchProfile(user) {
    try {
      await sb.from('profiles').upsert({
        id: user.id,
        email: user.email,
        last_login: new Date().toISOString()
      }, { onConflict: 'id' });
    } catch (e) {
      console.error(e);
    }
  }

  /* ---------- Naam set/badal karo ---------- */
  async function setName(user) {
    const n = prompt('Apna naam likho:');
    if (n === null) return;
    const name = n.trim().slice(0, 60);
    if (!name) return;
    try {
      await sb.from('profiles').upsert({ id: user.id, email: user.email, name: name }, { onConflict: 'id' });
      toast('Naam save ho gaya', 'success');
      paint(user, name);
    } catch (e) {
      console.error(e);
      toast('Naam save nahi ho paya', 'error');
    }
  }

  /* ---------- UI paint ---------- */
  async function getName(user) {
    try {
      const { data } = await sb.from('profiles').select('name').eq('id', user.id).single();
      return (data && data.name) || '';
    } catch (e) { return ''; }
  }

  function paint(user, name) {
    if (!slot) return;
    slot.textContent = '';
    if (!user) {
      slot.appendChild(btn('🔑 Login / Signup', openModal));
      return;
    }
    const chip = mk('div', 'auth-chip');
    const label = mk('span', '', (name || user.email));
    chip.appendChild(label);
    if (user.email === ADMIN_EMAIL) chip.appendChild(mk('span', 'sm-ok', 'Admin'));
    chip.appendChild(btn('Naam', () => setName(user)));
    chip.appendChild(btn('Logout', async () => {
      await sb.auth.signOut();
      toast('Logout ho gaye', 'success');
    }));
    slot.appendChild(chip);
  }

  /* ---------- Session ---------- */
  let last = null;
  sb.auth.onAuthStateChange(async (event, session) => {
    const user = session && session.user;
    if (user && (!last || last.id !== user.id)) {
      await touchProfile(user);
    }
    last = user || null;
    if (user) {
      const name = await getName(user);
      paint(user, name);
      if (event === 'SIGNED_IN') { ov.classList.remove('show'); toast('Login ho gaye ✓', 'success'); }
    } else {
      paint(null);
    }
  });

  (async function start() {
    const { data } = await sb.auth.getSession();
    const user = data && data.session && data.session.user;
    if (user) {
      last = user;
      await touchProfile(user);
      const name = await getName(user);
      paint(user, name);
    } else {
      paint(null);
    }
  })();

  window.WMN = window.WMN || {};
  window.WMN.auth = { client: sb, isAdmin: user => !!user && user.email === ADMIN_EMAIL };
})();
