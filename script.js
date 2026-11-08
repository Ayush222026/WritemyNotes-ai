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

/* ---------- Error screen par dikhao ---------- */
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
      showErr('File load nahi hui: ' + (t.src || t.href || '').split('?')[0].split('/').pop());
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

/* ---------- Khud theek karne wala hissa ---------- */
function basicParse(raw) {
  const out = [];
  String(raw).replace(/\r\n?/g, '\n').split('\n').forEach(function (line) {
    const t = line.trim();
    let m;
    if (!t) out.push({ type: 'space', text: '' });
    else if ((m = /^(#{1,6})\s+(.+)$/.exec(t))) out.push({ type: m[1].length === 1 ? 'heading' : 'subheading', text: m[2] });
    else if ((m = /^(\d+)[.)]\s+(.+)$/.exec(t))) out.push({ type: 'number', num: m[1], text: m[2] });
    else if ((m = /^[-*\u2022]\s+(.+)$/.exec(t))) out.push({ type: 'bullet', text: m[1] });
    else out.push({ type: 'paragraph', text: t });
  });
  return out;
}

function loadJs(name) {
  return new Promise(function (res) {
    const s = document.createElement('script');
    s.src = name + '?v=' + Date.now();
    s.onload = function () { res(true); };
    s.onerror = function () { showErr('File nahi mili: ' + name + ' (repo mein naam check karo)'); res(false); };
    document.head.appendChild(s);
  });
}

async function heal() {
  const W = window.WMN;
  if (!W) { showErr('WMN nahi bana: editor.js load nahi hui'); return; }
  const ta = $('#textInput');
  const checks = [
    ['preview.js', () => !!W.refreshPreview],
    ['pdf.js', () => !!W.pdf],
    ['projects.js', () => !!W.projects],
    ['smart.js', () => !!$('#smartCard')],
    ['pdfin.js', () => !!$('#pdfInCard')],
    ['images.js', () => !!$('#imgCard')]
  ];
  const missing = checks.filter(c => !c[1]());
  if (!missing.length) return;
  if (typeof W.getText !== 'function' && ta) W.getText = () => ta.value;
  if (typeof W.parseText !== 'function') W.parseText = basicParse;
  for (const m of missing) await loadJs(m[0]);
  setTimeout(function () {
    checks.forEach(c => { if (!c[1]()) showErr(c[0] + ' abhi bhi nahi chali'); });
  }, 900);
}
window.addEventListener('load', function () { setTimeout(heal, 700); });
