(function () {
  'use strict';

  /* ================= DEFAULT SETTINGS =================
     Page size A4 at 96 dpi = 794 x 1123 units.
     Aage ke steps mein ye settings paper/pen/font menu se badlengi. */
  const DEFAULTS = {
    pageW: 794, pageH: 1123,
    paperColor: '#fffef9',
    lines: true, lineColor: '#b8c7e8',
    marginLine: true, marginColor: '#e06666', marginX: 76,
    top: 110, bottom: 60, left: 96, right: 44,
    lineSpacing: 34,
    fontFamily: '"Caveat","Kalam",cursive',
    fontSize: 26, charSpacing: 0.4,
    colors: { body: '#1d3fbb', heading: '#0b1f6b', sub: '#0b1f6b' },
    opacity: 0.92, ink: 0.25,
    imperfect: true, seed: 7
  };

  function merge(over) {
    const s = Object.assign({}, DEFAULTS, over || {});
    s.colors = Object.assign({}, DEFAULTS.colors, (over && over.colors) || {});
    return s;
  }

  /* Seeded random: same text = same look (preview aur PDF match karenge) */
  function mulberry32(a) {
    return function () {
      let t = a += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  /* ================= TEXT MEASURE ================= */
  const DEVA = /[\u0900-\u097F]/;
  const segmenter = (typeof Intl !== 'undefined' && Intl.Segmenter)
    ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;

  function clusters(str) {
    if (segmenter) return Array.from(segmenter.segment(str), x => x.segment);
    return Array.from(str);
  }

  const mctx = document.createElement('canvas').getContext('2d');
  const cache = new Map();
  function cw(ch, font) {
    const k = font + '|' + ch;
    let w = cache.get(k);
    if (w === undefined) {
      mctx.font = font;
      w = mctx.measureText(ch).width;
      cache.set(k, w);
    }
    return w;
  }
  function spaceW(font, size, s) {
    return Math.max(cw(' ', font), size * 0.28) + s.charSpacing;
  }

  /* ================= FONT LOADING ================= */
  async function ensureFonts(s) {
    try {
      if (document.fonts && document.fonts.load) {
        const names = [];
        s.fontFamily.replace(/"([^"]+)"/g, (m, n) => { names.push(n); return m; });
        await Promise.all(names.map(n => document.fonts.load('26px "' + n + '"', 'Abc अआक')));
        await document.fonts.ready;
      }
    } catch (e) { /* fallback font use hoga */ }
    cache.clear();
  }

  /* ================= WORD WRAP ================= */
  function wrap(text, size, maxW, s) {
    const font = size + 'px ' + s.fontFamily;
    const sp = s.charSpacing;
    const sw = spaceW(font, size, s);
    const words = text.split(/\s+/).filter(Boolean);
    const out = [];
    let cur = [], curW = 0;

    function pushLine() { out.push(cur.join(' ')); cur = []; curW = 0; }

    for (const word of words) {
      const cl = clusters(word);
      let ww = 0;
      for (const c of cl) ww += cw(c, font) + sp;

      if (ww > maxW) {                       // bahut lamba word: todo
        if (cur.length) pushLine();
        let part = '', pw = 0;
        for (const c of cl) {
          const w = cw(c, font) + sp;
          if (pw + w > maxW && part) { out.push(part); part = ''; pw = 0; }
          part += c; pw += w;
        }
        if (part) { cur = [part]; curW = pw; }
        continue;
      }
      const need = cur.length ? curW + sw + ww : ww;
      if (need > maxW && cur.length) { pushLine(); cur = [word]; curW = ww; }
      else { cur.push(word); curW = need; }
    }
    if (cur.length) pushLine();
    return out;
  }

  /* ================= LAYOUT + PAGES ================= */
  function linesPerPage(s) {
    return Math.floor((s.pageH - s.bottom - s.top) / s.lineSpacing) + 1;
  }

  function paginate(lines, s) {
    const cap = linesPerPage(s);
    const pages = [];
    let cur = [];
    const nextPage = () => { pages.push(cur); cur = []; };

    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (l.type === 'space' && cur.length === 0) continue;
      if (cur.length >= cap) {
        nextPage();
        if (l.type === 'space') continue;
      }
      // heading page ke aakhri line par akeli na rahe
      if (l.keep && cur.length === cap - 1 && i < lines.length - 1) nextPage();
      cur.push(l);
    }
    if (cur.length) pages.push(cur);
    if (!pages.length) pages.push([]);
    return pages;
  }

  function layout(blocks, s) {
    const textW = s.pageW - s.left - s.right;
    const lines = [];
    for (const b of blocks) {
      if (b.type === 'space') { lines.push({ type: 'space' }); continue; }
      let size = s.fontSize, role = 'body', indent = 0, marker = null;
      let underline = false, keep = false;
      if (b.type === 'heading') { size = Math.round(s.fontSize * 1.3); role = 'heading'; underline = true; keep = true; }
      else if (b.type === 'subheading') { size = Math.round(s.fontSize * 1.12); role = 'sub'; keep = true; }
      else if (b.type === 'number') { indent = 42; marker = b.num + '.'; }
      else if (b.type === 'bullet') { indent = 34; marker = '•'; }

      const wrapped = wrap(b.text, size, textW - indent, s);
      wrapped.forEach((t, i) => {
        lines.push({
          type: b.type, text: t, size: size, role: role, indent: indent,
          marker: i === 0 ? marker : null, underline: underline,
          keep: keep && i === wrapped.length - 1
        });
      });
    }
    return paginate(lines, s);
  }

  /* ================= DRAWING ================= */
  function putText(ctx, str, startX, y, size, color, s, rand, slope) {
    const font = size + 'px ' + s.fontFamily;
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    let x = startX;
    for (const c of clusters(str)) {
      if (c === ' ') { x += spaceW(font, size, s); continue; }
      const w = cw(c, font);
      const deva = DEVA.test(c);
      // Hindi mein rotation nahi (shirorekha line na toote)
      const wob = s.imperfect && !deva;
      const jx = wob ? (rand() - 0.5) * 1.0 : 0;
      const jy = wob ? (rand() - 0.5) * 2.0 : 0;
      const rot = wob ? (rand() - 0.5) * 0.05 : 0;
      const sc = wob ? 1 + (rand() - 0.5) * 0.06 : 1;
      const alpha = s.imperfect ? s.opacity * (0.88 + rand() * 0.12) : s.opacity;

      ctx.save();
      ctx.translate(x + jx, y + jy + (x - startX) * slope);
      ctx.rotate(rot);
      ctx.scale(sc, sc);
      ctx.globalAlpha = alpha;
      ctx.fillText(c, 0, 0);
      if (s.ink > 0) {
        ctx.lineWidth = s.ink;
        ctx.lineJoin = 'round';
        ctx.strokeText(c, 0, 0);
      }
      ctx.restore();
      x += w + s.charSpacing;
    }
    return x;
  }

  function drawLine(ctx, l, lineY, s, rand) {
    const color = s.colors[l.role] || s.colors.body;
    const slope = s.imperfect ? (rand() - 0.5) * 0.0016 : 0;
    const baseY = lineY - 5 + (s.imperfect ? (rand() - 0.5) * 1.6 : 0);

    if (l.marker === '•') {
      ctx.save();
      ctx.globalAlpha = s.opacity;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(s.left + 14, baseY - l.size * 0.26, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else if (l.marker) {
      putText(ctx, l.marker, s.left + 2, baseY, l.size, color, s, rand, slope);
    }

    const startX = s.left + l.indent;
    const endX = putText(ctx, l.text, startX, baseY, l.size, color, s, rand, slope);

    if (l.underline) {
      const uy = baseY + 3;
      ctx.save();
      ctx.globalAlpha = s.opacity * 0.75;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(startX, uy);
      ctx.quadraticCurveTo((startX + endX) / 2, uy + (s.imperfect ? 1.5 : 0), endX, uy - (s.imperfect ? 1 : 0));
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawPage(canvas, lines, s, pageIndex, scale) {
    scale = scale || 2;
    canvas.width = Math.round(s.pageW * scale);
    canvas.height = Math.round(s.pageH * scale);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(scale, 0, 0, scale, 0, 0);

    ctx.fillStyle = s.paperColor;
    ctx.fillRect(0, 0, s.pageW, s.pageH);

    if (s.lines) {
      ctx.strokeStyle = s.lineColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let y = s.top; y <= s.pageH - s.bottom + 0.5; y += s.lineSpacing) {
        ctx.moveTo(0, y + 0.5);
        ctx.lineTo(s.pageW, y + 0.5);
      }
      ctx.stroke();
    }
    if (s.marginLine) {
      ctx.strokeStyle = s.marginColor;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(s.marginX, 0);
      ctx.lineTo(s.marginX, s.pageH);
      ctx.stroke();
    }

    const rand = mulberry32(s.seed + pageIndex * 9973);
    ctx.textBaseline = 'alphabetic';
    lines.forEach((l, i) => {
      if (l.type === 'space') return;
      drawLine(ctx, l, s.top + i * s.lineSpacing, s, rand);
    });
  }

  async function renderAll(blocks, over) {
    const s = merge(over);
    await ensureFonts(s);
    return { settings: s, pages: layout(blocks, s) };
  }

  window.WMN = window.WMN || {};
  window.WMN.engine = {
    DEFAULTS: DEFAULTS, merge: merge, layout: layout,
    drawPage: drawPage, renderAll: renderAll, ensureFonts: ensureFonts
  };

  /* ================= TEST PREVIEW (Step 4) =================
     Step 7 mein ye poore live preview se replace hoga. */
  const canvas = document.getElementById('pvCanvas');
  if (!canvas) return;
  const label = document.getElementById('pvLabel');
  const prev = document.getElementById('pvPrev');
  const next = document.getElementById('pvNext');
  const imperfectBox = document.getElementById('pvImperfect');
  const E = window.WMN.engine;
  const state = { pages: [[]], settings: merge(), index: 0 };
  let busy = false, again = false, timer = null;

  function show() {
    const i = state.index;
    drawPage(canvas, state.pages[i], state.settings, i, 2);
    label.textContent = 'Page ' + (i + 1) + ' / ' + state.pages.length;
    prev.disabled = i <= 0;
    next.disabled = i >= state.pages.length - 1;
  }

  async function refresh() {
    if (busy) { again = true; return; }
    busy = true;
    try {
      if (!window.WMN.parseText) throw new Error('editor.js load nahi hua');
      const blocks = window.WMN.parseText(window.WMN.getText());
      const r = await E.renderAll(blocks, { imperfect: imperfectBox.checked });
      state.pages = r.pages;
      state.settings = r.settings;
      if (state.index >= state.pages.length) state.index = state.pages.length - 1;
      show();
    } catch (err) {
      console.error(err);
      toast('Preview banane mein error aaya', 'error');
    }
    busy = false;
    if (again) { again = false; refresh(); }
  }

  function later(ms) { clearTimeout(timer); timer = setTimeout(refresh, ms || 150); }

  prev.addEventListener('click', () => { if (state.index > 0) { state.index--; show(); } });
  next.addEventListener('click', () => { if (state.index < state.pages.length - 1) { state.index++; show(); } });
  document.getElementById('pvRefresh').addEventListener('click', () => { refresh(); toast('Preview refresh ho gaya', 'success'); });
  imperfectBox.addEventListener('change', refresh);

  // Editor jab text save karta hai ("✓ Saved"), preview apne aap update hota hai
  const saveEl = document.getElementById('saveState');
  if (saveEl) {
    new MutationObserver(() => {
      if (saveEl.textContent.indexOf('Saved') !== -1) later(150);
    }).observe(saveEl, { childList: true, characterData: true, subtree: true });
  }

  refresh();
})();
