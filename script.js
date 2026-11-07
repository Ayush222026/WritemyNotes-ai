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

/* ---------- Agar nayi files index.html se load nahi hui to yahan se load karo ---------- */
window.addEventListener('load', function () {
  const need = [
    ['smart.js', 'smartCard'],
    ['pdfin.js', 'pdfInCard'],
    ['images.js', 'imgCard']
  ];
  const todo = need.filter(n => !document.getElementById(n[1]));
  if (!todo.length) return;
  let i = 0;
  function check() {
    need.forEach(n => {
      if (!document.getElementById(n[1])) showErr(n[0] + ' load hui par uska card nahi bana');
    });
  }
  function next() {
    if (i >= todo.length) { setTimeout(check, 800); return; }
    const name = todo[i++][0];
    const s = document.createElement('script');
    s.src = name + '?v=' + Date.now();
    s.onload = next;
    s.onerror = function () { next(); };
    document.head.appendChild(s);
  }
  next();
});
