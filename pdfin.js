(function () {
  'use strict';
  const W = window.WMN;
  const ta = document.getElementById('textInput');
  const textCard = ta ? ta.closest('.card') : null;
  if (!W || !ta || !textCard) { console.error('Earlier files not loaded'); return; }
  if (document.getElementById('pdfInCard')) return;

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

  const opt = { hf: true, hy: true, img: true };
  try {
    const o = JSON.parse(load('wmn_pdfin') || 'null');
    if (o && typeof o === 'object') {
      ['hf', 'hy', 'img'].forEach(k => { if (typeof o[k] === 'boolean') opt[k] = o[k]; });
    }
  } catch (e) { /* default */ }
  function saveOpt() { store('wmn_pdfin', JSON.stringify(opt)); }

  const card = mk('div', 'card');
  card.id = 'pdfInCard';
  card.appendChild(mk('h3', '', '📄 Import from PDF'));
  card.appendChild(mk('p', 'muted', 'Choose a PDF. The app will pull its text and images into the box above. Lines in a larger font become headings; the rest is handled by Smart Detect.'));

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
  check('Also take images from the PDF (photos, diagrams)', 'img');
  check('Remove headers, footers and page numbers', 'hf');
  check('Join words broken across line ends (e.g. "infor-" + "mation")', 'hy');

  const fileIn = document.createElement('input');
  fileIn.type = 'file';
  fileIn.accept = 'application/pdf,.pdf';
  fileIn.hidden = true;
  card.appendChild(fileIn);
  const tb = mk('div', 'toolbar');
  tb.appendChild(btn('📄 Choose PDF', () => fileIn.click(), 'btn-main'));
  card.appendChild(tb);
  const status = mk('p', 'muted small', '');
  card.appendChild(status);
  textCard.parentNode.insertBefore(card, textCard.nextSibling);

  let cancelled = false, busy = false;

  const ov = mk('div', 'pdf-ov');
  const bx = mk('div', 'pdf-box');
  const ovTxt = mk('p', 'pdf-txt', '');
  const bar = mk('div', 'pdf-bar');
  const barIn = mk('span');
  bar.appendChild(barIn);
  bx.appendChild(mk('div', 'pdf-spin'));
  bx.appendChild(ovTxt);
  bx.appendChild(bar);
  bx.appendChild(btn('✖ Cancel', () => { cancelled = true; ovTxt.textContent = 'Cancelling...'; }));
  ov.appendChild(bx);
  document.body.appendChild(ov);
  function showProg(t, p) { ovTxt.textContent = t; barIn.style.width = p + '%'; ov.classList.add('show'); }
  function hideProg() { ov.classList.remove('show'); }

  const cov = mk('div', 'pdf-ov');
  const cbx = mk('div', 'pdf-box');
  const cTxt = mk('p', 'pdf-txt', '');
  const cBtns = mk('div');
  cBtns.style.cssText = 'display:flex;flex-direction:column;gap:10px;margin-top:12px';
  const bRep = btn('🔄 Replace my current text', () => {}, 'btn-main');
  const bAdd = btn('➕ Add below my current text', () => {});
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

  function needMod(name, key) {
    return new Promise((res, rej) => {
      if (W[key]) { res(W[key]); return; }
      const s = document.createElement('script');
      s.src = name + '?v=' + Date.now();
      s.onload = () => { if (W[key]) res(W[key]); else rej(new Error('MODBAD:' + name)); };
      s.onerror = () => rej(new Error('MODMISS:' + name));
      document.head.appendChild(s);
    });
  }

  async function extract(file) {
    showProg('Loading PDF library...', 3);
    const lib = await getLib();
    const P = await needMod('pdfparse.js', 'pdfParse');
    let IM = null, imgWarn = false;
    if (opt.img) {
      if (!(W.images && W.images.add)) imgWarn = true;
      else {
        try { IM = await needMod('pdfimg.js', 'pdfImg'); } catch (e) { imgWarn = true; }
      }
    }
    if (cancelled) throw new Error('CANCELLED');

    showProg('Opening the PDF...', 8);
    const buf = new Uint8Array(await file.arrayBuffer());
    const pdf = await lib.getDocument({ data: buf }).promise;
    const total = pdf.numPages;
    const n = Math.min(total, MAX_PAGES);
    const pages = [];
    let imgMade = 0, imgFull = false, prep = null;

    try {
      for (let p = 1; p <= n; p++) {
        if (cancelled) throw new Error('CANCELLED');
        showProg('Reading page ' + p + ' / ' + n + '...', Math.round(10 + 70 * p / n));
        const page = await pdf.getPage(p);
        const tc = await page.getTextContent();
        const vp = page.getViewport({ scale: 1 });
        let cand = [];
        if (IM) {
          try { cand = await IM.find(page, lib.OPS); } catch (e) { cand = []; }
        }
        pages.push({ H: vp.height, Wd: vp.width, lines: P.lines(tc.items), cand: cand });
        page.cleanup();
        if (p % 5 === 0) await tick();
      }

      showProg('Preparing the text...', 82);
      await tick();
      prep = P.prep(pages, opt);
      if (prep.empty) return { empty: true };

      if (IM) {
        IM.filter(pages);
        const r = await IM.crop(pdf, pages, {
          progress: showProg,
          isCancelled: () => cancelled,
          tick: tick
        });
        imgMade = r.made; imgFull = r.full;
      }
    } finally {
      try { pdf.destroy(); } catch (e) { /* ignore */ }
    }

    const f = P.finish(pages, opt);
    return {
      empty: false, text: f.text, pages: n, total: total, heads: f.heads, words: f.words,
      images: imgMade, imgFull: imgFull, imgWarn: imgWarn
    };
  }

  async function place(r, name) {
    let t = r.text;
    let mode = 'replace';
    if (ta.value.trim()) {
      mode = await choose('There is already text in the box. Where should the PDF text go?');
      if (!mode) { toast('PDF text was not added'); return; }
    }
    if (mode === 'add') t = ta.value.replace(/\s+$/, '') + '\n\n' + t;
    let cutDone = false;
    if (Array.from(t).length > MAX_CHARS) { t = Array.from(t).slice(0, MAX_CHARS).join(''); cutDone = true; }
    ta.value = t;
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    status.textContent = 'Last PDF: ' + name + '  •  ' + r.pages + ' pages  •  ' + r.words + ' words  •  ' + r.heads + ' headings  •  ' + r.images + ' images';
    toast('PDF imported (' + r.words + ' words, ' + r.heads + ' headings, ' + r.images + ' images)', 'success');
    if (r.total > r.pages) toast('Only the first ' + r.pages + ' pages were used', 'info');
    if (r.imgFull) toast('Image limit reached, remaining images were skipped', 'error');
    if (r.imgWarn) toast('Images were not imported (images.js or pdfimg.js did not run)', 'error');
    if (cutDone) toast('Text was too large, only the first ' + MAX_CHARS + ' characters were used', 'error');
  }

  function fail(e) {
    const m = (e && e.message) || '', n = e && e.name;
    if (m === 'CANCELLED') toast('PDF import cancelled');
    else if (m === 'NOLIB') toast('PDF library could not load. Check your internet', 'error');
    else if (m.indexOf('MODMISS:') === 0) toast('File not found: ' + m.slice(8) + ' (add it to the repo)', 'error');
    else if (m.indexOf('MODBAD:') === 0) toast('File is incomplete: ' + m.slice(7) + ' (paste it again)', 'error');
    else if (n === 'PasswordException') toast('This PDF is password-protected', 'error');
    else if (n === 'InvalidPDFException') toast('This does not look like a valid PDF file', 'error');
    else { console.error(e); toast('Something went wrong reading the PDF. Try another file', 'error'); }
  }

  async function run(file) {
    if (busy) return;
    if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') { toast('Choose a PDF file only', 'error'); return; }
    if (file.size > MAX_MB * 1024 * 1024) { toast('PDF is larger than ' + MAX_MB + 'MB', 'error'); return; }
    busy = true;
    cancelled = false;
    try {
      const r = await extract(file);
      hideProg();
      if (r.empty) {
        alert('No text was found in this PDF. It might be a scanned/photo PDF (every page is an image). Text recognition (OCR) is not supported yet.');
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
