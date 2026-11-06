(function () {
  'use strict';
  const W = window.WMN;
  if (!W || !W.getText) { console.error('Pehle ki files load nahi hui'); return; }
  const $id = id => document.getElementById(id);
  if (!$id('projList')) return;

  const KEY = 'wmn_projects', CUR = 'wmn_current';
  const MAX_PROJECTS = 50, MAX_CHARS = 300000, MAX_OBJ = 20000;

  let projects = [];
  let current = '';
  let switching = false;   // project badalte waqt auto-save band
  let warned = false;
  let savedAt = null;

  /* ---------- Helpers ---------- */
  function mk(tag, cls, txt) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt !== undefined) e.textContent = txt;
    return e;
  }
  const isObj = o => !!o && typeof o === 'object' && !Array.isArray(o);

  function rawGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function rawSet(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  function rawDel(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }
  function put(k, v) { if (v) rawSet(k, v); else rawDel(k); }

  function parseObj(s) {
    if (!s) return null;
    try { const o = JSON.parse(s); return isObj(o) ? o : null; } catch (e) { return null; }
  }
  function lim(o) {
    if (!isObj(o)) return null;
    try { return JSON.stringify(o).length <= MAX_OBJ ? o : null; } catch (e) { return null; }
  }
  function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
  function newId() { return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function cleanName(n) {
    return Array.from(String(n == null ? '' : n).replace(/[\u0000-\u001f]/g, ' ').trim()).slice(0, 60).join('');
  }
  function words(t) { const s = (t || '').trim(); return s ? s.split(/\s+/).length : 0; }
  function fmtDate(ts) {
    try { return new Date(ts).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }); }
    catch (e) { return new Date(ts).toLocaleString(); }
  }
  function snippet(t) {
    const s = Array.from((t || '').replace(/\s+/g, ' ').trim());
    return s.slice(0, 100).join('') + (s.length > 100 ? '…' : '');
  }
  function hasContent(p) {
    if (p.text.trim()) return true;
    const f = p.cover && p.cover.f;
    return isObj(f) && Object.keys(f).some(k => typeof f[k] === 'string' && f[k].trim());
  }

  /* ---------- Project data ---------- */
  function sanitizeProject(p) {
    if (!isObj(p)) return null;
    const now = Date.now();
    return {
      id: (typeof p.id === 'string' && /^[a-z0-9]{4,40}$/i.test(p.id)) ? p.id : newId(),
      name: cleanName(p.name) || 'Untitled',
      text: typeof p.text === 'string' ? p.text.slice(0, MAX_CHARS) : '',
      paper: lim(p.paper), pen: lim(p.pen), cover: lim(p.cover),
      created: Number.isFinite(p.created) ? p.created : now,
      updated: Number.isFinite(p.updated) ? p.updated : now
    };
  }

  function loadProjects() {
    try {
      const a = JSON.parse(rawGet(KEY) || '[]');
      if (Array.isArray(a)) return a.map(sanitizeProject).filter(Boolean).slice(0, MAX_PROJECTS);
    } catch (e) { /* khaali list */ }
    return [];
  }

  function persist() {
    try {
      localStorage.setItem(KEY, JSON.stringify(projects));
      warned = false;
      return true;
    } catch (e) {
      if (!warned) {
        warned = true;
        toast('Storage full hai. Kuch purane projects delete karo ya Export karke rakho', 'error');
      }
      return false;
    }
  }

  const find = id => projects.find(p => p.id === id);
  const recent = () => projects.slice().sort((a, b) => b.updated - a.updated);

  /* Abhi browser mein jo chal raha hai (current project ki live state) */
  function snapshot() {
    return {
      text: W.getText(),
      paper: lim(parseObj(rawGet('wmn_paper'))),
      pen: lim(parseObj(rawGet('wmn_pen'))),
      cover: lim(parseObj(rawGet('wmn_cover')))
    };
  }

  /* ---------- Auto-save ---------- */
  function syncNow() {
    if (switching) return;
    const cur = find(current);
    if (!cur) return;
    const s = snapshot();
    if (s.text === cur.text && same(s.paper, cur.paper) && same(s.pen, cur.pen) && same(s.cover, cur.cover)) return;
    cur.text = s.text; cur.paper = s.paper; cur.pen = s.pen; cur.cover = s.cover;
    cur.updated = Date.now();
    if (persist()) {
      savedAt = new Date();
      renderAll();
    }
  }

  /* ---------- Name dialog ---------- */
  const ov = mk('div', 'pdf-ov');
  ov.id = 'askOv';
  ov.setAttribute('role', 'dialog');
  const bx = mk('div', 'pdf-box');
  const ttl = mk('p', 'pdf-txt', '');
  const inp = mk('input', 'ask-in');
  inp.type = 'text'; inp.maxLength = 60; inp.autocomplete = 'off';
  const btns = mk('div', 'ask-btns');
  const okB = mk('button', 'btn-main', 'Save');
  const noB = mk('button', 'btn', 'Cancel');
  okB.type = 'button'; noB.type = 'button';
  btns.appendChild(okB); btns.appendChild(noB);
  bx.appendChild(ttl); bx.appendChild(inp); bx.appendChild(btns);
  ov.appendChild(bx);
  document.body.appendChild(ov);

  let resolver = null;
  function closeAsk(val) {
    ov.classList.remove('show');
    const r = resolver;
    resolver = null;
    if (r) r(val);
  }
  okB.addEventListener('click', () => {
    const v = cleanName(inp.value);
    if (!v) { toast('Naam khaali nahi ho sakta', 'error'); return; }
    closeAsk(v);
  });
  noB.addEventListener('click', () => closeAsk(null));
  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); okB.click(); }
    else if (e.key === 'Escape') closeAsk(null);
  });
  ov.addEventListener('click', e => { if (e.target === ov) closeAsk(null); });

  function askName(title, value, label) {
    return new Promise(res => {
      if (resolver) closeAsk(null);
      resolver = res;
      ttl.textContent = title;
      inp.value = value || '';
      okB.textContent = label || 'OK';
      ov.classList.add('show');
      setTimeout(() => { inp.focus(); inp.select(); }, 60);
    });
  }

  /* ---------- Open / switch ---------- */
  function writeState(p) {
    put('wmn_text', p.text);
    put('wmn_paper', p.paper ? JSON.stringify(p.paper) : '');
    put('wmn_pen', p.pen ? JSON.stringify(p.pen) : '');
    put('wmn_cover', p.cover ? JSON.stringify(p.cover) : '');
  }

  function openProject(id, flash, noSync) {
    const p = find(id);
    if (!p) return;
    if (id === current && !noSync) { showView('editor'); return; }
    if (!noSync) syncNow();
    switching = true;
    current = id;
    rawSet(CUR, id);
    writeState(p);
    rawSet('wmn_view', 'editor');
    rawSet('wmn_flash', flash || '"' + p.name + '" khul gaya');
    location.reload();
  }

  /* ---------- Actions ---------- */
  function addProject(name, data) {
    const now = Date.now();
    const rec = sanitizeProject({
      id: newId(), name: name, text: data.text || '',
      paper: data.paper || null, pen: data.pen || null, cover: data.cover || null,
      created: now, updated: now
    });
    projects.push(rec);
    return rec;
  }

  async function newAssignment() {
    if (projects.length >= MAX_PROJECTS) { toast('Maximum ' + MAX_PROJECTS + ' projects ho sakte hain. Kuch delete karo', 'error'); return; }
    const name = await askName('Naye assignment ka naam', 'Assignment ' + (projects.length + 1), 'Create');
    if (name === null) return;
    syncNow();
    const base = snapshot();
    const rec = addProject(name, { text: '', paper: base.paper, pen: base.pen, cover: null });
    if (!persist()) { projects = projects.filter(p => p.id !== rec.id); return; }
    openProject(rec.id, '"' + rec.name + '" ban gaya. Ab text likho', true);
  }

  async function rename(id) {
    const p = find(id);
    if (!p) return;
    const n = await askName('Naya naam', p.name, 'Save');
    if (n === null) return;
    p.name = n;
    persist();
    renderAll();
    toast('Naam badal gaya', 'success');
  }

  function duplicate(id) {
    if (projects.length >= MAX_PROJECTS) { toast('Maximum ' + MAX_PROJECTS + ' projects ho sakte hain. Kuch delete karo', 'error'); return; }
    if (id === current) syncNow();
    const p = find(id);
    if (!p) return;
    const now = Date.now();
    const copy = sanitizeProject(Object.assign(JSON.parse(JSON.stringify(p)), {
      id: newId(), name: cleanName(p.name + ' (copy)'), created: now, updated: now
    }));
    projects.push(copy);
    if (!persist()) { projects.pop(); return; }
    renderAll();
    toast('Duplicate ban gaya: ' + copy.name, 'success');
  }

  function removeProject(id) {
    const p = find(id);
    if (!p) return;
    if (!confirm('"' + p.name + '" delete kar dein? Ye wapas nahi aayegi.')) return;
    const wasCur = id === current;
    if (!wasCur) syncNow();
    projects = projects.filter(x => x.id !== id);
    if (wasCur) {
      let next = recent()[0];
      if (!next) next = addProject('Assignment 1', {});
      if (!persist()) return;
      openProject(next.id, 'Project delete ho gaya', true);
    } else {
      persist();
      renderAll();
      toast('Project delete ho gaya', 'success');
    }
  }

  function exportProject(id) {
    if (id === current) syncNow();
    const p = find(id);
    if (!p) return;
    try {
      const data = {
        app: 'WriteMyNotes AI', type: 'project', version: 1, exported: new Date().toISOString(),
        project: { name: p.name, text: p.text, paper: p.paper, pen: p.pen, cover: p.cover }
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      let safe = p.name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '').trim().replace(/\s+/g, '-');
      safe = Array.from(safe).slice(0, 40).join('') || 'project';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'WriteMyNotes-' + safe + '.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      toast('Export ho gaya (Downloads folder mein)', 'success');
    } catch (e) {
      console.error(e);
      toast('Export nahi ho paya', 'error');
    }
  }

  /* ---------- Import ---------- */
  const fileIn = $id('projFile');
  $id('projImport').addEventListener('click', () => fileIn.click());
  fileIn.addEventListener('change', () => {
    const f = fileIn.files && fileIn.files[0];
    if (!f) return;
    if (!/\.json$/i.test(f.name) && f.type !== 'application/json') {
      toast('Sirf .json file chuno', 'error'); fileIn.value = ''; return;
    }
    if (f.size > 3 * 1024 * 1024) {
      toast('File 3MB se badi hai', 'error'); fileIn.value = ''; return;
    }
    if (projects.length >= MAX_PROJECTS) {
      toast('Maximum ' + MAX_PROJECTS + ' projects ho sakte hain. Kuch delete karo', 'error'); fileIn.value = ''; return;
    }
    const r = new FileReader();
    r.onload = () => {
      try {
        const o = JSON.parse(String(r.result || ''));
        if (!isObj(o) || o.app !== 'WriteMyNotes AI' || !isObj(o.project)) throw new Error('BAD');
        const now = Date.now();
        const rec = sanitizeProject(Object.assign({}, o.project, { id: newId(), created: now, updated: now }));
        if (!rec) throw new Error('BAD');
        projects.push(rec);
        if (!persist()) { projects.pop(); return; }
        renderAll();
        toast('Import ho gaya: ' + rec.name + '. Open dabao', 'success');
      } catch (e) {
        toast('Ye WriteMyNotes ki project file nahi lagti', 'error');
      }
    };
    r.onerror = () => toast('File padh nahi paaye', 'error');
    r.readAsText(f, 'UTF-8');
    fileIn.value = '';
  });

  /* ---------- Render ---------- */
  function updateBar() {
    const cur = find(current);
    if (cur) $id('projName').textContent = cur.name;
    $id('projSaved').textContent = savedAt
      ? '✓ Auto-saved ' + savedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '✓ Auto-save on';
  }

  function button(label, fn, cls) {
    const b = mk('button', 'btn' + (cls ? ' ' + cls : ''), label);
    b.type = 'button';
    b.addEventListener('click', fn);
    return b;
  }

  function renderList() {
    const box = $id('projList');
    box.textContent = '';
    const list = recent();
    if (!list.length) { box.appendChild(mk('p', 'proj-empty', 'Koi project nahi hai.')); return; }
    list.forEach(p => {
      const isCur = p.id === current;
      const c = mk('div', 'proj-card' + (isCur ? ' current' : ''));
      const t = mk('div', 'proj-title');
      t.appendChild(mk('span', '', p.name));
      if (isCur) t.appendChild(mk('span', 'proj-badge', 'Current'));
      c.appendChild(t);
      c.appendChild(mk('div', 'proj-meta', words(p.text) + ' words  •  ' + fmtDate(p.updated)));
      const sn = snippet(p.text);
      if (sn) c.appendChild(mk('div', 'proj-snip', sn));
      const b = mk('div', 'proj-btns');
      b.appendChild(button(isCur ? '✍️ Likho' : '📂 Open', () => openProject(p.id)));
      b.appendChild(button('✏️ Rename', () => rename(p.id)));
      b.appendChild(button('📑 Duplicate', () => duplicate(p.id)));
      b.appendChild(button('⬇️ Export', () => exportProject(p.id)));
      b.appendChild(button('🗑️ Delete', () => removeProject(p.id), 'btn-danger'));
      c.appendChild(b);
      box.appendChild(c);
    });
  }

  function renderRecent() {
    const box = $id('recentList');
    const empty = $id('recentEmpty');
    if (!box) return;
    box.textContent = '';
    const list = recent().filter(hasContent).slice(0, 4);
    if (empty) empty.style.display = list.length ? 'none' : '';
    list.forEach(p => {
      const row = mk('div', 'recent-row');
      const l = mk('div', 'rt');
      l.appendChild(mk('div', 'rn', p.name));
      l.appendChild(mk('div', 'rm', words(p.text) + ' words  •  ' + fmtDate(p.updated)));
      row.appendChild(l);
      row.appendChild(button('Open', () => openProject(p.id)));
      box.appendChild(row);
    });
  }

  function renderAll() { updateBar(); renderList(); renderRecent(); }

  /* ---------- Buttons ---------- */
  $id('projNew').addEventListener('click', newAssignment);
  $id('homeNew').addEventListener('click', newAssignment);
  $id('projRename').addEventListener('click', () => rename(current));

  $id('projReset').addEventListener('click', () => {
    if (!confirm('Is project ki Paper aur Pen settings default par aa jayengi. Text aur cover safe rahenge. Continue?')) return;
    syncNow();
    switching = true;
    rawDel('wmn_paper');
    rawDel('wmn_pen');
    const cur = find(current);
    if (cur) { cur.paper = null; cur.pen = null; cur.updated = Date.now(); persist(); }
    rawSet('wmn_flash', 'Paper aur Pen settings reset ho gayi');
    location.reload();
  });

  /* ---------- Start ---------- */
  projects = loadProjects();
  current = rawGet(CUR) || '';

  if (!projects.length) {
    const s = snapshot();
    const rec = addProject('My First Assignment', s);
    current = rec.id;
    persist();
  } else if (!find(current)) {
    const s = snapshot();
    const rec = addProject('Assignment ' + (projects.length + 1), s);
    current = rec.id;
    persist();
  }
  rawSet(CUR, current);
  renderAll();

  const flash = rawGet('wmn_flash');
  if (flash) { rawDel('wmn_flash'); setTimeout(() => toast(flash, 'success'), 500); }

  setInterval(syncNow, 2000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') syncNow(); });
  window.addEventListener('pagehide', syncNow);

  W.projects = { syncNow: syncNow, getCurrent: () => current };
})();
