const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const TITLES = {
  home: 'Home', editor: 'Write', projects: 'My Projects',
  styles: 'Handwriting Styles', paper: 'Paper Settings', help: 'Help & About'
};

/* Safe localStorage helpers */
function store(key, value) {
  try { localStorage.setItem(key, value); } catch (e) { /* ignore */ }
}
function load(key) {
  try { return localStorage.getItem(key); } catch (e) { return null; }
}

/* Toast notifications */
function toast(message, type = 'info') {
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = message;
  $('#toastBox').appendChild(el);
  setTimeout(() => el.remove(), type === 'error' ? 8000 : 3000);
}

/* Theme */
function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  $('#themeBtn').textContent = theme === 'dark' ? '☀️' : '🌙';
  store('wmn_theme', theme);
}
$('#themeBtn').addEventListener('click', () => {
  const now = document.documentElement.getAttribute('data-theme');
  setTheme(now === 'dark' ? 'light' : 'dark');
});

/* View switching */
function showView(name) {
  if (!TITLES[name]) name = 'home';
  $$('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + name));
  $$('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === name));
  $('#pageTitle').textContent = TITLES[name];
  store('wmn_view', name);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
$$('.nav-btn').forEach(b => b.addEventListener('click', () => showView(b.dataset.view)));
$$('[data-go]').forEach(b => b.addEventListener('click', () => showView(b.dataset.go)));

/* Start */
setTheme(load('wmn_theme') || 'light');
showView(load('wmn_view') || 'home');

/* ---------- Error screen par dikhao (Android par console nahi hota) ---------- */
let errShown = 0;
const errSeen = new Set();
function showErr(msg) {
  if (errShown >= 5 || errSeen.has(msg)) return;
  errSeen.add(msg);
  errShown++;
  toast(msg, 'error');
}
window.addEventListener('error', function (e) {
  const t = e.target;
  if (t && t !== window && t.tagName) {
    if (t.tagName === 'SCRIPT' || t.tagName === 'LINK') {
      const src = (t.src || t.href || '').split('?')[0].split('/').pop();
      showErr('File load nahi hui: ' + src);
    }
    return;
  }
  const f = (e.filename || '').split('?')[0].split('/').pop() || 'page';
  showErr('Error: ' + (e.message || 'unknown') + ' (' + f + ':' + (e.lineno || 0) + ')');
}, true);
window.addEventListener('unhandledrejection', function (e) {
  const r = e.reason;
  showErr('Error: ' + ((r && r.message) || r || 'unknown'));
});

/* ---------- Jaanch: har file poori hai ya nahi ---------- */
window.addEventListener('load', function () {
  const cards = ['smartCard', 'pdfInCard', 'imgCard'];
  if (!cards.some(id => !document.getElementById(id))) return;

  setTimeout(async function () {
    const files = ['editor.js', 'engine.js', 'paper.js', 'pen.js', 'cover.js', 'preview.js',
      'pdf.js', 'projects.js', 'smart.js', 'pdfin.js', 'images.js'];
    const rep = [];
    for (const f of files) {
      try {
        const r = await fetch(f + '?v=' + Date.now(), { cache: 'no-store' });
        if (!r.ok) { rep.push(f + ': NAHI MILI (' + r.status + ')'); continue; }
        const t = (await r.text()).trim();
        const ok = /\}\)\(\);?$/.test(t);
        let s = f + ': ' + t.length + (ok ? ' ok' : ' ADHOORI');
        if (f === 'engine.js') s += t.indexOf('imageLine') >= 0 ? ' (naya)' : ' (purana)';
        if (f === 'editor.js') s += t.indexOf('window.WMN = {') >= 0 ? ' (WMN set)' : ' (WMN NAHI)';
        rep.push(s);
      } catch (e) {
        rep.push(f + ': jaanch fail');
      }
    }
    const W = window.WMN || {};
    rep.push('');
    rep.push('WMN keys: ' + Object.keys(W).join(', '));
    rep.push('');
    rep.push('Scripts: ' + Array.from(document.scripts)
      .map(s => (s.src || 'inline').split('?')[0].split('/').pop()).join(' > '));
    alert('JAANCH REPORT 2\n\n' + rep.join('\n'));
  }, 1500);
});
