(function () {
  'use strict';
  const W = window.WMN;
  const ta = document.getElementById('textInput');
  const textCard = ta ? ta.closest('.card') : null;
  if (!W || !ta || !textCard) { console.error('Pehle ki files load nahi hui'); return; }

  const LIB = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
  const WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const MAX_CHARS = 300000, MAX_PAGES = 150, MAX_MB = 25;

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
  const tick = () => new Promise(r => setTimeout(r, 20));
  const median = a => { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
  const r05 = x => Math.round(x * 2) / 2;

  /* ---------- Options ---------- */
  const opt = { hf: true, hy: true };
  try {
    const o = JSON.parse(load('wmn_pdfin') || 'null');
    if (o && typeof o === 'object') {
      if (typeof o.hf === 'boolean') opt.hf = o.hf;
      if (typeof o.hy === 'boolean') opt.hy = o.hy;
    }
  } catch (e) { /* default */ }
  function saveOpt() { store('wmn_pdfin', JSON.stringify(opt)); }

  /* ---------- Card ---------- */
  const card = mk('div', 'card');
  card.id = 'pdfInCard';
  card.appendChild(mk('h3', '', '📄 PDF se text nikalo'));
  card.appendChild(mk('p', 'muted', 'PDF chuno. App uska text nikal ke upar text box mein daal dega. Bade font wali lines heading ban jaati hain, baaki Smart Detect pehchanta hai.'));

  function check(label, key) {
    const l = mk('label', 'check');
    const i = document.createElement('input');
    i.type = 'checkbox';
    i.checked = opt[key];
    i.addEventListener('change', () => { opt[key] = i.checked; saveOpt(); });
    l.appendChild(i);
    l.appendChild(document.createTextNode(' ' + label));
    card.appendChild(l);
  }
  check('Header, footer aur page numbers hatao', 'hf');
  check('Line ke end mein toote shabd jodo (jaise "infor-" + "mation")', 'hy');

  const fileIn = document.createElement('input');
  fileIn.type = 'file';
  fileIn.accept = 'application/pdf,.pdf';
  fileIn.hidden = true;
  card.appendChild(fileIn);
  const tb = mk('div', 'toolbar');
  tb.appendChild(btn('📄 PDF chuno', () => fileIn.click(), 'btn-main'));
  card.appendChild(tb);
  const status = mk('p', 'muted small', '');
  card.appendChild(status);
  textCard.parentNode.insertBefore(card, textCard.nextSibling);

  /* ---------- Progress aur choice boxes ---------- */
  let cancelled = false, busy = false;

  const ov = mk('div', 'pdf-ov');
  ov.id = 'pdfinOv';
  const bx = mk('div', 'pdf-box');
  const ovTxt = mk('p', 'pdf-txt', '');
  const bar = mk('div', 'pdf-bar');
  const barIn = mk('span');
  bar.appendChild(barIn);
  bx.appendChild(mk('div', 'pdf-spin'));
  bx.appendChild(ovTxt);
  bx.appendChild(bar);
  bx.appendChild(btn('✖ Cancel', () => { cancelled = true; ovTxt.textContent = 'Cancel ho raha hai...'; }));
  ov.appendChild(bx);
  document.body.appendChild(ov);
  function showProg(t, p) { ovTxt.textContent = t; barIn.style.width = p + '%'; ov.classList.add('show'); }
  function hideProg() { ov.classList.remove('show'); }

  const cov = mk('div', 'pdf-ov');
  const cbx = mk('div', 'pdf-box');
  const cTxt = mk('p', 'pdf-txt', '');
  const cBtns = mk('div');
  cBtns.style.cssText = 'display:flex;flex-direction:column;gap:10px;margin-top:12px';
  const bRep = btn('🔄 Purane text ki jagah', () => {}, 'btn-main');
  const bAdd = btn('➕ Purane ke neeche jodo', () => {});
  const bNo = btn('Cancel', () => {});
  cBtns.appendChild(bRep); cBtns.appendChild(bAdd); cBtns.appendChild(bNo);
  cbx.appendChild(cTxt); cbx.appendChild(cBtns);
  cov.appendChild(cbx);
  document.body.appendChild(cov);
  function choose(msg) {
    return new Promise(res => {
      cTxt.textContent = msg;
      cov.classList.add('show');
      const done = v => { cov.classList.remove('show'); res(v); };
      bRep.onclick = () => done('replace');
      bAdd.onclick = () => done('add');
      bNo.onclick = () => done(null);
    });
  }

  /* ---------- PDF.js library ---------- */
  function getLib() {
    return new Promise((resolve, reject) => {
      function ready() {
        try { window.pdfjsLib.GlobalWorkerOptions.workerSrc = WORKER; } catch (e) { /* ignore */ }
        resolve(window.pdfjsLib);
      }
      if (window.pdfjsLib) { ready(); return; }
      const sc = document.createElement('script');
      sc.src = LIB;
      const t = setTimeout(() => reject(new Error('NOLIB')), 30000);
      sc.onload = () => { clearTimeout(t); if (window.pdfjsLib) ready(); else reject(new Error('NOLIB')); };
      sc.onerror = () => { clearTimeout(t); reject(new Error('NOLIB')); };
      document.head.appendChild(sc);
    });
  }

  /* ---------- Page ke items -> lines ---------- */
  function buildLines(items) {
    const its = [];
    for (const it of items) {
      if (!it || typeof it.str !== 'string' || !it.transform || !it.str.length) continue;
      const t = it.transform;
      if (!t[0] || Math.abs(t[1]) > 0.1 * Math.abs(t[0])) continue;   // ghuma hua text (watermark) chhodo
      const size = Math.hypot(t[0], t[1]);
      if (!(size > 1)) continue;
      its.push({ s: it.str, x: t[4], y: t[5], w: it.width || 0, size: size });
    }
    its.sort((a, b) => (b.y - a.y) || (a.x - b.x));

    const lines = [];
    let cur = null;
    for (const it of its) {
      if (cur && Math.abs(it.y - cur.y) <= 0.45 * Math.max(it.size, cur.maxSize)) {
        cur.items.push(it);
        if (it.size > cur.maxSize) cur.maxSize = it.size;
      } else {
        cur = { y: it.y, maxSize: it.size, items: [it] };
        lines.push(cur);
      }
    }

    const out = [];
    for (const ln of lines) {
      ln.items.sort((a, b) => a.x - b.x);
      let text = '', prev = null;
      const sizeW = new Map();
      for (const it of ln.items) {
        if (prev) {
          const gap = it.x - (prev.x + prev.w);
          if (gap > 0.18 * it.size && !/\s$/.test(text) && !/^\s/.test(it.s)) text += ' ';
        }
        text += it.s;
        const k = r05(it.size);
        sizeW.set(k, (sizeW.get(k) || 0) + it.s.trim().length);
        prev = it;
      }
      text = text.replace(/\s+/g, ' ').trim();
      if (!text) continue;
      let best = 0, bw = -1;
      sizeW.forEach((w, k) => { if (w > bw) { bw = w; best = k; } });
      out.push({ text: text, x: ln.items[0].x, y: ln.y, size: best || r05(ln.maxSize) });
    }
    return out;   // upar se neeche
  }

  /* ---------- Header / footer hatao ---------- */
  const PAGENUM = /^(page\s*)?[-\u2013]?\s*\d{1,4}\s*[-\u2013]?(\s*(of|\/)\s*\d{1,4})?$/i;
  const norm = t => t.toLowerCase().replace(/\d+/g, '#').replace(/\s+/g, ' ').trim();

  function cands(pg) {
    const L = pg.lines, res = [], seen = new Set();
    const add = (ln, k) => { if (!seen.has(ln)) { seen.add(ln); res.push([ln, k + norm(ln.text)]); } };
    for (let i = 0; i < Math.min(2, L.length); i++) if (L[i].y > pg.H * 0.9) add(L[i], 'T');
    for (let i = Math.max(0, L.length - 2); i < L.length; i++) if (L[i].y < pg.H * 0.1) add(L[i], 'B');
    return res;
  }

  function stripHF(pages) {
    const cnt = new Map();
    pages.forEach(pg => {
      new Set(cands(pg).map(c => c[1])).forEach(k => cnt.set(k, (cnt.get(k) || 0) + 1));
    });
    const need = Math.max(2, Math.ceil(pages.length * 0.5));
    let removed = 0;
    pages.forEach(pg => {
      const kill = new Set();
      cands(pg).forEach(c => {
        const repeated = pages.length >= 3 && cnt.get(c[1]) >= need;
        if (repeated || PAGENUM.test(c[0].text.trim())) kill.add(c[0]);
      });
      if (kill.size) { removed += kill.size; pg.lines = pg.lines.filter(l => !kill.has(l)); }
    });
    return removed;
  }

  /* ---------- Body size, line gap ---------- */
  function bodySize(pages) {
    const m = new Map();
    pages.forEach(pg => pg.lines.forEach(l => {
      const k = r05(l.size);
      m.set(k, (m.get(k) || 0) + l.text.length);
    }));
    let best = 11, bw = -1;
    m.forEach((w, k) => { if (w > bw) { bw = w; best = k; } });
    return best;
  }

  function typicalGap(pages, body) {
    const g = [];
    pages.forEach(pg => {
      for (let i = 1; i < pg.lines.length; i++) {
        const a = pg.lines[i - 1], b = pg.lines[i];
        if (Math.abs(a.size - body) <= 1 && Math.abs(b.size - body) <= 1) {
          const d = a.y - b.y;
          if (d > body * 0.7 && d < body * 3) g.push(d);
        }
      }
    });
    return median(g) || body * 1.3;
  }

  /* ---------- Lines -> blocks ---------- */
  const BUL = /^([\u2022\u25CF\u25AA\u25E6\u25CB\u25A0\u25A1\u2713\u2714\u27A2\u27A4\-\u2013\u2014*])\s+(\S.*)$/;
  const NUM = /^(\d{1,3})[.)]\s+(\S.*)$/;
  const TERM = /[.!?:;\u0964)"'\u201D\u2019]$/;

  function glue(a, b) {
    if (opt.hy && /[A-Za-z\u0900-\u097F]-$/.test(a) && /^[a-z\u0900-\u097F]/.test(b)) return a.slice(0, -1) + b;
    return a + ' ' + b;
  }

  function build(pages, body, typ) {
    const blocks = [];
    let cur = null, prev = null;
    pages.forEach(pg => {
      pg.lines.forEach((ln, li) => {
        const first = li === 0;
        const head = ln.size >= body * 1.15 && Array.from(ln.text).length <= 120;
        let mb = null, mn = null;
        if (!head) { mb = BUL.exec(ln.text); mn = mb ? null : NUM.exec(ln.text); }
        const gap = (prev && !first) ? prev.y - ln.y : null;

        let join = false;
        if (cur) {
          if (head) {
            join = cur.kind === 'h' && Math.abs(ln.size - cur.size) < 0.6 && gap !== null && gap <= ln.size * 1.5;
          } else if (cur.kind !== 'h' && !mb && !mn && Math.abs(ln.size - cur.size) <= 1) {
            if (cur.kind === 'b' || cur.kind === 'n') {
              join = gap !== null && gap <= typ * 1.45 && ln.x > cur.x + body * 0.4;
            } else {
              join = gap !== null ? gap <= typ * 1.45 : !TERM.test(cur.text);
            }
          }
        }

        if (join) {
          cur.text = glue(cur.text, ln.text);
        } else {
          if (head) cur = { kind: 'h', size: ln.size, text: ln.text, x: ln.x };
          else if (mb) cur = { kind: 'b', size: ln.size, text: mb[2], x: ln.x };
          else if (mn) cur = { kind: 'n', num: mn[1], size: ln.size, text: mn[2], x: ln.x };
          else cur = { kind: 'p', size: ln.size, text: ln.text, x: ln.x };
          blocks.push(cur);
        }
        prev = ln;
      });
    });

    const hs = Array.from(new Set(blocks.filter(b => b.kind === 'h').map(b => r05(b.size)))).sort((a, b) => b - a);
    blocks.forEach(b => { if (b.kind === 'h') b.level = r05(b.size) === hs[0] ? 1 : 2; });
    return blocks;
  }

  function toText(blocks) {
    const out = [];
    let prevKind = '';
    blocks.forEach(b => {
      const text = b.text.trim();
      if (!text) return;
      const list = b.kind === 'b' || b.kind === 'n';
      if (out.length && !(list && (prevKind === 'b' || prevKind === 'n'))) out.push('');
      if (b.kind === 'h') out.push((b.level === 1 ? '# ' : '## ') + text);
      else if (b.kind === 'b') out.push('- ' + text);
      else if (b.kind === 'n') out.push(b.num + '. ' + text);
      else out.push(text);
      prevKind = b.kind;
    });
    return out.join('\n');
  }

  /* ---------- Extract ---------- */
  async function extract(file) {
    showProg('PDF library load ho rahi hai...', 3);
    const lib = await getLib();
    if (cancelled) throw new Error('CANCELLED');
    showProg('PDF khul rahi hai...', 8);
    const buf = new Uint8Array(await file.arrayBuffer());
    const pdf = await lib.getDocument({ data: buf }).promise;
    const total = pdf.numPages;
    const n = Math.min(total, MAX_PAGES);
    const pages = [];
    try {
      for (let p = 1; p <= n; p++) {
        if (cancelled) throw new Error('CANCELLED');
        showProg('Page ' + p + ' / ' + n + ' padh raha hoon...', Math.round(10 + 80 * p / n));
        const page = await pdf.getPage(p);
        const tc = await page.getTextContent();
        const vp = page.getViewport({ scale: 1 });
        pages.push({ H: vp.height, lines: buildLines(tc.items) });
        page.cleanup();
        if (p % 5 === 0) await tick();
      }
    } finally {
      try { pdf.destroy(); } catch (e) { /* ignore */ }
    }

    showProg('Text taiyaar ho raha hai...', 94);
    await tick();
    let removed = 0;
    if (opt.hf) removed = stripHF(pages);
    const totalChars = pages.reduce((a, pg) => a + pg.lines.reduce((b, l) => b + l.text.length, 0), 0);
    if (totalChars < Math.max(40, 15 * n)) return { empty: true };

    const body = bodySize(pages);
    const typ = typicalGap(pages, body);
    const blocks = build(pages, body, typ);
    const text = toText(blocks);
    return {
      empty: false, text: text, pages: n, total: total, removed: removed,
      heads: blocks.filter(b => b.kind === 'h').length,
      words: text.split(/\s+/).filter(Boolean).length
    };
  }

  /* ---------- Text box mein daalo ---------- */
  function cut(t) { return Array.from(t).slice(0, MAX_CHARS).join(''); }

  async function place(r, name) {
    let t = r.text;
    let mode = 'replace';
    if (ta.value.trim()) {
      mode = await choose('Text box mein pehle se text hai. PDF ka text kahan daalein?');
      if (!mode) { toast('PDF ka text nahi daala gaya'); return; }
    }
    if (mode === 'add') t = ta.value.replace(/\s+$/, '') + '\n\n' + t;
    let cutDone = false;
    if (Array.from(t).length > MAX_CHARS) { t = cut(t); cutDone = true; }
    ta.value = t;
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    status.textContent = 'Last PDF: ' + name + '  •  ' + r.pages + ' pages  •  ' + r.words + ' words  •  ' + r.heads + ' headings';
    toast('PDF ka text aa gaya (' + r.words + ' words, ' + r.heads + ' headings)', 'success');
    if (r.total > r.pages) toast('Sirf pehle ' + r.pages + ' pages liye gaye', 'info');
    if (cutDone) toast('Text bahut bada tha, ' + MAX_CHARS + ' characters tak hi liya', 'error');
  }

  function fail(e) {
    const m = e && e.message, n = e && e.name;
    if (m === 'CANCELLED') toast('PDF cancel ho gayi');
    else if (m === 'NOLIB') toast('PDF library load nahi hui. Internet check karke dobara try karo', 'error');
    else if (n === 'PasswordException') toast('Ye PDF password se locked hai', 'error');
    else if (n === 'InvalidPDFException') toast('Ye valid PDF file nahi lagti', 'error');
    else { console.error(e); toast('PDF padhne mein error aaya. Dusri PDF try karo', 'error'); }
  }

  async function run(file) {
    if (busy) return;
    if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') { toast('Sirf PDF file chuno', 'error'); return; }
    if (file.size > MAX_MB * 1024 * 1024) { toast('PDF ' + MAX_MB + 'MB se badi hai', 'error'); return; }
    busy = true;
    cancelled = false;
    try {
      const r = await extract(file);
      hideProg();
      if (r.empty) {
        alert('Is PDF mein text nahi mila. Shayad ye scan ya photo wali PDF hai (har page ek image hai). Abhi OCR support nahi hai, to sirf asli text wali PDF chalti hai.');
      } else {
        await place(r, file.name);
      }
    } catch (e) {
      fail(e);
    } finally {
      hideProg();
      busy = false;
    }
  }

  fileIn.addEventListener('change', () => {
    const f = fileIn.files && fileIn.files[0];
    fileIn.value = '';
    if (f) run(f);
  });

  W.pdfin = { run: run };
})();
