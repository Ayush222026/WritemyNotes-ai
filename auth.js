(function () {
  'use strict';
  const SUPABASE_URL = 'https://ecykvbuepzvlvjqgfbpo.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_8XgPlRoWwwHK2ridhOQwZQ_T6DjsHhS';
  const ADMIN_EMAIL = 'ayush222009@proton.me';

  if (!window.supabase || !window.supabase.createClient) {
    console.error('Supabase library not loaded');
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
  function field(type, placeholder, auto) {
    const i = document.createElement('input');
    i.type = type;
    i.placeholder = placeholder;
    i.className = 'auth-in';
    i.autocomplete = auto || 'off';
    return i;
  }

  /* ---------- Hide the app until logged in ---------- */
  const appEl = document.querySelector('.app');
  if (appEl) appEl.style.display = 'none';

  /* ---------- Gate screen ---------- */
  const gate = mk('div', 'auth-gate');
  gate.innerHTML =
    '<div class="auth-blob b1"></div><div class="auth-blob b2"></div>';
  const gbox = mk('div', 'auth-gate-box');
  gate.appendChild(gbox);

  const brand = mk('div', 'auth-brand');
  brand.innerHTML = '<span class="auth-logo">✍️</span><span>WriteMyNotes <b>AI</b></span>';
  gbox.appendChild(brand);
  gbox.appendChild(mk('p', 'auth-tagline', 'Turn your text into beautiful handwritten notes.'));

  /* Loading */
  const loadingView = mk('div', 'auth-step');
  loadingView.appendChild(mk('div', 'pdf-spin'));
  loadingView.appendChild(mk('p', 'muted', 'Checking your session...'));

  /* Tabs */
  const tabs = mk('div', 'auth-tabs');
  const tabLogin = btn('Log In', () => showStep('login'), 'auth-tab active');
  const tabSignup = btn('Sign Up', () => showStep('signup'), 'auth-tab');
  tabs.appendChild(tabLogin);
  tabs.appendChild(tabSignup);

  function pwToggle(input) {
    const wrap = mk('div', 'auth-pw-wrap');
    const eye = btn('👁️', () => {
      input.type = input.type === 'password' ? 'text' : 'password';
      eye.textContent = input.type === 'password' ? '👁️' : '🙈';
    }, 'auth-eye');
    wrap.appendChild(input);
    wrap.appendChild(eye);
    return wrap;
  }

  /* ---- Login form ---- */
  const loginView = mk('div', 'auth-step');
  loginView.appendChild(tabs.cloneNode(true));
  const loginForm = mk('div', 'auth-form');
  const liEmail = field('email', 'Email address', 'email');
  const liPass = field('password', 'Password', 'current-password');
  const liMsg = mk('p', 'auth-msg', '');
  const liBtn = btn('Log In', () => doLogin(), 'btn-main auth-submit');
  const liForgot = btn('Forgot password?', () => showStep('forgot'), 'auth-link');
  loginForm.appendChild(liEmail);
  loginForm.appendChild(pwToggle(liPass));
  loginForm.appendChild(liMsg);
  loginForm.appendChild(liBtn);
  loginForm.appendChild(liForgot);
  loginView.appendChild(loginForm);

  /* ---- Signup form ---- */
  const signupView = mk('div', 'auth-step');
  signupView.appendChild(tabs.cloneNode(true));
  const signupForm = mk('div', 'auth-form');
  const suName = field('text', 'Your name');
  const suEmail = field('email', 'Email address', 'email');
  const suPass = field('password', 'Password (min 6 characters)', 'new-password');
  const suMsg = mk('p', 'auth-msg', '');
  const suBtn = btn('Create Account', () => doSignup(), 'btn-main auth-submit');
  signupForm.appendChild(suName);
  signupForm.appendChild(suEmail);
  signupForm.appendChild(pwToggle(suPass));
  signupForm.appendChild(suMsg);
  signupForm.appendChild(suBtn);
  signupView.appendChild(signupForm);

  /* ---- Forgot password ---- */
  const forgotView = mk('div', 'auth-step');
  forgotView.appendChild(mk('div', 'auth-logo', '🔑'));
  forgotView.appendChild(mk('h2', '', 'Reset your password'));
  forgotView.appendChild(mk('p', 'muted', 'Enter your email and we\u2019ll send you a reset link.'));
  const fgEmail = field('email', 'Email address', 'email');
  const fgMsg = mk('p', 'auth-msg', '');
  const fgBtn = btn('Send Reset Link', () => doForgot(), 'btn-main auth-submit');
  const fgBack = btn('\u21a9 Back to Log In', () => showStep('login'), 'auth-link');
  forgotView.appendChild(fgEmail);
  forgotView.appendChild(fgMsg);
  forgotView.appendChild(fgBtn);
  forgotView.appendChild(fgBack);

  /* ---- Check your email (after signup) ---- */
  const checkView = mk('div', 'auth-step');
  checkView.appendChild(mk('div', 'auth-logo', '📧'));
  checkView.appendChild(mk('h2', '', 'Check your inbox'));
  const checkMsg = mk('p', 'muted', '');
  checkView.appendChild(checkMsg);
  checkView.appendChild(mk('p', 'muted small', 'Check your Spam or Promotions folder too.'));
  checkView.appendChild(btn('\u21a9 Back to Log In', () => showStep('login'), 'auth-link'));

  [loadingView, loginView, signupView, forgotView, checkView].forEach(v => gbox.appendChild(v));

  function clearMsgs() { liMsg.textContent = ''; suMsg.textContent = ''; fgMsg.textContent = ''; }
  function showStep(name) {
    clearMsgs();
    [['loading', loadingView], ['login', loginView], ['signup', signupView], ['forgot', forgotView], ['check', checkView]]
      .forEach(([n, v]) => { v.style.display = n === name ? 'block' : 'none'; });
    if (name === 'login') setTimeout(() => liEmail.focus(), 60);
    if (name === 'signup') setTimeout(() => suName.focus(), 60);
  }
  gbox.querySelectorAll('.auth-tabs').forEach(() => {});
  loginView.querySelector('.auth-tabs .auth-tab:nth-child(1)').classList.add('active');
  [loginView, signupView].forEach(view => {
    const t1 = view.querySelector('.auth-tabs .auth-tab:nth-child(1)');
    const t2 = view.querySelector('.auth-tabs .auth-tab:nth-child(2)');
    t1.addEventListener('click', () => showStep('login'));
    t2.addEventListener('click', () => showStep('signup'));
  });
  showStep('loading');
  document.body.appendChild(gate);

  function setBusy(b, label) { b.disabled = true; b._old = b.textContent; b.textContent = label; }
  function clearBusy(b) { b.disabled = false; if (b._old) b.textContent = b._old; }

  async function doLogin() {
    const email = liEmail.value.trim();
    const pass = liPass.value;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { liMsg.textContent = 'Enter a valid email.'; return; }
    if (!pass) { liMsg.textContent = 'Enter your password.'; return; }
    setBusy(liBtn, 'Logging in...');
    liMsg.textContent = '';
    try {
      const { error } = await sb.auth.signInWithPassword({ email: email, password: pass });
      if (error) throw error;
    } catch (e) {
      liMsg.textContent = (e && e.message === 'Invalid login credentials')
        ? 'Wrong email or password.'
        : 'Error: ' + (e && e.message ? e.message : 'could not log in');
    }
    clearBusy(liBtn);
  }

  async function doSignup() {
    const name = suName.value.trim().slice(0, 60);
    const email = suEmail.value.trim();
    const pass = suPass.value;
    if (!name) { suMsg.textContent = 'Enter your name.'; return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { suMsg.textContent = 'Enter a valid email.'; return; }
    if (pass.length < 6) { suMsg.textContent = 'Password must be at least 6 characters.'; return; }
    setBusy(suBtn, 'Creating account...');
    suMsg.textContent = '';
    try {
      const { data, error } = await sb.auth.signUp({
        email: email,
        password: pass,
        options: { data: { name: name }, emailRedirectTo: location.origin + location.pathname }
      });
      if (error) throw error;
      if (data.user) {
        await sb.from('profiles').upsert({ id: data.user.id, email: email, name: name }, { onConflict: 'id' });
      }
      if (data.session) {
        toast('Account created \u2713', 'success');
      } else {
        checkMsg.textContent = 'We sent a confirmation link to "' + email + '". Tap it to activate your account, then log in.';
        showStep('check');
      }
    } catch (e) {
      const m = e && e.message || '';
      suMsg.textContent = /already registered|already exists/i.test(m)
        ? 'This email is already registered. Try logging in.'
        : 'Error: ' + (m || 'could not sign up');
    }
    clearBusy(suBtn);
  }

  async function doForgot() {
    const email = fgEmail.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { fgMsg.textContent = 'Enter a valid email.'; return; }
    setBusy(fgBtn, 'Sending...');
    fgMsg.textContent = '';
    try {
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
      if (error) throw error;
      fgMsg.textContent = '';
      checkMsg.textContent = 'We sent a password reset link to "' + email + '".';
      showStep('check');
    } catch (e) {
      fgMsg.textContent = 'Error: ' + (e && e.message ? e.message : 'could not send link');
    }
    clearBusy(fgBtn);
  }

  /* ---------- Topbar chip ---------- */
  const topbar = document.querySelector('.topbar');
  const slot = mk('div');
  slot.id = 'authSlot';
  slot.style.cssText = 'display:flex;align-items:center;gap:8px;margin-left:auto';
  if (topbar) {
    const themeBtn = document.getElementById('themeBtn');
    topbar.insertBefore(slot, themeBtn);
  }

  async function setName(user) {
    const n = prompt('Your name:');
    if (n === null) return;
    const name = n.trim().slice(0, 60);
    if (!name) return;
    try {
      await sb.from('profiles').upsert({ id: user.id, email: user.email, name: name }, { onConflict: 'id' });
      toast('Name saved', 'success');
      paintChip(user, name);
    } catch (e) {
      console.error(e);
      toast('Could not save name', 'error');
    }
  }

  function paintChip(user, name) {
    if (!slot) return;
    slot.textContent = '';
    const chip = mk('div', 'auth-chip');
    chip.appendChild(mk('span', '', name || user.email));
    if (user.email === ADMIN_EMAIL) chip.appendChild(mk('span', 'sm-ok', 'Admin'));
    chip.appendChild(btn('Name', () => setName(user)));
    chip.appendChild(btn('Log Out', async () => { await sb.auth.signOut(); }));
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
      return (data && data.name) || (user.user_metadata && user.user_metadata.name) || '';
    } catch (e) { return ''; }
  }

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
      if (event === 'SIGNED_IN') toast('Welcome back \u2713', 'success');
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
