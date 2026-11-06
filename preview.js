(function () {
  'use strict';
  const W = window.WMN;
  if (!W || !W.engine || !W.parseText) { console.error('Pehle ki files load nahi hui'); return; }
  const E = W.engine;
  const $id = id => document.getElementById(id);

  const cv = $id('pvxCanvas');
  if (!cv) return;
  const wrap = $id('pvxWrap');
  const pageSel = $id('pvxPage');
  const prevB = $id('pvxPrev'), nextB = $id('pvxNext');
  const zoomIn = $id('pvxIn'), zoomOut = $id('pvxOut'), zoomFit = $id('pvxFit');
  const zoomLbl = $id('pvxZoom'), info = $id('pvxInfo');

  const MM = 96 / 25.4;
  const ZOOMS = [50, 75, 100, 125, 150, 200, 250];

  function nearestZoom(z) {
    let best = 100, d = 1e9;
    ZOOMS.forEach(v => { const x = Math.abs(v - z); if (x < d) { d = x; best = v; } });
    return best;
  }

  const state = {
    pages: [{ lines: [] }],
    settings: E.merge(),
    index: 0,
    zoom: nearestZoom(Number(load('wmn_zoom')) || 100)
  };

  /* ---------- Drawing ---------- */
  function drawIndex(canvas, i, scale) {
    const p = state.pages[i];
    if (!p) return;
    if (p.cover) p.cover(canvas, state.settings, scale);
    else E.drawPage(canvas, p.lines, state.settings, i, scale);
  }

  function applySize() {
    const s = state.settings;
    const avail = Math.max(200, (wrap.clientWidth || 320) - 26);
    const fit = Math.min(avail, s.pageW);
    const w = Math.round(fit * state.zoom / 100);
    cv.style.width = w + 'px';
    cv.style.height = Math.round(w * s.pageH / s.pageW) + 'px';
    zoomLbl.textContent = state.zoom + '%';
    zoomOut.disabled = state.zoom <= ZOOMS[0];
    zoomIn.disabled = state.zoom >= ZOOMS[ZOOMS.length - 1];
  }

  function updateBar() {
    prevB.disabled = state.index <= 0;
    nextB.disabled = state.index >= state.pages.length - 1;
    pageSel.value = String(state.index);
  }

  function show() {
    drawIndex(cv, state.index, 2);
    applySize();
    updateBar();
  }

  function rebuildSelect() {
    pageSel.textContent = '';
    let n = 0;
    state.pages.forEach((p, i) => {
      const o = document.createElement('option');
      o.value = String(i);
      o.textContent = p.cover ? 'Cover page' : 'Page ' + (++n);
      pageSel.appendChild(o);
    });
  }

  /* ---------- Quick controls (pen / paper / font) ---------- */
  const qPen = $id('qPen'), qPaper = $id('qPaper'), qFont = $id('qFont');
  const penBtns = Array.from(document.querySelectorAll('#sPens .pen'));
  const paperBtns = Array.from(document.querySelectorAll('#tplGrid .tpl'));
  const fontBtns = Array.from(document.querySelectorAll('#sFonts .fnt'));

  function fill(sel, items) {
    items.forEach(it => {
      const o = document.createElement('option');
      o.value = it[0];
      o.textContent = it[1];
      sel.appendChild(o);
    });
  }
  fill(qPen, penBtns.map(b => [b.dataset.id, b.textContent.trim()]));
  fill(qPaper, paperBtns.map(b => {
    const n = b.querySelector('.tpl-name');
    return [b.dataset.id, n ? n.textContent : b.dataset.id];
  }));
  fill(qFont, fontBtns.map(b => [b.dataset.name, b.dataset.name]));

  qPen.addEventListener('change', () => {
    const b = penBtns.find(x => x.dataset.id === qPen.value);
    if (b) b.click();
  });
  qPaper.addEventListener('change', () => {
    const b = paperBtns.find(x => x.dataset.id === qPaper.value);
    if (b) b.click();
  });
  qFont.addEventListener('change', () => {
    const b = fontBtns.find(x => x.dataset.name === qFont.value);
    if (b) b.click();
  });

  function syncQuick() {
    const p = penBtns.find(b => b.classList.contains('active'));
    if (p) qPen.value = p.dataset.id;
    const t = paperBtns.find(b => b.classList.contains('active'));
    if (t) qPaper.value = t.dataset.id;
    const f = fontBtns.find(b => b.classList.contains('active'));
    if (f) qFont.value = f.dataset.name;
  }

  /* ---------- Render ---------- */
  let busy = false, again = false, timer = null;

  async function render() {
    if (busy) { again = true; return; }
    busy = true;
    try {
      const text = W.getText();
      const blocks = W.parseText(text);
      const all = W.getSettings ? W.getSettings() : {};
      const r = await E.renderAll(blocks, all);
      const pages = r.pages.map(l => ({ lines: l }));

      /* Step 8 mein cover page yahan judega */
      const cover = (W.cover && typeof W.cover.provider === 'function') ? W.cover.provider() : null;
      if (cover) pages.unshift({ cover: cover });

      state.pages = pages;
      state.settings = r.settings;
      if (state.index >= pages.length) state.index = pages.length - 1;
      if (state.index < 0) state.index = 0;

      rebuildSelect();
      show();
      syncQuick();

      const s = r.settings;
      const mmW = Math.round(s.pageW / MM), mmH = Math.round(s.pageH / MM);
      info.textContent = (text.trim() ? '' : 'Text khaali hai. Upar likho ya Sample dabao.  •  ') +
        'Total pages: ' + pages.length + '  •  Paper: ' + mmW + ' × ' + mmH + ' mm';
    } catch (err) {
      console.error(err);
      toast('Preview banane mein error aaya', 'error');
    }
    busy = false;
    if (again) { again = false; render(); }
  }

  function later(ms) { clearTimeout(timer); timer = setTimeout(render, ms || 150); }

  /* ---------- Buttons ---------- */
  prevB.addEventListener('click', () => { if (state.index > 0) { state.index--; show(); } });
  nextB.addEventListener('click', () => { if (state.index < state.pages.length - 1) { state.index++; show(); } });
  pageSel.addEventListener('change', () => {
    const i = Number(pageSel.value);
    if (i >= 0 && i < state.pages.length) { state.index = i; show(); }
  });

  function setZoom(z) {
    state.zoom = z;
    store('wmn_zoom', String(z));
    applySize();
  }
  zoomIn.addEventListener('click', () => {
    const i = ZOOMS.indexOf(state.zoom);
    if (i < ZOOMS.length - 1) setZoom(ZOOMS[i + 1]);
  });
  zoomOut.addEventListener('click', () => {
    const i = ZOOMS.indexOf(state.zoom);
    if (i > 0) setZoom(ZOOMS[i - 1]);
  });
  zoomFit.addEventListener('click', () => setZoom(100));

  $id('pvxRefresh').addEventListener('click', () => { render(); toast('Preview refresh ho gaya', 'success'); });

  /* ---------- Auto-refresh ---------- */
  const saveEl = $id('saveState');
  if (saveEl) {
    new MutationObserver(() => {
      if (saveEl.textContent.indexOf('Saved') !== -1) later(150);
    }).observe(saveEl, { childList: true, characterData: true, subtree: true });
  }

  let rafId = 0;
  function onResize() {
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(applySize);
  }
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(onResize).observe(wrap);
  window.addEventListener('resize', onResize);

  /* ---------- Baaki files ke liye ---------- */
  W.refreshPreview = function () { later(80); };
  W.getPages = function () { return { settings: state.settings, pages: state.pages }; };
  W.drawPageTo = function (canvas, i, scale) { drawIndex(canvas, i, scale || 2); };

  render();
})();
