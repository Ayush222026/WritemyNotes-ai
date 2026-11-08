(function () {
  'use strict';
  const W = window.WMN;
  const ta = document.getElementById('textInput');
  const textCard = ta ? ta.closest('.card') : null;
  if (!W || !ta || !textCard) { console.error('Pehle ki files load nahi hui'); return; }
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

  /* ---------- Libraries aur chhote modules load karo ---------- */
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

  /* ---------- Extract ---------- */
  async function extract(file) {
    showProg('PDF library load ho rahi hai...', 3);
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

    showProg('PDF khul rahi hai...', 8);
    const buf = new Uint8Array(await file.arrayBuffer());
    const pdf = await lib.getDocument({ data: buf }).promise;
    const total = pdf.numPages;
    const n = Math.min(total, MAX_PAGES);
    const pages = [];
    let imgMade = 0, imgFull = false, prep = null;

    try {
      for (let p = 1; p <= n; p++) {
        if (cancelled) throw new Error('CANCELLED');
        showProg('Page ' + p + ' / ' + n + ' padh raha hoon...', Math.round(10 + 70 * p / n));
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

      showProg('Text taiyaar ho raha hai...', 82);
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

  /* ---------- Text box mein daalo ---------- */
  async function place(r, name) {
    let t = r.text;
    let mode = 'replace';
    if (ta.value.trim()) {
      mode = await choose('Text box mein pehle se text hai. PDF ka text kahan daalein?');
      if (!mode) { toast('PDF ka text nahi daala gaya'); return; }
    }
    if (mode === 'add') t = ta.value.replace(/\s+$/, '') + '\n\n' + t;
    let cutDone = false;
    if (Array.from(t).length > MAX_CHARS) { t = Array.from(t).slice(0, MAX_CHARS).join(''); cutDone = true; }
    ta.value = t;
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    status.textContent = 'Last PDF: ' + name + '  •  ' + r.pages + ' pages  •  ' + r.words + ' words  •  ' + r.heads + ' headings  •  ' + r.images + ' images';
    toast('PDF aa gayi (' + r.words + ' words, ' + r.heads + ' headings, ' + r.images + ' images)', 'success');
    if (r.total > r.pages) toast('Sirf pehle ' + r.pages + ' pages liye gaye', 'info');
    if (r.imgFull) toast('Images ki limit poori ho gayi, baaki images chhod di', 'error');
    if (r.imgWarn) toast('Images nahi li gayi (images.js ya pdfimg.js nahi chali)', 'error');
    if (cutDone) toast('Text bahut bada tha, ' + MAX_CHARS + ' characters tak hi liya', 'error');
  }

  function fail(e) {
    const m = (e && e.message) || '', n = e && e.name;
    if (m === 'CANCELLED') toast('PDF cancel ho gayi');
    else if (m === 'NOLIB') toast('PDF library load nahi hui. Internet check karo', 'error');
    else if (m.indexOf('MODMISS:') === 0) toast('File nahi mili: ' + m.slice(8) + ' (repo mein banao)', 'error');
    else if (m.indexOf('MODBAD:') === 0) toast('File adhoori hai: ' + m.slice(7) + ' (dobara paste karo)', 'error');
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
        alert('Is PDF mein text nahi mila. Shayad ye scan ya photo wali PDF hai (har page ek image hai). Abhi OCR support nahi hai.');
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
