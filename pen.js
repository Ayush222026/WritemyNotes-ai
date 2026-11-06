
(function () {
  'use strict';

  const E = window.WMN && window.WMN.engine;
  if (!E) {
    console.error('engine.js load nahi hua');
    return;
  }

  const $id = id => document.getElementById(id);
  const COLOR_RE = /^#[0-9a-f]{6}$/i;
  const clamp = (n, a, b) => Math.min(b, Math.max(a, n));

  function num(x, def, a, b) {
    const n = Number(x);
    return isFinite(n) ? clamp(n, a, b) : def;
  }

  function clone(o) {
    return JSON.parse(JSON.stringify(o));
  }

  /* ---------- Fonts ---------- */
  const FONTS = [
    { name: 'Caveat', scale: 1.2 },
    { name: 'Kalam', scale: 0.95 },
    { name: 'Patrick Hand', scale: 1.05 },
    { name: 'Comic Neue', scale: 0.95 },
    { name: 'Handlee', scale: 1 },
    { name: 'Architects Daughter', scale: 0.92 },
    { name: 'Shadows Into Light', scale: 1.15 },
    { name: 'Indie Flower', scale: 1 },
    { name: 'Homemade Apple', scale: 0.72 },
    { name: 'Schoolbell', scale: 1 },
    { name: 'My Handwriting', scale: 1 }
  ];

  const PENS = [
    { id: 'blue', name: 'Blue', color: '#1d3fbb' },
    { id: 'dblue', name: 'Dark Blue', color: '#0b1f6b' },
    { id: 'black', name: 'Black', color: '#1a1a1a' },
    { id: 'red', name: 'Red', color: '#c62828' },
    { id: 'green', name: 'Green', color: '#1b7a3a' },
    { id: 'purple', name: 'Purple', color: '#6a2fb5' },
    { id: 'multi', name: 'Multicolour', color: null },
    { id: 'custom', name: 'Custom', color: null }
  ];

  const TEXTURES = [
    ['ballpoint', 'Ballpoint (default)'],
    ['gel', 'Gel pen'],
    ['fountain', 'Fountain pen'],
    ['pencil', 'Pencil'],
    ['none', 'Smooth (no texture)']
  ];

  const MULTI_LABELS = [
    ['heading', 'Main heading'],
    ['sub', 'Subheading'],
    ['def', 'Definition'],
    ['warn', 'Warning'],
    ['body', 'Normal text']
  ];

  const DEFAULT_MULTI = {
    heading: '#1e40af',
    sub: '#7c3aed',
    def: '#15803d',
    warn: '#dc2626',
    body: '#111111'
  };

  const DEFAULT = {
    pen: 'blue',
    custom: '#1d3fbb',
    headOn: false,
    head: '#0b1f6b',
    font: 'Caveat',
    size: 26,
    cs: 0.4,
    ink: 0.25,
    op: 92,
    tex: 'ballpoint',
    imp: true,
    multi: clone(DEFAULT_MULTI)
  };

  function sanitize(o) {
    const s = clone(DEFAULT);

    if (!o || typeof o !== 'object') return s;

    if (PENS.some(p => p.id === o.pen)) s.pen = o.pen;
    if (COLOR_RE.test(o.custom)) s.custom = o.custom;

    s.headOn = !!o.headOn;

    if (COLOR_RE.test(o.head)) s.head = o.head;
    if (FONTS.some(f => f.name === o.font)) s.font = o.font;

    s.size = num(o.size, s.size, 16, 44);
    s.cs = num(o.cs, s.cs, -1, 6);
    s.ink = num(o.ink, s.ink, 0, 1.2);
    s.op = num(o.op, s.op, 40, 100);

    if (TEXTURES.some(t => t[0] === o.tex)) s.tex = o.tex;

    s.imp = typeof o.imp === 'boolean' ? o.imp : true;

    if (o.multi && typeof o.multi === 'object') {
      Object.keys(DEFAULT_MULTI).forEach(k => {
        if (COLOR_RE.test(o.multi[k])) s.multi[k] = o.multi[k];
      });
    }

    return s;
  }

  let state = clone(DEFAULT);

  try {
    const raw = load('wmn_pen');
    if (raw) state = sanitize(JSON.parse(raw));
  } catch (e) {
    /* default use hoga */
  }

  function save() {
    store('wmn_pen', JSON.stringify(state));
  }

  /* ---------- Helpers ---------- */

  function fontOf(name) {
    return FONTS.find(f => f.name === name) || FONTS[0];
  }

  function stack(name) {
    return name === 'Kalam'
      ? '"Kalam",cursive'
      : '"' + name + '","Kalam",cursive';
  }

  function penColor() {
    if (state.pen === 'custom') return state.custom;

    const p = PENS.find(x => x.id === state.pen);
    return (p && p.color) || '#1d3fbb';
  }

  /* ---------- Pen settings -> engine settings ---------- */

  function settings() {
    const f = fontOf(state.font);
    let colors;
    let multi = false;

    if (state.pen === 'multi') {
      multi = true;
      colors = Object.assign({}, state.multi);
    } else {
      const c = penColor();
      const h = state.headOn ? state.head : c;

      colors = {
        body: c,
        heading: h,
        sub: h,
        def: c,
        warn: c
      };
    }

    return {
      fontFamily: stack(state.font),
      fontScale: f.scale,
      fontSize: state.size,
      charSpacing: state.cs,
      ink: state.ink,
      opacity: state.op / 100,
      texture: state.tex,
      imperfect: state.imp,
      multi: multi,
      colors: colors
    };
  }

  /* ---------- Paper settings ---------- */

  const paperGet = window.WMN.getSettings || function () {
    return {};
  };

  window.WMN.getSettings = function () {
    return Object.assign({}, paperGet(), settings());
  };

  /* ---------- Build UI ---------- */

  const pensEl = $id('sPens');

  PENS.forEach(p => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pen';
    b.dataset.id = p.id;

    const d = document.createElement('span');
    d.className = 'dot';

    if (p.id === 'multi') {
      d.classList.add('rainbow');
    } else if (p.id === 'custom') {
      d.dataset.custom = '1';
    } else {
      d.style.background = p.color;
    }

    const n = document.createElement('span');
    n.textContent = p.name;

    b.appendChild(d);
    b.appendChild(n);
    pensEl.appendChild(b);

    b.addEventListener('click', () => {
      state.pen = p.id;
      changed();
    });
  });

  const fontsEl = $id('sFonts');

  FONTS.forEach(f => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'fnt';
    b.dataset.name = f.name;

    const pv = document.createElement('div');
    pv.className = 'fnt-prev';
    pv.style.fontFamily = stack(f.name);
    pv.textContent = 'Hello नमस्ते 123';

    const nm = document.createElement('div');
    nm.className = 'fnt-name';
    nm.textContent = f.name;

    b.appendChild(pv);
    b.appendChild(nm);
    fontsEl.appendChild(b);

    b.addEventListener('click', () => {
      state.font = f.name;
      changed();
    });
  });

  const multiEl = $id('sMultiGrid');
  const multiInputs = {};

  MULTI_LABELS.forEach(pair => {
    const row = document.createElement('label');
    row.className = 'mrow';

    const inp = document.createElement('input');
    inp.type = 'color';

    const sp = document.createElement('span');
    sp.textContent = pair[1];

    row.appendChild(inp);
    row.appendChild(sp);
    multiEl.appendChild(row);

    multiInputs[pair[0]] = inp;

    inp.addEventListener('input', () => {
      if (COLOR_RE.test(inp.value)) {
        state.multi[pair[0]] = inp.value;
        changed();
      }
    });
  });

  const texEl = $id('sTex');

  TEXTURES.forEach(t => {
    const o = document.createElement('option');
    o.value = t[0];
    o.textContent = t[1];
    texEl.appendChild(o);
  });

  const el = {
    custom: $id('sCustom'),
    head: $id('sHead'),
    headOn: $id('sHeadOn'),
    size: $id('sSize'),
    cs: $id('sCS'),
    ink: $id('sInk'),
    op: $id('sOp'),
    tex: texEl,
    imp: $id('sImp')
  };

  el.custom.addEventListener('input', () => {
    if (COLOR_RE.test(el.custom.value)) {
      state.custom = el.custom.value;
      changed();
    }
  });

  el.head.addEventListener('input', () => {
    if (COLOR_RE.test(el.head.value)) {
      state.head = el.head.value;
      changed();
    }
  });

  el.headOn.addEventListener('change', () => {
    state.headOn = el.headOn.checked;
    changed();
  });

  el.size.addEventListener('input', () => {
    state.size = num(el.size.value, state.size, 16, 44);
    changed();
  });

  el.cs.addEventListener('input', () => {
    state.cs = num(el.cs.value, state.cs, -1, 6);
    changed();
  });

  el.ink.addEventListener('input', () => {
    state.ink = num(el.ink.value, state.ink, 0, 1.2);
    changed();
  });

  el.op.addEventListener('input', () => {
    state.op = num(el.op.value, state.op, 40, 100);
    changed();
  });

  el.tex.addEventListener('change', () => {
    state.tex = el.tex.value;
    changed();
  });

  el.imp.addEventListener('change', () => {
    state.imp = el.imp.checked;
    changed();
  });

  $id('sReset').addEventListener('click', () => {
    state = clone(DEFAULT);
    applyToControls();
    changed();
    toast('Pen settings reset ho gayi', 'success');
  });

  function applyToControls() {
    el.custom.value = state.custom;
    el.head.value = state.head;
    el.headOn.checked = state.headOn;
    el.size.value = state.size;
    el.cs.value = state.cs;
    el.ink.value = state.ink;
    el.op.value = state.op;
    el.tex.value = state.tex;
    el.imp.checked = state.imp;

    Object.keys(multiInputs).forEach(k => {
      multiInputs[k].value = state.multi[k];
    });
  }

  function updateUI() {
    Array.from(pensEl.children).forEach(b => {
      b.classList.toggle('active', b.dataset.id === state.pen);
    });

    Array.from(fontsEl.children).forEach(b => {
      b.classList.toggle('active', b.dataset.name === state.font);
    });

    const cd = pensEl.querySelector('.dot[data-custom]');
    if (cd) cd.style.background = state.custom;

    const multi = state.pen === 'multi';

    $id('sCustomRow').style.display =
      state.pen === 'custom' ? '' : 'none';

    $id('sMultiBox').style.display = multi ? 'block' : 'none';
    $id('sHeadRow').style.display = multi ? 'none' : '';

    $id('sHeadColorRow').style.display =
      (!multi && state.headOn) ? '' : 'none';

    $id('sSizeV').textContent = '(' + state.size + ' px)';
    $id('sCSV').textContent = '(' + state.cs.toFixed(1) + ')';
    $id('sInkV').textContent = '(' + state.ink.toFixed(2) + ')';
    $id('sOpV').textContent = '(' + Math.round(state.op) + '%)';

    const eff = Math.round(state.size * fontOf(state.font).scale);
    const ls = paperGet().lineSpacing || 34;

    $id('sWarn').style.display =
      eff > ls * 0.95 ? 'block' : 'none';
  }

  /* ---------- Live sample ---------- */

  const SAMPLE = [
    { type: 'heading', text: 'My Notes' },
    { type: 'paragraph', text: 'Hello world, नमस्ते दोस्तों!' },
    { type: 'subheading', text: 'Key Points:' },
    { type: 'paragraph', text: 'Definition: Ink is a coloured liquid.' },
    { type: 'paragraph', text: 'Warning: Handle with care.' }
  ];

  let token = 0;

  async function drawSample() {
    const my = ++token;

    try {
      const st = settings();
      const eff = Math.round(st.fontSize * st.fontScale);
      const ls = Math.max(34, Math.round(eff * 1.35) + 4);

      const over = Object.assign({}, st, {
        pageW: 560,
        pageH: 3000,
        top: Math.round(eff * 1.2) + 26,
        bottom: 10,
        left: 40,
        right: 20,
        lineSpacing: ls,
        paperColor: '#fffef9',
        lineStyle: 'single',
        lineColor: '#b8c7e8',
        marginLine: true,
        marginX: 26,
        spiral: false,
        topLine: false,
        thumb: false
      });

      const s = E.merge(over);

      await E.ensureFonts(s);

      if (my !== token) return;

      const lines = [].concat.apply([], E.layout(SAMPLE, s));

      s.pageH = s.top + Math.max(0, lines.length - 1) * ls + 28;

      E.drawPage($id('sSample'), lines, s, 0, 2);
    } catch (err) {
      console.error(err);
    }
  }

  /* ---------- Change handler ---------- */

  let timer = null;

  function changed() {
    updateUI();
    save();

    clearTimeout(timer);

    timer = setTimeout(() => {
      drawSample();

      if (window.WMN.refreshPreview) {
        window.WMN.refreshPreview();
      }
    }, 90);
  }

  /* ---------- Paper tab ---------- */

  document.addEventListener('click', e => {
    if (e.target.closest && e.target.closest('.nav-btn')) {
      setTimeout(updateUI, 50);
    }
  });

  /* ---------- Start ---------- */

  applyToControls();
  updateUI();
  drawSample();

  if (window.WMN.refreshPreview) {
    window.WMN.refreshPreview();
  }
})();
