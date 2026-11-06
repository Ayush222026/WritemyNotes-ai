
(function () {
  'use strict';

  /* ================= DEFAULT SETTINGS =================
     Units: A4 at 96 dpi = 794 x 1123.
     Paper settings paper.js se, pen settings pen.js se aati hain. */

  const DEFAULTS = {
    pageW: 794, pageH: 1123,
    paperColor: '#fffef9',
    lineStyle: 'single', lineColor: '#b8c7e8', lineW: 1,
    marginLine: true, marginColor: '#e06666', marginX: 76,
    spiral: false, topLine: false, thumb: false,
    top: 110, bottom: 60, left: 96, right: 44,
    lineSpacing: 34,
    fontFamily: '"Caveat","Kalam",cursive',
    fontSize: 26, fontScale: 1, charSpacing: 0.4,
    multi: false,
    colors: {
      body: '#1d3fbb',
      heading: '#1d3fbb',
      sub: '#1d3fbb',
      def: '#1d3fbb',
      warn: '#1d3fbb'
    },
    opacity: 0.92, ink: 0.25, texture: 'ballpoint',
    imperfect: true, seed: 7
  };

  /* ================= PEN TEXTURES ================= */

  const TEX = {
    none:      { aj: 0,    w: 0,    dots: 0,  am: 1 },
    ballpoint: { aj: 0.12, w: 0,    dots: 6,  am: 1 },
    gel:       { aj: 0.04, w: 0.15, dots: 0,  am: 1.05 },
    fountain:  { aj: 0.2,  w: 0.35, dots: 0,  am: 1 },
    pencil:    { aj: 0.22, w: 0,    dots: 34, am: 0.82 }
  };

  const DEF_RE = /^(definition|def\.?|important|key point|formula|meaning|परिभाषा|महत्वपूर्ण)\s*[:\-–—]/i;
  const WARN_RE = /^(warning|caution|danger|note|careful|सावधान|चेतावनी|ध्यान दें)\s*[:\-–—]/i;

  function merge(over) {
    const s = Object.assign({}, DEFAULTS, over || {});
    s.colors = Object.assign({}, DEFAULTS.colors, (over && over.colors) || {});
    return s;
  }

  /* ================= SEEDED RANDOM ================= */

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
    ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    : null;

  function clusters(str) {
    if (segmenter) {
      return Array.from(segmenter.segment(str), x => x.segment);
    }
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

        s.fontFamily.replace(/"([^"]+)"/g, (m, n) => {
          names.push(n);
          return m;
        });

        await Promise.all(
          names.map(name =>
            document.fonts.load(
              '40px "' + name + '"',
              'Hello 123'
            )
          )
        );

        await document.fonts.ready;
      }
    } catch (e) {
      console.warn('Font loading issue, fallback font use hoga:', e);
    }

    cache.clear();
  }

  /* ================= WORD WRAP ================= */

  function wrap(text, size, maxW, s) {
    const font = size + 'px ' + s.fontFamily;
    const sp = s.charSpacing;
    const sw = spaceW(font, size, s);
    const words = text.split(/\s+/).filter(Boolean);
    const out = [];

    let cur = [];
    let curW = 0;

    function pushLine() {
      out.push(cur.join(' '));
      cur = [];
      curW = 0;
    }

    for (const word of words) {
      const cl = clusters(word);
      let ww = 0;

      for (const c of cl) {
        ww += cw(c, font) + sp;
      }

      if (ww > maxW) {
        if (cur.length) pushLine();

        let part = '';
        let pw = 0;

        for (const c of cl) {
          const w = cw(c, font) + sp;

          if (pw + w > maxW && part) {
            out.push(part);
            part = '';
            pw = 0;
          }

          part += c;
          pw += w;
        }

        if (part) {
          cur = [part];
          curW = pw;
        }

        continue;
      }

      const need = cur.length ? curW + sw + ww : ww;

      if (need > maxW && cur.length) {
        pushLine();
        cur = [word];
        curW = ww;
      } else {
        cur.push(word);
        curW = need;
      }
    }

    if (cur.length) pushLine();

    return out;
  }

  /* ================= LAYOUT + PAGES ================= */

  function linesPerPage(s) {
    return Math.max(
      1,
      Math.floor((s.pageH - s.bottom - s.top) / s.lineSpacing) + 1
    );
  }

  function paginate(lines, s) {
    const cap = linesPerPage(s);
    const pages = [];
    let cur = [];

    const nextPage = () => {
      pages.push(cur);
      cur = [];
    };

    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];

      if (l.type === 'space' && cur.length === 0) continue;

      if (cur.length >= cap) {
        nextPage();
        if (l.type === 'space') continue;
      }

      if (l.keep && cur.length === cap - 1 && i < lines.length - 1) {
        nextPage();
      }

      cur.push(l);
    }

    if (cur.length) pages.push(cur);
    if (!pages.length) pages.push([]);

    return pages;
  }

  function bodyRole(b, s) {
    if (!s.multi) return 'body';
    if (DEF_RE.test(b.text)) return 'def';
    if (WARN_RE.test(b.text)) return 'warn';
    return 'body';
  }

  function layout(blocks, s) {
    const textW = s.pageW - s.left - s.right;
    const base = s.fontSize * (s.fontScale || 1);
    const lines = [];

    for (const b of blocks) {
      if (b.type === 'space') {
        lines.push({ type: 'space' });
        continue;
      }

      let size = Math.round(base);
      let role = bodyRole(b, s);
      let indent = 0;
      let marker = null;
      let underline = false;
      let keep = false;

      if (b.type === 'heading') {
        size = Math.round(base * 1.3);
        role = 'heading';
        underline = true;
        keep = true;
      } else if (b.type === 'subheading') {
        size = Math.round(base * 1.12);
        role = 'sub';
        keep = true;
      } else if (b.type === 'number') {
        indent = 42;
        marker = b.num + '.';
      } else if (b.type === 'bullet') {
        indent = 34;
        marker = '•';
      }

      const wrapped = wrap(b.text, size, textW - indent, s);

      wrapped.forEach((t, i) => {
        lines.push({
          type: b.type,
          text: t,
          size: size,
          role: role,
          indent: indent,
          marker: i === 0 ? marker : null,
          underline: underline,
          keep: keep && i === wrapped.length - 1
        });
      });
    }

    return paginate(lines, s);
  }

  /* ================= DRAWING ================= */

  function putText(ctx, str, startX, y, size, color, s, rand, slope) {
    const T = TEX[s.texture] || TEX.ballpoint;
    const baseA = Math.min(1, s.opacity * T.am);
    const inkW = Math.max(0, s.ink + T.w);
    const font = size + 'px ' + s.fontFamily;

    ctx.font = font;
    ctx.fillStyle = color;
    ctx.strokeStyle = color;

    let x = startX;

    for (const c of clusters(str)) {
      if (c === ' ') {
        x += spaceW(font, size, s);
        continue;
      }

      const w = cw(c, font);
      const deva = DEVA.test(c);
      const wob = s.imperfect && !deva;

      const jx = wob ? (rand() - 0.5) * 1.0 : 0;
      const jy = wob ? (rand() - 0.5) * 2.0 : 0;
      const rot = wob ? (rand() - 0.5) * 0.05 : 0;
      const sc = wob ? 1 + (rand() - 0.5) * 0.06 : 1;

      const alpha = s.imperfect
        ? Math.min(1, baseA * (1 - T.aj + rand() * T.aj))
        : baseA;

      ctx.save();
      ctx.translate(x + jx, y + jy + (x - startX) * slope);
      ctx.rotate(rot);
      ctx.scale(sc, sc);
      ctx.globalAlpha = alpha;

      ctx.fillText(c, 0, 0);

      if (inkW > 0) {
        ctx.lineWidth = inkW;
        ctx.lineJoin = 'round';
        ctx.strokeText(c, 0, 0);
      }

      ctx.restore();

      x += w + s.charSpacing;
    }

    return x;
  }

  /* ================= PEN TEXTURE SPECKLES ================= */

  function speckle(ctx, startX, endX, baseY, size, s, rand) {
    const T = TEX[s.texture] || TEX.ballpoint;

    if (!T.dots || endX <= startX) return;

    const n = Math.round((endX - startX) / 100 * T.dots);

    ctx.save();
    ctx.fillStyle = s.paperColor;
    ctx.globalAlpha = 0.55;

    for (let i = 0; i < n; i++) {
      const x = startX + rand() * (endX - startX);
      const y = baseY - rand() * size * 0.85;
      ctx.fillRect(x, y, 0.9, 0.9);
    }

    ctx.restore();
  }

  function drawLine(ctx, l, lineY, s, rand) {
    const T = TEX[s.texture] || TEX.ballpoint;
    const color = s.colors[l.role] || s.colors.body;
    const slope = s.imperfect ? (rand() - 0.5) * 0.0016 : 0;
    const baseY = lineY - 5 + (s.imperfect ? (rand() - 0.5) * 1.6 : 0);
    const dotAlpha = Math.min(1, s.opacity * T.am);

    if (l.marker === '•') {
      ctx.save();
      ctx.globalAlpha = dotAlpha;
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

      ctx.quadraticCurveTo(
        (startX + endX) / 2,
        uy + (s.imperfect ? 1.5 : 0),
        endX,
        uy - (s.imperfect ? 1 : 0)
      );

      ctx.stroke();
      ctx.restore();
    }

    speckle(ctx, startX, endX, baseY, l.size, s, rand);
  }

  /* ================= SPIRAL ================= */

  function drawSpiral(ctx, s) {
    ctx.save();
    ctx.lineCap = 'round';

    for (let y = 32; y < s.pageH - 12; y += 38) {
      ctx.fillStyle = '#aeb3c0';
      ctx.beginPath();
      ctx.arc(26, y, 6.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#5f6675';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(8, y - 4);
      ctx.lineTo(40, y + 3);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(10, y - 5.2);
      ctx.lineTo(38, y + 1.2);
      ctx.stroke();
    }

    ctx.restore();
  }

  /* ================= PAPER ================= */

  function drawPaper(ctx, s) {
    const lw = s.lineW || 1;

    ctx.fillStyle = s.paperColor;
    ctx.fillRect(0, 0, s.pageW, s.pageH);

    const x0 = s.spiral ? 46 : 0;

    if (s.lineStyle !== 'none') {
      ctx.strokeStyle = s.lineColor;
      ctx.lineWidth = lw;
      ctx.beginPath();

      for (let y = s.top; y <= s.pageH - s.bottom + 0.5; y += s.lineSpacing) {
        ctx.moveTo(x0, y + 0.5);
        ctx.lineTo(s.pageW, y + 0.5);
      }

      ctx.stroke();

      if (s.lineStyle === 'double') {
        ctx.save();
        ctx.globalAlpha = 0.65;
        ctx.beginPath();

        const gap = Math.round(s.lineSpacing * 0.5);

        for (let y = s.top; y <= s.pageH - s.bottom + 0.5; y += s.lineSpacing) {
          const y2 = y - gap;

          if (y2 > 2) {
            ctx.moveTo(x0, y2 + 0.5);
            ctx.lineTo(s.pageW, y2 + 0.5);
          }
        }

        ctx.stroke();
        ctx.restore();
      }
    }

    if (s.topLine) {
      const ty = s.top - s.lineSpacing;

      if (ty > 4) {
        ctx.strokeStyle = s.marginColor;
        ctx.lineWidth = lw * 1.5;
        ctx.beginPath();
        ctx.moveTo(x0, ty + 0.5);
        ctx.lineTo(s.pageW, ty + 0.5);
        ctx.stroke();
      }
    }

    if (s.marginLine) {
      ctx.strokeStyle = s.marginColor;
      ctx.lineWidth = lw * 1.5;
      ctx.beginPath();
      ctx.moveTo(s.marginX, 0);
      ctx.lineTo(s.marginX, s.pageH);
      ctx.stroke();
    }

    if (s.spiral) drawSpiral(ctx, s);
  }

  /* ================= DRAW PAGE ================= */

  function drawPage(canvas, lines, s, pageIndex, scale) {
    scale = scale || 2;

    canvas.width = Math.max(1, Math.round(s.pageW * scale));
    canvas.height = Math.max(1, Math.round(s.pageH * scale));

    const ctx = canvas.getContext('2d');
    ctx.setTransform(scale, 0, 0, scale, 0, 0);

    drawPaper(ctx, s);

    const rand = mulberry32(s.seed + pageIndex * 9973);

    ctx.textBaseline = 'alphabetic';

    lines.forEach((l, i) => {
      if (l.type === 'space') return;
      drawLine(ctx, l, s.top + i * s.lineSpacing, s, rand);
    });

    /* Thumbnail ke liye nakli "likhawat" ki patti */

    if (s.thumb) {
      ctx.save();
      ctx.strokeStyle = '#4f6bff';
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = (s.lineW || 1) * 2.6;
      ctx.lineCap = 'round';

      const rows = Math.min(
        7,
        Math.floor((s.pageH - s.top - s.bottom) / s.lineSpacing)
      );

      const full = s.pageW - s.left - s.right;

      for (let i = 0; i < rows; i++) {
        const y = s.top + i * s.lineSpacing - 8;
        const w = full * (i === 0 ? 0.45 : 0.55 + rand() * 0.45);

        ctx.beginPath();
        ctx.moveTo(s.left, y);
        ctx.lineTo(s.left + w, y);
        ctx.stroke();
      }

      ctx.restore();
    }
  }

  /* ================= RENDER ALL ================= */

  async function renderAll(blocks, over) {
    const s = merge(over);

    await ensureFonts(s);

    return {
      settings: s,
      pages: layout(blocks, s)
    };
  }

  /* ================= EXPORT ENGINE ================= */

  window.WMN = window.WMN || {};

  window.WMN.engine = {
    DEFAULTS: DEFAULTS,
    merge: merge,
    layout: layout,
    drawPage: drawPage,
    renderAll: renderAll,
    ensureFonts: ensureFonts
  };

  /* ================= TEST PREVIEW ================= */

  const canvas = document.getElementById('pvCanvas');

  if (!canvas) return;

  const label = document.getElementById('pvLabel');
  const prev = document.getElementById('pvPrev');
  const next = document.getElementById('pvNext');

  const E = window.WMN.engine;

  const state = {
    pages: [[]],
    settings: merge(),
    index: 0
  };

  let busy = false;
  let again = false;
  let timer = null;

  function show() {
    const i = state.index;

    drawPage(
      canvas,
      state.pages[i],
      state.settings,
      i,
      2
    );

    canvas.style.maxWidth =
      Math.round(state.settings.pageW * 0.7) + 'px';

    label.textContent =
      'Page ' + (i + 1) + ' / ' + state.pages.length;

    prev.disabled = i <= 0;
    next.disabled = i >= state.pages.length - 1;
  }

  async function refresh() {
    if (busy) {
      again = true;
      return;
    }

    busy = true;

    try {
      if (!window.WMN.parseText) {
        throw new Error('editor.js load nahi hua');
      }

      const blocks = window.WMN.parseText(window.WMN.getText());

      const all = window.WMN.getSettings
        ? window.WMN.getSettings()
        : {};

      const r = await E.renderAll(blocks, all);

      state.pages = r.pages;
      state.settings = r.settings;

      if (state.index >= state.pages.length) {
        state.index = state.pages.length - 1;
      }

      show();

    } catch (err) {
      console.error(err);
      toast('Preview banane mein error aaya', 'error');
    }

    busy = false;

    if (again) {
      again = false;
      refresh();
    }
  }

  function later(ms) {
    clearTimeout(timer);
    timer = setTimeout(refresh, ms || 150);
  }

  window.WMN.refreshPreview = function () {
    later(80);
  };

  prev.addEventListener('click', () => {
    if (state.index > 0) {
      state.index--;
      show();
    }
  });

  next.addEventListener('click', () => {
    if (state.index < state.pages.length - 1) {
      state.index++;
      show();
    }
  });

  document.getElementById('pvRefresh').addEventListener('click', () => {
    refresh();
    toast('Preview refresh ho gaya', 'success');
  });

  const saveEl = document.getElementById('saveState');

  if (saveEl) {
    new MutationObserver(() => {
      if (saveEl.textContent.indexOf('Saved') !== -1) {
        later(150);
      }
    }).observe(saveEl, {
      childList: true,
      characterData: true,
      subtree: true
    });
  }

  refresh();

})();
      
