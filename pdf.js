(function () {
  'use strict';
  const W = window.WMN;
  const E = W && W.engine;
  if (!E || !W.parseText || !W.getSettings) { console.error('Pehle ki files load nahi hui'); return; }
  const $id = id => document.getElementById(id);
  const dlBtn = $id('pdfDownload');
  if (!dlBtn) return;
  const prvBtn = $id('pdfPreview'), prtBtn = $id('pdfPrint');
  const qSel = $id('pdfQ'), info = $id('pdfInfo');

  const MM = 96 / 25.4;
  const MAXPX = 12000000;              // ek canvas mein max pixels (phone safe)
  const JSPDF_URL = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';

  function mk(tag, cls, txt) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt !== undefined) e.textContent = txt;
    return e;
  }
  const tick = () => new Promise(r => setTimeout(r, 16));

  /* ---------- Quality ---------- */
  qSel.value = load('wmn_pdfq') === '2' ? '2' : '3';
  qSel.addEventListener('change', () => store('wmn_pdfq', qSel.value));
  info.textContent = 'Download, Preview ya Print dabao.';

  /* ---------- Loading overlay ---------- */
  const ov = mk('div', 'pdf-ov');
  ov.id = 'pdfLoading';
  ov.setAttribute('role', 'alertdialog');
  const box = mk('div', 'pdf-box');
  const ovTxt = mk('p', 'pdf-txt', 'Taiyaar ho raha hai...');
  const bar = mk('div', 'pdf-bar');
  const barIn = mk('span');
  bar.appendChild(barIn);
  const cancelB = mk('button', 'btn', '✖ Cancel');
  cancelB.type = 'button';
  box.appendChild(mk('div', 'pdf-spin'));
  box.appendChild(ovTxt);
  box.appendChild(bar);
  box.appendChild(cancelB);
  ov.appendChild(box);
  document.body.appendChild(ov);

  let cancelled = false;
  cancelB.addEventListener('click', () => { cancelled = true; ovTxt.textContent = 'Cancel ho raha hai...'; });

  function showLoading(t, p) { ovTxt.textContent = t; barIn.style.width = p + '%'; ov.classList.add('show'); }
  function hideLoading() { ov.classList.remove('show'); }

  /* ---------- Preview modal ---------- */
  const modal = mk('div', 'pdf-modal');
  modal.id = 'pdfModal';
  modal.setAttribute('role', 'dialog');
  const mbar = mk('div', 'pdf-mbar');
  const mDl = mk('button', 'btn', '⬇️ Download');
  const mPr = mk('button', 'btn', '🖨️ Print');
  const mCl = mk('button', 'btn', '✖ Close');
  [mDl, mPr, mCl].forEach(b => { b.type = 'button'; });
  mbar.appendChild(mk('b', '', '📄 PDF Preview'));
  mbar.appendChild(mDl);
  mbar.appendChild(mPr);
  mbar.appendChild(mCl);
  const pagesBox = mk('div', 'pdf-pages');
  modal.appendChild(mbar);
  modal.appendChild(pagesBox);
  document.body.appendChild(modal);

  function closeModal() {
    modal.classList.remove('show');
    document.body.classList.remove('pdf-lock');
    pagesBox.textContent = '';
  }
  mCl.addEventListener('click', closeModal);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && modal.classList.contains('show') && !ov.classList.contains('show')) closeModal();
  });

  /* ---------- Print area ---------- */
  const printArea = mk('div');
  printArea.id = 'printArea';
  document.body.appendChild(printArea);
  const pageStyle = document.createElement('style');
  pageStyle.id = 'pdfPageStyle';
  document.head.appendChild(pageStyle);

  /* ---------- State ---------- */
  let cache = null;
  let busy = false;

  function setBusy(b) {
    busy = b;
    [dlBtn, prvBtn, prtBtn, mDl, mPr].forEach(x => { x.disabled = b; });
  }

  /* ---------- Helpers ---------- */
  /* px -> mm (A4/A5/Letter exact rakhne ke liye) */
  function pageMM(wpx, hpx) {
    if (wpx === 816 && hpx === 1056) return [215.9, 279.4];
    const f = v => {
      const m = v / MM, r = Math.round(m);
      return Math.abs(m - r) < 0.15 ? r : Math.round(m * 10) / 10;
    };
    return [f(wpx), f(hpx)];
  }

  function fileName() {
    let t = '';
    try {
      const st = W.cover && W.cover.getState && W.cover.getState();
      if (st && st.on && st.f && st.f.title) t = st.f.title;
    } catch (e) { /* ignore */ }
    t = t.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '').trim().replace(/\s+/g, '-');
    t = Array.from(t).slice(0, 40).join('').replace(/\.+$/, '');
    return (t || 'WriteMyNotes-Assignment') + '.pdf';
  }

  function getJsPDF() {
    return new Promise((resolve, reject) => {
      if (window.jspdf && window.jspdf.jsPDF) { resolve(window.jspdf.jsPDF); return; }
      const sc = document.createElement('script');
      sc.src = JSPDF_URL;
      const t = setTimeout(() => reject(new Error('NOLIB')), 20000);
      sc.onload = () => {
        clearTimeout(t);
        if (window.jspdf && window.jspdf.jsPDF) resolve(window.jspdf.jsPDF);
        else reject(new Error('NOLIB'));
      };
      sc.onerror = () => { clearTimeout(t); reject(new Error('NOLIB')); };
      document.head.appendChild(sc);
    });
  }

  async function loadCoverFonts() {
    if (!(document.fonts && document.fonts.load)) return;
    try {
      await Promise.all([document.fonts.load('500 16px Poppins'), document.fonts.load('600 15px Poppins')]);
    } catch (e) { /* ignore */ }
  }

  /* Preview jaise hi pages banao (cover pehle) */
  async function gather() {
    const text = W.getText();
    const hasText = !!text.trim();
    const coverFn = (W.cover && typeof W.cover.provider === 'function') ? W.cover.provider() : null;
    if (!hasText && !coverFn) throw new Error('EMPTY');
    const all = W.getSettings();
    if (coverFn) await loadCoverFonts();
    const r = await E.renderAll(W.parseText(text), all);   // fonts yahin load hote hain
    const pages = hasText ? r.pages.map(l => ({ lines: l })) : [];
    if (coverFn) pages.unshift({ cover: coverFn });
    return { s: r.settings, pages: pages, text: text, coverOn: !!coverFn };
  }

  /* ---------- Build all page images ---------- */
  async function build() {
    cancelled = false;
    showLoading('Fonts load ho rahe hain...', 3);
    const g = await gather();
    const s = g.s;
    const sig = JSON.stringify([g.text, W.getSettings(), g.coverOn ? W.cover.getState() : null, qSel.value]);
    if (cache && cache.sig === sig) return cache;
    cache = null;                                           // purani memory free

    const n = g.pages.length;
    let sc = Math.min(Number(qSel.value) || 3, Math.sqrt(MAXPX / (s.pageW * s.pageH)));
    if (n > 30 && sc > 2) { sc = 2; toast('Pages zyada hain, isliye Standard quality use hui', 'info'); }
    if (sc < 1) sc = 1;

    const cv = document.createElement('canvas');
    const images = [], labels = [];
    let pn = 0;

    for (let i = 0; i < n; i++) {
      if (cancelled) throw new Error('CANCELLED');
      showLoading('Page ' + (i + 1) + ' / ' + n + ' ban raha hai...', Math.round(5 + 90 * i / n));
      await tick();
      const p = g.pages[i];
      if (p.cover) p.cover(cv, s, sc);
      else E.drawPage(cv, p.lines, s, i, sc);              // index i = preview jaisa
      const url = cv.toDataURL('image/jpeg', 0.92);
      if (url.indexOf('data:image/jpeg') !== 0) throw new Error('CANVAS');
      images.push(url);
      labels.push(p.cover ? 'Cover page' : 'Page ' + (++pn));
    }
    cv.width = 0; cv.height = 0;

    const mm = pageMM(s.pageW, s.pageH);
    cache = { sig: sig, images: images, labels: labels, wmm: mm[0], hmm: mm[1], count: n, dpi: Math.round(96 * sc) };
    info.textContent = 'Taiyaar: ' + n + (n === 1 ? ' page' : ' pages') + '  •  ' + mm[0] + ' × ' + mm[1] + ' mm  •  ' + cache.dpi + ' dpi';
    return cache;
  }

  function fail(e) {
    const m = e && e.message;
    if (m === 'EMPTY') toast('Pehle text likho ya cover page on karo', 'error');
    else if (m === 'CANCELLED') toast('PDF cancel ho gayi');
    else if (m === 'NOLIB') toast('PDF library load nahi hui. Internet check karke dobara try karo', 'error');
    else {
      console.error(e);
      toast('PDF banane mein error aaya. Quality "Standard" karke try karo', 'error');
    }
  }

  /* ---------- Actions ---------- */
  async function doDownload() {
    if (busy) return;
    setBusy(true);
    try {
      showLoading('Taiyaar ho raha hai...', 2);
      const JsPDF = await getJsPDF();
      const c = await build();
      showLoading('PDF file ban rahi hai...', 97);
      await tick();
      const w = c.wmm, h = c.hmm;
      const orient = w > h ? 'l' : 'p';
      const fmt = [Math.min(w, h), Math.max(w, h)];
      const doc = new JsPDF({ orientation: orient, unit: 'mm', format: fmt, compress: true });
      doc.setProperties({ title: fileName().replace(/\.pdf$/, ''), creator: 'WriteMyNotes AI' });
      c.images.forEach((img, i) => {
        if (i > 0) doc.addPage(fmt, orient);
        doc.addImage(img, 'JPEG', 0, 0, w, h, undefined, 'FAST');
      });
      doc.save(fileName());
      toast('PDF download ho gayi (' + c.count + (c.count === 1 ? ' page)' : ' pages)'), 'success');
    } catch (e) {
      fail(e);
    } finally {
      hideLoading();
      setBusy(false);
    }
  }

  async function doPreview() {
    if (busy) return;
    setBusy(true);
    try {
      const c = await build();
      pagesBox.textContent = '';
      c.images.forEach((u, i) => {
        const f = mk('figure', 'pdf-pg');
        const im = new Image();
        im.decoding = 'async';
        im.src = u;
        im.alt = c.labels[i];
        im.style.aspectRatio = c.wmm + ' / ' + c.hmm;
        f.appendChild(im);
        f.appendChild(mk('figcaption', '', c.labels[i] + '  (' + (i + 1) + ' / ' + c.count + ')'));
        pagesBox.appendChild(f);
      });
      pagesBox.scrollTop = 0;
      modal.classList.add('show');
      document.body.classList.add('pdf-lock');
    } catch (e) {
      fail(e);
    } finally {
      hideLoading();
      setBusy(false);
    }
  }

  async function doPrint() {
    if (busy) return;
    setBusy(true);
    try {
      const c = await build();
      showLoading('Print ke liye taiyaar ho raha hai...', 97);
      printArea.textContent = '';
      pageStyle.textContent = '@page{size:' + c.wmm + 'mm ' + c.hmm + 'mm;margin:0}';
      const imgs = [];
      c.images.forEach(u => {
        const d = mk('div', 'pp');
        d.style.width = c.wmm + 'mm';
        d.style.height = (c.hmm - 0.3) + 'mm';
        const im = new Image();
        im.src = u;
        im.alt = '';
        d.appendChild(im);
        printArea.appendChild(d);
        imgs.push(im);
      });
      await Promise.all(imgs.map(im => (im.decode ? im.decode().catch(() => {}) : Promise.resolve())));
      hideLoading();
      await tick();
      window.print();
    } catch (e) {
      fail(e);
    } finally {
      hideLoading();
      setBusy(false);
    }
  }

  dlBtn.addEventListener('click', doDownload);
  prvBtn.addEventListener('click', doPreview);
  prtBtn.addEventListener('click', doPrint);
  mDl.addEventListener('click', doDownload);
  mPr.addEventListener('click', doPrint);

  W.pdf = { download: doDownload, preview: doPreview, print: doPrint };
})();
