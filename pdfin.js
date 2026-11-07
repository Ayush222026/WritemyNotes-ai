(function () {
  'use strict';
  const W = window.WMN;
  const ta = document.getElementById('textInput');
  const textCard = ta ? ta.closest('.card') : null;
  if (!W || !ta || !textCard) { console.error('Pehle ki files load nahi hui'); return; }

  const LIB = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
  const WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const MAX_CHARS = 300000, MAX_PAGES = 150, MAX_MB = 25, MAX_PDF_IMAGES = 60;

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
  const opt = { hf: true, hy: true, img: true };
  try {
    const o = JSON.parse(load('wmn_pdfin') || 'null');
    if (o && typeof o === 'object') {
      ['hf', 'hy', 'img'].forEach(k => { if (typeof o[k] === 'boolean') opt[k] = o[k]; });
    }
  } catch (e) { /* default */ }
  function saveOpt() { store('wmn_pdfin', JSON.stringify(opt)); }

  /* ---------- Card ---------- */
  const card = mk('div', 'card');
  card.id = 'pdfInCard';
  card.appendChild(mk('h3', '', '📄 PDF se text aur images'));
  card.appendChild(mk('p', 'muted', 'PDF chuno. App uska text aur images nikal ke text box mein daal dega. Bade font wali lines heading ban jaati hain, baaki Smart Detect pehchanta hai.'));

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
  check('PDF ki images bhi lo (photos, diagrams)', 'img');
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

  /* ---------- Page ki images dhundo (operator list se) ---------- */
  function mulPdf(M, C) {
    return [
      M[0] * C[0] + M[1] * C[2], M[0] * C[1] + M[1] * C[3],
      M[2] * C[0] + M[3] * C[2], M[2] * C[1] + M[3] * C[3],
      M[4] * C[0] + M[5] * C[2] + C[4], M[4] * C[1] + M[5] * C[3] + C[5]
    ];
  }

  async function findImages(page, OPS) {
    const ol = await page.getOperatorList();
    const fa = ol.fnArray, aa = ol.argsArray;
    const res = [];
    let ctm = [1, 0, 0, 1, 0, 0];
    const stack = [];
    for (let i = 0; i < fa.length; i++) {
      const f = fa[i], a = aa[i];
      if (f === OPS.save) stack.push(ctm.slice());
      else if (f === OPS.restore) { if (stack.length) ctm = stack.pop(); }
      else if (f === OPS.transform) ctm = mulPdf(a, ctm);
      else if (f === OPS.paintFormXObjectBegin) { stack.push(ctm.slice()); if (a && a[0]) ctm = mulPdf(a[0], ctm); }
      else if (f === OPS.paintFormXObjectEnd) { if (stack.length) ctm = stack.pop(); }
      else if (f === OPS.paintImageXObject || f === OPS.paintInlineImageXObject) {
        let pw = 0, ph = 0;
        if (f === OPS.paintImageXObject) { pw = (a && a[1]) || 0; ph = (a && a[2]) || 0; }
        else if (a && a[0]) { pw = a[0].width || 0; ph = a[0].height || 0; }
        const xs = [], ys = [];
        [[0, 0], [1, 0], [0, 1], [1, 1]].forEach(p => {
          xs.push(ctm[0] * p[0] + ctm[2] * p[1] + ctm[4]);
          ys.push(ctm[1] * p[0] + ctm[3] * p[1] + ctm[5]);
        });
        res.push({ x0: Math.min.apply(null, xs), x1: Math.max.apply(null, xs), y0: Math.min.apply(null, ys), y1: Math.max.apply(null, ys), pw: pw, ph: ph });
      }
    }
    return res;
  }

  function overlap(a, b) {
    const w = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
    const h = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
    if (w <= 0 || h <= 0) return 0;
    const ia = w * h;
    return ia / Math.min((a.x1 - a.x0) * (a.y1 - a.y0), (b.x1 - b.x0) * (b.y1 - b.y0));
  }

  /* Chhoti icons, poore page ka background, aur har page par repeat hone wale logo hatao */
  function filterImages(pages) {
    const keyOf = c => Math.round((c.x1 - c.x0) / 8) + 'x' + Math.round((c.y1 - c.y0) / 8) + '@' + Math.round(c.x0 / 12) + ',' + Math.round(c.y0 / 12);
    const cnt = new Map();
    pages.forEach(pg => {
      new Set((pg.cand || []).map(keyOf)).forEach(k => cnt.set(k, (cnt.get(k) || 0) + 1));
    });
    const need = Math.max(2, Math.ceil(pages.length * 0.5));
    pages.forEach(pg => {
      const area = pg.Wd * pg.H;
      const keep = [];
      (pg.cand || []).forEach(c => {
        const w = c.x1 - c.x0, h = c.y1 - c.y0;
        if (w < 36 || h < 36) return;
        if (c.pw && c.ph && c.pw < 40 && c.ph < 40) return;
        if (w * h > area * 0.85) return;
        if (pages.length >= 3 && cnt.get(keyOf(c)) >= need) return;
        if (keep.some(k => overlap(k, c) > 0.9)) return;
        keep.push(c);
      });
      pg.keep = keep;
    });
  }

  /* Page ko render karke image wali jagah crop karo, aur library mein save karo */
  async function cropImages(pdf, pages) {
    let made = 0, full = false;
    const withImg = pages.filter(pg => pg.keep && pg.keep.length).length;
    let doneP = 0;
    for (let p = 0; p < pages.length && !full; p++) {
      const pg = pages[p];
      if (!pg.keep || !pg.keep.length) continue;
      if (cancelled) throw new Error('CANCELLED');
      doneP++;
      showProg('Images nikal raha hoon... (' + doneP + ' / ' + withImg + ' pages)', Math.round(84 + 14 * doneP / withImg));
      const page = await pdf.getPage(p + 1);
      const vp = page.getViewport({ scale: 2.5 });
      const cv = document.createElement('canvas');
      cv.width = Math.ceil(vp.width); cv.height = Math.ceil(vp.height);
      const cx = cv.getContext('2d');
      cx.fillStyle = '#fff';
      cx.fillRect(0, 0, cv.width, cv.height);
      await page.render({ canvasContext: cx, viewport: vp }).promise;
      pg.imgs = [];
      for (const c of pg.keep) {
        if (made >= MAX_PDF_IMAGES) { full = true; break; }
        const r = vp.convertToViewportRectangle([c.x0, c.y0, c.x1, c.y1]);
        const rx0 = Math.max(0, Math.floor(Math.min(r[0], r[2])));
        const ry0 = Math.max(0, Math.floor(Math.min(r[1], r[3])));
        const rx1 = Math.min(cv.width, Math.ceil(Math.max(r[0], r[2])));
        const ry1 = Math.min(cv.height, Math.ceil(Math.max(r[1], r[3])));
        const w = rx1 - rx0, h = ry1 - ry0;
        if (w < 40 || h < 40) continue;
        const piece = document.createElement('canvas');
        piece.width = w; piece.height = h;
        piece.getContext('2d').drawImage(cv, rx0, ry0, w, h, 0, 0, w, h);
        try {
          const id = await W.images.add(piece, 'PDF page ' + (p + 1), false);
          pg.imgs.push({ id: id, cy: (c.y0 + c.y1) / 2 });
          made++;
        } catch (e) {
          if (e && e.message === 'FULL') { full = true; break; }
          console.error(e);
        }
      }
      cv.width = 0; cv.height = 0;
      page.cleanup();
      await tick();
    }
    return { made: made, full: full };
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

  /* ---------- Lines + images -> blocks ---------- */
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
      const imgs = (pg.imgs || []).slice().sort((a, b) => b.cy - a.cy);
      let ip = 0;
      const flush = y => {
        while (ip < imgs.length && imgs[ip].cy >= y) {
          blocks.push({ kind: 'i', id: imgs[ip].id });
          cur = null; prev = null; ip++;
        }
      };
      pg.lines.forEach((ln, li) => {
        flush(ln.y);
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
      flush(-Infinity);
    });

    const hs = Array.from(new Set(blocks.filter(b => b.kind === 'h').map(b => r05(b.size)))).sort((a, b) => b - a);
    blocks.forEach(b => { if (b.kind === 'h') b.level = r05(b.size) === hs[0] ? 1 : 2; });
    return blocks;
  }

  function toText(blocks) {
    const out = [];
    let prevKind = '';
    blocks.forEach(b => {
      if (b.kind === 'i') {
        if (out.length) out.push('');
        out.push('[[img:' + b.id + ']]');
        prevKind = 'i';
        return;
      }
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
    const wantImg = !!(opt.img && W.images && W.images.add);
    let imgMade = 0, imgFull = false, removed = 0;

    try {
      for (let p = 1; p <= n; p++) {
        if (cancelled) throw new Error('CANCELLED');
        showProg('Page ' + p + ' / ' + n + ' padh raha hoon...', Math.round(10 + 70 * p / n));
        const page = await pdf.getPage(p);
        const tc = await page.getTextContent();
        const vp = page.getViewport({ scale: 1 });
        let cand = [];
        if (wantImg) {
          try { cand = await findImages(page, lib.OPS); } catch (e) { cand = []; }
        }
        pages.push({ H: vp.height, Wd: vp.width, lines: buildLines(tc.items), cand: cand });
        page.cleanup();
        if (p % 5 === 0) await tick();
      }

      showProg('Text taiyaar ho raha hai...', 82);
      await tick();
      if (opt.hf) removed = stripHF(pages);
      const totalChars = pages.reduce((a, pg) => a + pg.lines.reduce((b, l) => b + l.text.length, 0), 0);
      if (totalChars < Math.max(40, 15 * n)) return { empty: true };

      if (wantImg) {
        filterImages(pages);
        const r = await cropImages(pdf, pages);
        imgMade = r.made; imgFull = r.full;
      }
    } finally {
      try { pdf.destroy(); } catch (e) { /* ignore */ }
    }

    const body = bodySize(pages);
    const typ = typicalGap(pages, body);
    const blocks = build(pages, body, typ);
    const text = toText(blocks);
    return {
      empty: false, text: text, pages: n, total: total, removed: removed,
      heads: blocks.filter(b => b.kind === 'h').length,
      images: imgMade, imgFull: imgFull, noImgLib: !!(opt.img && !(W.images && W.images.add)),
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
    ta.dispatchEvent(new Event('input', { bubbl
