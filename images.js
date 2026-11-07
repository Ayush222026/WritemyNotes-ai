(function () {
  'use strict';
  const W = window.WMN;
  const ta = document.getElementById('textInput');
  const textCard = ta ? ta.closest('.card') : null;
  if (!W || !W.parseText || !ta || !textCard) { console.error('Pehle ki files load nahi hui'); return; }
  const $id = id => document.getElementById(id);

  const IMG_RE = /^\[\[img:([A-Za-z0-9]{4,40})\]\]$/;
  const MAX_IMAGES = 80, LONG = 1400, THUMB = 120;
  const SIZES = [[100, 'Poori chaudai (100%)'], [80, 'Bada (80%)'], [60, 'Medium (60%)'], [40, 'Chhota (40%)'], [25, 'Bahut chhota (25%)']];

  let imgVer = 0;
  const meta = new Map();   // id -> {id,name,w,h,pct,thumb,bytes,t}
  const mem = new Map();    // id -> {id,w,h,pct,cv}

  function mk(tag, cls, txt) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt !== undefined) e.textContent = txt;
    return e;
  }
  function btn(label, fn, cls) {
    const b = mk('button', 'btn' + (cls ? ' ' + cls : ''), label);
    b.type = 'button';
    b.addEventListener('click', fn);
    return b;
  }
  const newId = () => 'i' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const cleanName = n => Array.from(String(n || 'image').replace(/[\u0000-\u001f]/g, ' ').trim()).slice(0, 40).join('') || 'image';

  /* ---------- Text mein [[img:ID]] lines ko image block banao ---------- */
  let inner = W.parseText;
  function wrapped(raw) {
    const lines = String(raw).replace(/\r\n?/g, '\n').split('\n');
    if (!lines.some(l => IMG_RE.test(l.trim()))) return inner(raw);
    const out = [];
    let buf = [];
    const flush = () => {
      if (buf.length) { inner(buf.join('\n')).forEach(b => out.push(b)); buf = []; }
    };
    for (const l of lines) {
      const m = IMG_RE.exec(l.trim());
      if (m) { flush(); out.push({ type: 'image', id: m[1] }); }
      else buf.push(l);
    }
    flush();
    return out;
  }
  try {
    Object.defineProperty(W, 'parseText', {
      configurable: true, enumerable: true,
      get: function () { return wrapped; },
      set: function (fn) { if (typeof fn === 'function') inner = fn; }
    });
  } catch (e) { W.parseText = wrapped; }

  /* PDF cache ko batao ki images badli hain */
  const prevGet = W.getSettings || function () { return {}; };
  W.getSettings = function () { return Object.assign({}, prevGet(), { imgVer: imgVer }); };

  /* ---------- IndexedDB ---------- */
  let dbPromise = null;
  function db() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((res, rej) => {
      if (!window.indexedDB) { rej(new Error('NOIDB')); return; }
      const r = indexedDB.open('wmn_img', 1);
      r.onupgradeneeded = () => {
        r.result.createObjectStore('meta', { keyPath: 'id' });
        r.result.createObjectStore('blob', { keyPath: 'id' });
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error || new Error('IDB'));
    });
    return dbPromise;
  }
  const rq = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  async function idbPut(store, val) {
    const d = await db();
    const t = d.transaction(store, 'readwrite');
    t.objectStore(store).put(val);
    return new Promise((res, rej) => { t.oncomplete = () => res(); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); });
  }
  async function idbDel(store, id) {
    const d = await db();
    const t = d.transaction(store, 'readwrite');
    t.objectStore(store).delete(id);
    return new Promise((res, rej) => { t.oncomplete = () => res(); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); });
  }
  async function idbGet(store, id) { const d = await db(); return rq(d.transaction(store).objectStore(store).get(id)); }
  async function idbAll(store) { const d = await db(); return rq(d.transaction(store).objectStore(store).getAll()); }

  const initP = (async function () {
    try {
      const all = await idbAll('meta');
      (all || []).forEach(m => { if (m && typeof m.id === 'string') meta.set(m.id, m); });
    } catch (e) { console.error(e); }
  })();

  /* ---------- Engine ke liye ---------- */
  async function ensure(ids) {
    await initP;
    for (const id of Array.from(new Set(ids))) {
      if (mem.has(id)) continue;
      const m = meta.get(id);
      if (!m) continue;
      try {
        const rec = await idbGet('blob', id);
        if (!rec || !rec.blob) continue;
        const bmp = await createImageBitmap(rec.blob);
        mem.set(id, { id: id, w: bmp.width, h: bmp.height, pct: m.pct || 100, cv: bmp });
      } catch (e) { console.error(e); }
    }
  }
  const get = id => mem.get(id) || null;

  /* ---------- Image save ---------- */
  async function saveImage(src, name, png) {
    await initP;
    if (meta.size >= MAX_IMAGES) throw new Error('FULL');
    const sc = Math.min(1, LONG / Math.max(src.width, src.height));
    const w = Math.max(1, Math.round(src.width * sc)), h = Math.max(1, Math.round(src.height * sc));
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const x = cv.getContext('2d');
    if (!png) { x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); }
    x.imageSmoothingQuality = 'high';
    x.drawImage(src, 0, 0, w, h);
    const blob = await new Promise(r => cv.toBlob(r, png ? 'image/png' : 'image/jpeg', 0.88));
    if (!blob) throw new Error('BLOB');

    const ts = Math.min(1, THUMB / Math.max(w, h));
    const tc = document.createElement('canvas');
    tc.width = Math.max(1, Math.round(w * ts)); tc.height = Math.max(1, Math.round(h * ts));
    const tx = tc.getContext('2d');
    tx.fillStyle = '#fff'; tx.fillRect(0, 0, tc.width, tc.height);
    tx.drawImage(cv, 0, 0, tc.width, tc.height);

    const id = newId();
    const m = { id: id, name: cleanName(name), w: w, h: h, pct: 100, thumb: tc.toDataURL('image/jpeg', 0.7), bytes: blob.size, t: Date.now() };
    await idbPut('blob', { id: id, blob: blob });
    await idbPut('meta', m);
    meta.set(id, m);
    mem.set(id, { id: id, w: w, h: h, pct: 100, cv: await createImageBitmap(cv) });
    imgVer++;
    renderGrid();
    return id;
  }

  W.images = { get: get, ensure: ensure, add: saveImage, count: () => meta.size, max: MAX_IMAGES };

  /* ---------- Text mein token daalo ---------- */
  let lastPos = null;
  ['keyup', 'click', 'blur', 'input'].forEach(ev => ta.addEventListener(ev, () => { lastPos = ta.selectionStart; }));

  function insertToken(id) {
    const tok = '[[img:' + id + ']]';
    const v = ta.value;
    const pos = lastPos === null ? v.length : Math.min(lastPos, v.length);
    let eol = v.indexOf('\n', pos);
    if (eol < 0) eol = v.length;
    const before = v.slice(0, eol).replace(/\s+$/, '');
    const after = v.slice(eol).replace(/^\s+/, '');
    ta.value = (before ? before + '\n\n' : '') + tok + '\n\n' + after;
    lastPos = (before ? before.length + 2 : 0) + tok.length + 1;
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  }

  /* ---------- File se image ---------- */
  function fileToCanvas(file) {
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(file);
      const im = new Image();
      im.onload = () => {
        URL.revokeObjectURL(url);
        const sc = Math.min(1, LONG / Math.max(im.naturalWidth, im.naturalHeight));
        const cv = document.createElement('canvas');
        cv.width = Math.max(1, Math.round(im.naturalWidth * sc));
        cv.height = Math.max(1, Math.round(im.naturalHeight * sc));
        cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height);
        res(cv);
      };
      im.onerror = () => { URL.revokeObjectURL(url); rej(new Error('IMG')); };
      im.src = url;
    });
  }

  async function addFiles(files) {
    let ok = 0;
    for (const f of files) {
      if (!/^image\//.test(f.type || '') && !/\.(jpe?g|png|webp|gif|bmp)$/i.test(f.name || '')) { toast((f.name || 'File') + ' image nahi hai', 'error'); continue; }
      if (f.size > 25 * 1024 * 1024) { toast((f.name || 'Image') + ' 25MB se badi hai', 'error'); continue; }
      try {
        const cv = await fileToCanvas(f);
        const png = /png|webp|gif/i.test(f.type || '');
        const id = await saveImage(cv, (f.name || 'image').replace(/\.[^.]+$/, ''), png);
        insertToken(id);
        ok++;
      } catch (e) {
        if (e && e.message === 'FULL') { toast('Maximum ' + MAX_IMAGES + ' images ho sakti hain. Kuch delete karo', 'error'); break; }
        console.error(e);
        toast('Image save nahi ho paayi (private mode ho to normal mode mein kholo)', 'error');
      }
    }
    if (ok) toast(ok + (ok === 1 ? ' image' : ' images') + ' text mein lag gayi', 'success');
  }

  /* ---------- Size badlo, delete karo ---------- */
  function refresh() { if (W.refreshPreview) W.refreshPreview(); }

  async function setPct(id, pct) {
    const m = meta.get(id);
    if (!m) return;
    m.pct = pct;
    const e = mem.get(id);
    if (e) e.pct = pct;
    try { await idbPut('meta', m); } catch (er) { console.error(er); }
    imgVer++;
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    refresh();
  }

  async function removeImage(id) {
    const m = meta.get(id);
    if (!m) return;
    if (!confirm('"' + m.name + '" delete kar dein? Text se iski line bhi hat jayegi.')) return;
    try { await idbDel('blob', id); await idbDel('meta', id); } catch (e) { console.error(e); }
    meta.delete(id);
    const e = mem.get(id);
    if (e && e.cv && e.cv.close) { try { e.cv.close(); } catch (er) { /* ignore */ } }
    mem.delete(id);
    ta.value = ta.value.split('\n').filter(l => { const mm = IMG_RE.exec(l.trim()); return !(mm && mm[1] === id); }).join('\n');
    imgVer++;
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    renderGrid();
    toast('Image delete ho gayi', 'success');
  }

  /* ---------- Style ---------- */
  const sty = document.createElement('style');
  sty.textContent =
    '.img-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;margin-top:12px}' +
    '.img-tile{border:1px solid var(--border);background:var(--bg);border-radius:14px;padding:10px;display:flex;flex-direction:column;gap:8px}' +
    '.img-tile img{width:100%;height:90px;object-fit:contain;background:#fff;border-radius:8px}' +
    '.img-name{font-size:12px;color:var(--muted);word-break:break-word}' +
    '.img-tile select{padding:8px;border-radius:10px;border:1px solid var(--border);background:var(--card);color:var(--text);font:inherit;font-size:12px;width:100%}' +
    '.img-btns{display:flex;gap:6px;flex-wrap:wrap}' +
    '.img-btns .btn{padding:8px 10px;font-size:12px}';
  document.head.appendChild(sty);

  /* ---------- Card ---------- */
  const card = mk('div', 'card');
  card.id = 'imgCard';
  card.appendChild(mk('h3', '', '🖼️ Images (photo ya PDF ki images)'));
  card.appendChild(mk('p', 'muted', 'Photo chuno, wo text ke beech cursor ki jagah lag jayegi. PDF se aayi images bhi yahin jama hoti hain. Images normal photo ki tarah page par aati hain (handwriting nahi banti).'));
  const fileIn = document.createElement('input');
  fileIn.type = 'file'; fileIn.accept = 'image/*'; fileIn.multiple = true; fileIn.hidden = true;
  card.appendChild(fileIn);
  const tb = mk('div', 'toolbar');
  tb.appendChild(btn('📷 Photo / image chuno', () => fileIn.click(), 'btn-main'));
  card.appendChild(tb);
  const status = mk('p', 'muted small', '');
  card.appendChild(status);
  const grid = mk('div', 'img-grid');
  card.appendChild(grid);
  const anchor = $id('pdfInCard') || textCard;
  anchor.parentNode.insertBefore(card, anchor.nextSibling);

  fileIn.addEventListener('change', () => {
    const files = Array.from(fileIn.files || []);
    fileIn.value = '';
    if (files.length) addFiles(files);
  });

  function renderGrid() {
    grid.textContent = '';
    const list = Array.from(meta.values()).sort((a, b) => b.t - a.t);
    let bytes = 0;
    list.forEach(m => { bytes += m.bytes || 0; });
    status.textContent = list.length
      ? list.length + ' images  •  ' + (bytes / 1048576).toFixed(1) + ' MB  •  (max ' + MAX_IMAGES + ')'
      : 'Abhi koi image nahi hai.';
    list.forEach(m => {
      const t = mk('div', 'img-tile');
      const im = new Image();
      im.src = m.thumb; im.alt = m.name;
      t.appendChild(im);
      t.appendChild(mk('div', 'img-name', m.name));
      const sel = document.createElement('select');
      SIZES.forEach(s => {
        const o = document.createElement('option');
        o.value = String(s[0]); o.textContent = s[1];
        sel.appendChild(o);
      });
      sel.value = String(SIZES.some(s => s[0] === m.pct) ? m.pct : 100);
      sel.addEventListener('change', () => setPct(m.id, Number(sel.value)));
      t.appendChild(sel);
      const row = mk('div', 'img-btns');
      row.appendChild(btn('➕ Text mein daalo', () => { insertToken(m.id); toast('Image text mein lag gayi', 'success'); }));
      row.appendChild(btn('🗑️', () => removeImage(m.id), 'btn-danger'));
      t.appendChild(row);
      grid.appendChild(t);
    });
  }

  /* ---------- Structure list mein [[img:..]] ko 🖼️ dikhao ---------- */
  const struct = $id('structure');
  let obs = null;
  function fixRows() {
    if (!struct) return;
    if (obs) obs.disconnect();
    struct.querySelectorAll('.sline').forEach(row => {
      const tx = row.querySelector('.stext');
      if (!tx || row.dataset.img) return;
      const m = IMG_RE.exec(tx.textContent.trim());
      if (!m) return;
      const info = meta.get(m[1]);
      const nr = row.cloneNode(false);
      nr.className = 'sline';
      nr.dataset.img = '1';
      nr.appendChild(mk('span', 'sbadge', '🖼️'));
      nr.appendChild(mk('span', 'stext', info ? 'Image: ' + info.name : 'Image (nahi mili)'));
      if (info && info.thumb) {
        const im = new Image();
        im.src = info.thumb; im.alt = '';
        im.style.cssText = 'height:34px;border-radius:4px;border:1px solid var(--border)';
        nr.appendChild(im);
      }
      row.replaceWith(nr);
    });
    if (obs) obs.observe(struct, { childList: true, subtree: true });
  }
  if (struct) {
    obs = new MutationObserver(fixRows);
    obs.observe(struct, { childList: true, subtree: true });
  }

  /* ---------- Start ---------- */
  initP.then(() => {
    renderGrid();
    fixRows();
    refresh();
  });
})();
