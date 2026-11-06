(function () {
  'use strict';
  const E = window.WMN && window.WMN.engine;
  if (!E) { console.error('engine.js load nahi hua'); return; }

  const $id = id => document.getElementById(id);
  const MM = 96 / 25.4;

  const SIZES = {
    a4: { w: 794, h: 1123, wmm: 210, hmm: 297 },
    a5: { w: 559, h: 794, wmm: 148, hmm: 210 },
    letter: { w: 816, h: 1056, wmm: 216, hmm: 279 }
  };

  const BASE = {
    size: 'a4', wmm: 210, hmm: 297,
    paperColor: '#fffef9', lineStyle: 'single', lineColor: '#b8c7e8',
    marginLine: true, spiral: false, topLine: false,
    top: 110, left: 96, right: 44, bottom: 60, lineSpacing: 34
  };
  function P(over) { return Object.assign({}, BASE, over); }

  const TEMPLATES = [
    { id: 'a4-ruled', name: 'A4 Ruled Paper', v: P({}) },
    { id: 'a4-plain', name: 'A4 Plain White Paper', v: P({ paperColor: '#ffffff', lineStyle: 'none', marginLine: false, top: 90, left: 80, right: 60 }) },
    { id: 'a4-spiral', name: 'A4 Spiral Notebook', v: P({ paperColor: '#fffdf5', spiral: true, left: 104 }) },
    { id: 'a5-ruled', name: 'A5 Ruled Paper', v: P({ size: 'a5', wmm: 148, hmm: 210, top: 90, left: 74, right: 34, bottom: 50, lineSpacing: 30 }) },
    { id: 'a5-plain', name: 'A5 Plain Paper', v: P({ size: 'a5', wmm: 148, hmm: 210, paperColor: '#ffffff', lineStyle: 'none', marginLine: false, top: 70, left: 60, right: 44, bottom: 50, lineSpacing: 30 }) },
    { id: 'letter', name: 'Letter Size Paper', v: P({ size: 'letter', wmm: 216, hmm: 279, top: 108, left: 98, right: 46 }) },
    { id: 'indian', name: 'Indian School Notebook', v: P({ paperColor: '#fffdf7', lineColor: '#9db8e0', topLine: true, top: 130 }) },
    { id: 'single', name: 'Single Line Paper', v: P({ paperColor: '#ffffff', lineColor: '#9fb3d9', marginLine: false, top: 100, left: 70, right: 50, lineSpacing: 40 }) },
    { id: 'double', name: 'Double Line Paper', v: P({ paperColor: '#ffffff', lineStyle: 'double', lineColor: '#aebfe0', marginLine: false, top: 120, left: 70, right: 50, lineSpacing: 44 }) },
    { id: 'custom', name: 'Custom Paper', v: null }
  ];

  const COLOR_RE = /^#[0-9a-f]{6}$/i;
  function clamp(n, a, b) { return Math.min(b, Math.max(a, n)); }
  function num(x, def, a, b) {
    const n = Number(x);
    return isFinite(n) ? clamp(n, a, b) : def;
  }

  function sanitize(v) {
    const o = Object.assign({}, BASE);
    if (!v || typeof v !== 'object') return o;
    if (['a4', 'a5', 'letter', 'custom'].indexOf(v.size) !== -1) o.size = v.size;
    o.wmm = num(v.wmm, o.wmm, 100, 420);
    o.hmm = num(v.hmm, o.hmm, 100, 600);
    if (COLOR_RE.test(v.paperColor)) o.paperColor = v.paperColor;
    if (COLOR_RE.test(v.lineColor)) o.lineColor = v.lineColor;
    if (['none', 'single', 'double'].indexOf(v.lineStyle) !== -1) o.lineStyle = v.lineStyle;
    o.marginLine = !!v.marginLine;
    o.spiral = !!v.spiral;
    o.topLine = !!v.topLine;
    o.top = num(v.top, o.top, 40, 250);
    o.left = num(v.left, o.left, 40, 200);
    o.right = num(v.right, o.right, 20, 150);
    o.bottom = num(v.bottom, o.bottom, 30, 120);
    o.lineSpacing = num(v.lineSpacing, o.lineSpacing, 24, 60);
    return o;
  }

  /* Paper settings -> engine settings */
  function settingsFrom(v) {
    const sz = v.size === 'custom'
      ? { w: Math.round(v.wmm * MM), h: Math.round(v.hmm * MM) }
      : SIZES[v.size];
    let left = v.left, right = v.right, top = v.top;
    const bottom = v.bottom;
    const minText = 150;
    if (sz.w - left - right < minText) {
      const room = Math.max(sz.w - minText, 40);
      left = Math.round(room * 0.6);
      right = Math.round(room * 0.4);
    }
    top = Math.min(top, sz.h - bottom - v.lineSpacing * 3);
    return {
      pageW: sz.w, pageH: sz.h, paperColor: v.paperColor,
      lineStyle: v.lineStyle, lineColor: v.lineColor,
      marginLine: v.marginLine, marginX: Math.max(left - 20, 20),
      spiral: v.spiral, topLine: v.topLine,
      top: top, bottom: bottom, left: left, right: right,
      lineSpacing: v.lineSpacing
    };
  }

  /* ---------- State ---------- */
  const state = { tpl: 'a4-ruled', v: P({}) };
  (function restore() {
    try {
      const raw = load('wmn_paper');
      if (!raw) return;
      const o = JSON.parse(raw);
      if (o && TEMPLATES.some(t => t.id === o.tpl)) {
        state.tpl = o.tpl;
        state.v = sanitize(o.v);
      }
    } catch (e) { /* default use hoga */ }
  })();

  function save() { store('wmn_paper', JSON.stringify({ tpl: state.tpl, v: state.v })); }
  function findTpl(id) { return TEMPLATES.find(t => t.id === id); }

  /* ---------- Thumbnails ---------- */
  function drawThumb(cv, v, heightPx, lw) {
    const s = E.merge(Object.assign(settingsFrom(v), { thumb: true, lineW: lw, imperfect: false }));
    const scale = (heightPx * 2) / s.pageH;
    E.drawPage(cv, [], s, 0, scale);
    cv.style.height = heightPx + 'px';
    cv.style.width = 'auto';
  }

  const grid = $id('tplGrid');
  TEMPLATES.forEach(t => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tpl';
    b.dataset.id = t.id;
    const th = document.createElement('div');
    th.className = 'tpl-thumb';
    const cv = document.createElement('canvas');
    th.appendChild(cv);
    const nm = document.createElement('span');
    nm.className = 'tpl-name';
    nm.textContent = t.name;
    b.appendChild(th);
    b.appendChild(nm);
    grid.appendChild(b);
    t.canvas = cv;
    b.addEventListener('click', () => choose(t.id));
  });

  function drawAllThumbs() {
    TEMPLATES.forEach(t => drawThumb(t.canvas, t.v || state.v, 150, 4));
  }
  function drawCustomThumb() {
    const c = findTpl('custom');
    drawThumb(c.canvas, state.v, 150, 4);
  }
  function drawBig() { drawThumb($id('pBig'), state.v, 260, 2.5); }

  function markActive() {
    Array.from(grid.children).forEach(b => b.classList.toggle('active', b.dataset.id === state.tpl));
    const t = findTpl(state.tpl);
    const s = settingsFrom(state.v);
    $id('pCurrent').textContent = 'Selected: ' + t.name + '  •  ' +
      Math.round(s.pageW / MM) + ' × ' + Math.round(s.pageH / MM) + ' mm';
  }

  /* ---------- Controls ---------- */
  const el = {
    size: $id('pSize'), w: $id('pW'), h: $id('pH'), color: $id('pColor'),
    lineStyle: $id('pLineStyle'), lineColor: $id('pLineColor'),
    margin: $id('pMargin'), spiral: $id('pSpiral'),
    top: $id('pTop'), left: $id('pLeft'), right: $id('pRight'), spacing: $id('pSpacing')
  };

  function applyToControls() {
    const v = state.v;
    el.size.value = v.size;
    el.w.value = Math.round(v.wmm);
    el.h.value = Math.round(v.hmm);
    el.color.value = v.paperColor;
    el.lineStyle.value = v.lineStyle;
    el.lineColor.value = v.lineColor;
    el.margin.checked = v.marginLine;
    el.spiral.checked = v.spiral;
    el.top.value = v.top;
    el.left.value = v.left;
    el.right.value = v.right;
    el.spacing.value = v.lineSpacing;
    updateReadouts();
  }

  function updateReadouts() {
    $id('pTopV').textContent = '(' + el.top.value + ')';
    $id('pLeftV').textContent = '(' + el.left.value + ')';
    $id('pRightV').textContent = '(' + el.right.value + ')';
    $id('pSpacingV').textContent = '(' + el.spacing.value + ')';
    $id('pCustomSize').style.display = el.size.value === 'custom' ? '' : 'none';
  }

  function readControls() {
    const v = state.v;
    const prevSize = v.size;
    v.size = el.size.value;
    if (v.size !== prevSize && v.size !== 'custom') {
      v.wmm = SIZES[v.size].wmm;
      v.hmm = SIZES[v.size].hmm;
      el.w.value = v.wmm;
      el.h.value = v.hmm;
    }
    const w = parseFloat(el.w.value), h = parseFloat(el.h.value);
    if (isFinite(w)) v.wmm = clamp(w, 100, 420);
    if (isFinite(h)) v.hmm = clamp(h, 100, 600);
    v.paperColor = el.color.value;
    v.lineStyle = el.lineStyle.value;
    v.lineColor = el.lineColor.value;
    v.marginLine = el.margin.checked;
    v.spiral = el.spiral.checked;
    v.top = Number(el.top.value);
    v.left = Number(el.left.value);
    v.right = Number(el.right.value);
    v.lineSpacing = Number(el.spacing.value);
  }

  /* ---------- Actions ---------- */
  function refreshPreview() {
    if (window.WMN.refreshPreview) window.WMN.refreshPreview();
  }

  function choose(id) {
    const t = findTpl(id);
    if (!t) return;
    if (t.v) state.v = Object.assign({}, t.v);
    state.tpl = id;
    applyToControls();
    drawCustomThumb();
    drawBig();
    markActive();
    save();
    refreshPreview();
  }

  let timer = null;
  function onControl(e) {
    readControls();
    state.tpl = 'custom';
    updateReadouts();
    markActive();
    clearTimeout(timer);
    timer = setTimeout(() => {
      drawCustomThumb();
      drawBig();
      save();
      refreshPreview();
    }, 80);
    if (e.type === 'change') applyToControls();
  }

  Object.keys(el).forEach(k => {
    el[k].addEventListener('input', onControl);
    el[k].addEventListener('change', onControl);
  });

  $id('pReset').addEventListener('click', () => {
    const base = state.tpl === 'custom' ? 'a4-ruled' : state.tpl;
    choose(base);
    toast('Paper reset ho gaya', 'success');
  });

  /* ---------- Engine ko paper settings do ---------- */
  window.WMN.getSettings = function () { return settingsFrom(state.v); };

  /* ---------- Start ---------- */
  applyToControls();
  drawAllThumbs();
  drawBig();
  markActive();
  refreshPreview();
})();
