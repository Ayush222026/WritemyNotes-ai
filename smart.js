(function () {
  'use strict';
  const W = window.WMN;
  const ta = document.getElementById('textInput');
  const box = document.getElementById('structure');
  if (!W || !W.parseText || !ta || !box) { console.error('Pehle ki files load nahi hui'); return; }
  const origParse = W.parseText;
  const $id = id => document.getElementById(id);

  function mk(tag, cls, txt) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt !== undefined) e.textContent = txt;
    return e;
  }
  function btn(label, fn) {
    const b = mk('button', 'btn', label);
    b.type = 'button';
    b.addEventListener('click', fn);
    return b;
  }

  /* ---------- Style ---------- */
  const sty = document.createElement('style');
  sty.textContent =
    '.sm-legend{list-style:none;padding:0;margin:8px 0 12px;display:flex;flex-direction:column;gap:6px;font-size:13px}' +
    '.sm-legend li{display:flex;align-items:center;gap:8px}' +
    '.sm-dot{width:14px;height:14px;border-radius:50%;display:inline-block;border:1px solid rgba(128,128,128,.4);flex-shrink:0}' +
    '.sm-colors{margin:10px 0;font-size:13px}' +
    '.sm-ok{color:#16a34a;font-weight:600}' +
    '.sline.tap{cursor:pointer;padding:4px 6px;border-radius:8px}' +
    '.sline.tap:hover{background:var(--bg)}' +
    '.sline.role-def .sbadge{background:#15803d;color:#fff;border-color:#15803d}' +
    '.sline.role-warn .sbadge{background:#dc2626;color:#fff;border-color:#dc2626}' +
    '.sline.role-def .stext{color:#15803d}' +
    '.sline.role-warn .stext{color:#dc2626}' +
    '.smenu{display:flex;flex-wrap:wrap;gap:6px;margin:4px 0 8px 40px}' +
    '.smenu button{border:1px solid var(--border);background:var(--bg);color:var(--text);border-radius:10px;padding:6px 10px;font:inherit;font-size:12px;cursor:pointer}' +
    '.smenu button.on{border-color:var(--blue);background:var(--card);box-shadow:0 0 0 2px rgba(79,107,255,.2)}' +
    '.shint{font-size:12px;color:var(--muted);margin-bottom:6px}';
  document.head.appendChild(sty);

  /* ---------- Settings ---------- */
  const st = { on: true, join: false };
  try {
    const o = JSON.parse(load('wmn_smart') || 'null');
    if (o && typeof o === 'object') {
      if (typeof o.on === 'boolean') st.on = o.on;
      if (typeof o.join === 'boolean') st.join = o.join;
    }
  } catch (e) { /* default */ }
  function saveSt() { store('wmn_smart', JSON.stringify(st)); }

  /* Tap se kiye gaye fixes: line ka text -> type */
  const OPTS = ['heading', 'subheading', 'normal', 'def', 'warn'];
  let over = {};
  try {
    const o = JSON.parse(load('wmn_over') || '{}');
    if (o && typeof o === 'object') {
      Object.keys(o).slice(0, 400).forEach(k => {
        if (k.length <= 300 && OPTS.indexOf(o[k]) !== -1) over[k] = o[k];
      });
    }
  } catch (e) { over = {}; }

  let ver = 0;   // badalne par PDF cache purana na rahe

  /* ---------- Rules ---------- */
  const BULCH = '[-*\\u2022\\u25AA\\u25CF\\u25E6\\u2023\\u25CB\\u25A0\\u25A1\\u2713\\u2714\\u27A2\\u27A4]';
  const BUL = new RegExp('^' + BULCH + '\\s+(.+)$');
  const MARK = new RegExp('^(#{1,6}\\s|' + BULCH + '\\s|\\d+[.)]\\s)');
  const BULSTRIP = new RegExp('^' + BULCH + '\\s+');
  const END = /[.,;!?\u0964]$/;
  const SENT = /[.!?\u0964:;]$/;
  const RE = {
    md: /^(#{1,6})\s+(.+)$/,
    num: /^(\d+)[.)]\s+(.+)$/,
    sub: /^(\d+(?:\.\d+)+)[.)]?\s+(\S.*)$/,
    chap: /^(chapter|unit|lesson|topic|section|part|module|अध्याय|इकाई|पाठ|खंड|भाग)(\s|$)/i,
    warn: /^(note|important|warning|caution|remember|tip|attention|careful|danger|नोट|ध्यान दें|ध्यान रहे|सावधान|सावधानी|चेतावनी|महत्वपूर्ण|याद रखें)\s*[:\-–—!]?(\s|$)/i,
    def: /\b(is|are) (defined as|called|known as|termed|referred to as)\b|\brefers? to\b|^(definition|def\.?|परिभाषा|formula|सूत्र|meaning|अर्थ|key point)\s*[:\-–—]|कहलाता है|कहलाती है|कहलाते हैं|कहलाते है|कहते हैं|कहते है|कहा जाता है|कही जाती है/i
  };

  const chars = s => Array.from(s).length;
  const words = s => s.split(/\s+/).filter(Boolean).length;
  function isCaps(t) { return t === t.toUpperCase() && t !== t.toLowerCase() && chars(t) <= 60; }
  function roleOf(t) {
    if (RE.warn.test(t)) return 'warn';
    if (RE.def.test(t)) return 'def';
    return 'body';
  }
  /* chhoti, bina full-stop wali line = heading ki ummeed */
  function isCand(t) {
    if (!t || chars(t) > 70 || words(t) > 9) return false;
    if (END.test(t)) return false;
    if (RE.def.test(t) || RE.warn.test(t)) return false;
    if (/^[a-z]/.test(t)) return false;
    return true;
  }
  function stripMarks(t) { return t.replace(/^#{1,6}\s+/, '').replace(BULSTRIP, ''); }

  /* PDF/website se copy kiye toote hue lines jodo */
  function joinLines(lines) {
    const out = [];
    for (const raw of lines) {
      const t = raw.trim();
      const prev = out.length ? out[out.length - 1].trim() : '';
      if (prev && t && !MARK.test(t) && !MARK.test(prev) && !SENT.test(prev) && chars(prev) >= 25 && !isCaps(prev)) {
        out[out.length - 1] = prev + ' ' + t;
      } else {
        out.push(raw);
      }
    }
    return out;
  }

  function finalize(x) {
    const o = x.key ? over[x.key] : null;
    if (o) {
      const tx = stripMarks(x.key);
      if (o === 'heading') return { type: 'heading', text: tx, key: x.key };
      if (o === 'subheading') return { type: 'subheading', text: tx, key: x.key };
      if (o === 'normal') return { type: 'paragraph', text: tx, role: 'body', key: x.key };
      if (o === 'def') return { type: 'paragraph', text: tx, role: 'def', key: x.key };
      if (o === 'warn') return { type: 'paragraph', text: tx, role: 'warn', key: x.key };
    }
    const b = { type: x.type, text: x.text, key: x.key };
    if (x.num) b.num = x.num;
    if (b.type === 'paragraph' || b.type === 'bullet' || b.type === 'number') b.role = x.role || 'body';
    return b;
  }

  /* ---------- Smart parser ---------- */
  function smartParse(raw) {
    let lines = String(raw).replace(/\r\n?/g, '\n').split('\n');
    if (st.join) lines = joinLines(lines);
    const T = lines.map(l => l.trim());
    const n = T.length;
    let lastIdx = -1;
    for (let i = 0; i < n; i++) if (T[i]) lastIdx = i;
    const items = [];

    function numNeighbour(i, want, dir) {
      let j = i + dir;
      while (j >= 0 && j < n && !T[j]) j += dir;
      if (j < 0 || j >= n) return false;
      const m = RE.num.exec(T[j]);
      return !!m && Number(m[1]) === want;
    }
    function shortAdj(j) {
      return j >= 0 && j < n && !!T[j] && isCand(T[j]) && !BUL.test(T[j]) && !RE.num.test(T[j]);
    }

    for (let i = 0; i < n; i++) {
      const t = T[i];
      if (!t) { items.push({ type: 'space' }); continue; }
      const prevBlank = i === 0 || !T[i - 1];
      const nextBlank = i === n - 1 || !T[i + 1];
      const hasNext = i < lastIdx;
      let m;

      if ((m = RE.md.exec(t))) {
        items.push({ type: m[1].length === 1 ? 'heading' : 'subheading', text: m[2].trim(), key: t });
        continue;
      }
      if ((m = BUL.exec(t))) {
        items.push({ type: 'bullet', text: m[1].trim(), key: t, role: roleOf(m[1]) });
        continue;
      }
      if ((m = RE.sub.exec(t)) && chars(t) <= 80 && !END.test(t) && words(m[2]) <= 9 && /^[A-Za-z\u0900-\u097F]/.test(m[2])) {
        items.push({ type: 'subheading', text: t, key: t });
        continue;
      }
      if ((m = RE.num.exec(t))) {
        const cur = Number(m[1]);
        const asHeading = chars(t) <= 70 && !END.test(t) && nextBlank && hasNext &&
          !numNeighbour(i, cur + 1, 1) && !numNeighbour(i, cur - 1, -1);
        if (asHeading) items.push({ type: 'heading', text: t, key: t, strength: 2 });
        else items.push({ type: 'number', num: m[1], text: m[2].trim(), key: t, role: roleOf(m[2]) });
        continue;
      }
      if (RE.warn.test(t) || RE.def.test(t)) {
        items.push({ type: 'paragraph', text: t, key: t, role: roleOf(t) });
        continue;
      }
      const short = chars(t) <= 70 && words(t) <= 9;
      if (short && /:$/.test(t)) {
        items.push({ type: 'subheading', text: t, key: t, strength: 0 });
        continue;
      }
      if (short && !END.test(t) && (RE.chap.test(t) || isCaps(t))) {
        items.push({ type: 'heading', text: t, key: t, strength: 3 });
        continue;
      }
      if (isCand(t) && prevBlank && hasNext && !shortAdj(i - 1) && !shortAdj(i + 1)) {
        items.push({ type: 'heading', text: t, key: t, strength: 1 });
        continue;
      }
      items.push({ type: 'paragraph', text: t, key: t, role: roleOf(t) });
    }

    /* H1 / H2 ka faisla */
    const hs = items.filter(x => x.strength !== undefined);
    const has3 = hs.some(x => x.strength === 3);
    const has2 = hs.some(x => x.strength === 2);
    const first1 = hs.find(x => x.strength === 1);
    hs.forEach(x => {
      if (x.strength === 3) x.type = 'heading';
      else if (x.strength === 2) x.type = has3 ? 'subheading' : 'heading';
      else if (x.strength === 1) {
        if (has2 || has3) x.type = (x === hs[0]) ? 'heading' : 'subheading';
        else x.type = (x === first1) ? 'heading' : 'subheading';
      } else x.type = 'subheading';
    });

    const out = [];
    items.forEach(x => {
      const b = x.type === 'space' ? { type: 'space', text: '' } : finalize(x);
      const last = out[out.length - 1];
      if (b.type === 'space' && (!last || last.type === 'space')) return;
      out.push(b);
    });
    while (out.length && out[out.length - 1].type === 'space') out.pop();
    return out;
  }

  /* ---------- Structure list (tap se fix) ---------- */
  const MENU = [['H1', 'heading'], ['H2', 'subheading'], ['Normal', 'normal'], ['Definition', 'def'], ['Warning', 'warn']];
  let blocks = [];
  let openIdx = -1;

  function badgeOf(b) {
    if (b.type === 'heading') return 'H1';
    if (b.type === 'subheading') return 'H2';
    if (b.type === 'bullet') return '•';
    if (b.type === 'number') return b.num + '.';
    if (b.role === 'def') return 'DEF';
    if (b.role === 'warn') return '!!';
    return '¶';
  }
  function curOpt(b) {
    if (b.type === 'heading') return 'heading';
    if (b.type === 'subheading') return 'subheading';
    if (b.role === 'def') return 'def';
    if (b.role === 'warn') return 'warn';
    return 'normal';
  }

  function paint() {
    if (!st.on) return;
    box.textContent = '';
    if (!blocks.length) {
      box.appendChild(mk('p', 'sempty', 'Text likhoge to yahan structure dikhega.'));
      return;
    }
    box.appendChild(mk('div', 'shint', 'Kisi line par tap karke uska type badlo.'));
    const LIMIT = 400;
    blocks.slice(0, LIMIT).forEach((b, i) => {
      if (b.type === 'space') { box.appendChild(mk('div', 'sline space')); return; }
      const cls = 'sline tap ' + b.type + (b.role === 'def' ? ' role-def' : b.role === 'warn' ? ' role-warn' : '');
      const row = mk('div', cls);
      row.appendChild(mk('span', 'sbadge', badgeOf(b)));
      row.appendChild(mk('span', 'stext', b.text));
      row.addEventListener('click', () => { openIdx = openIdx === i ? -1 : i; paint(); });
      box.appendChild(row);
      if (openIdx === i) {
        const menu = mk('div', 'smenu');
        const cur = curOpt(b);
        MENU.forEach(it => {
          const bt = mk('button', it[1] === cur ? 'on' : '', it[0]);
          bt.type = 'button';
          bt.addEventListener('click', e => { e.stopPropagation(); setOver(b.key, it[1]); });
          menu.appendChild(bt);
        });
        const auto = mk('button', '', '↩️ Auto');
        auto.type = 'button';
        auto.addEventListener('click', e => { e.stopPropagation(); setOver(b.key, null); });
        menu.appendChild(auto);
        box.appendChild(menu);
      }
    });
    if (blocks.length > LIMIT) {
      box.appendChild(mk('div', 'smore', '... aur lines (yahan sirf pehli ' + LIMIT + ' dikhti hain)'));
    }
  }

  function reparse() { blocks = smartParse(ta.value); paint(); }

  function commit() {
    store('wmn_over', JSON.stringify(over));
    ver++;
    openIdx = -1;
    if (st.on) reparse();
    ta.dispatchEvent(new Event('input', { bubbles: true }));   // preview aur save refresh
  }

  function setOver(key, val) {
    if (!key) return;
    if (val === null) delete over[key];
    else {
      if (!over[key] && Object.keys(over).length >= 400) { toast('Fixes ki limit (400) poori ho gayi', 'error'); return; }
      over[key] = val;
    }
    commit();
  }

  /* ---------- Smart card ---------- */
  const anchor = box.closest('.card');
  const card = mk('div', 'card');
  card.id = 'smartCard';
  card.appendChild(mk('h3', '', '🪄 Smart Detect'));
  card.appendChild(mk('p', 'muted', 'Text paste karte hi app khud pehchanta hai: heading, subheading, definition aur warning. Galti ho to neeche list mein line par tap karke theek karo.'));

  function check(id, label) {
    const l = mk('label', 'check');
    const i = document.createElement('input');
    i.type = 'checkbox';
    i.id = id;
    l.appendChild(i);
    l.appendChild(document.createTextNode(' ' + label));
    card.appendChild(l);
    return i;
  }
  const smOn = check('smOn', 'Smart detect on rakho');
  const smJoin = check('smJoin', 'Toote hue lines jodo (PDF ya website se copy kiye text ke liye)');
  const colorsEl = mk('div', 'sm-colors');
  const legendEl = mk('ul', 'sm-legend');
  card.appendChild(colorsEl);
  card.appendChild(legendEl);
  const tb = mk('div', 'toolbar');
  tb.appendChild(btn('↩️ Meri saari fixes hatao', () => {
    if (!Object.keys(over).length) { toast('Abhi koi fix nahi hai'); return; }
    if (!confirm('Tap karke kiye gaye saare fixes hata dein?')) return;
    over = {};
    commit();
    toast('Fixes hat gaye', 'success');
  }));
  card.appendChild(tb);
  if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(card, anchor);

  smOn.checked = st.on;
  smJoin.checked = st.join;

  function applyMode() {
    W.parseText = st.on ? smartParse : origParse;
    ver++;
    if (st.on) reparse();
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  }
  smOn.addEventListener('change', () => { st.on = smOn.checked; saveSt(); applyMode(); });
  smJoin.addEventListener('change', () => { st.join = smJoin.checked; saveSt(); applyMode(); });

  /* ---------- Colours ---------- */
  const MULTI_DEF = { heading: '#1e40af', sub: '#7c3aed', def: '#15803d', warn: '#dc2626', body: '#111111' };
  function penState() {
    try {
      const o = JSON.parse(load('wmn_pen') || 'null');
      return o && typeof o === 'object' ? o : {};
    } catch (e) { return {}; }
  }
  function updColors() {
    const ps = penState();
    const multi = ps.pen === 'multi';
    const m = Object.assign({}, MULTI_DEF, ps.multi || {});
    colorsEl.textContent = '';
    if (multi) {
      colorsEl.appendChild(mk('p', 'sm-ok', '✓ Auto colours on hain (Multicolour pen)'));
    } else {
      colorsEl.appendChild(mk('p', 'muted small', 'Alag colours ke liye Multicolour pen chahiye. Abhi koi aur pen chuna hua hai.'));
      colorsEl.appendChild(btn('🎨 Auto colours on karo', () => {
        const b = document.querySelector('#sPens .pen[data-id="multi"]');
        if (b) { b.click(); setTimeout(updColors, 250); }
      }));
    }
    legendEl.textContent = '';
    [['heading', 'Heading (H1)'], ['sub', 'Subheading (H2)'], ['def', 'Definition'], ['warn', 'Warning / Important'], ['body', 'Normal text']].forEach(it => {
      const li = mk('li');
      const d = mk('span', 'sm-dot');
      d.style.background = m[it[0]];
      li.appendChild(d);
      li.appendChild(document.createTextNode(it[1]));
      legendEl.appendChild(li);
    });
  }
  let ct = null;
  document.addEventListener('click', () => { clearTimeout(ct); ct = setTimeout(updColors, 250); }, true);
  document.addEventListener('change', () => { clearTimeout(ct); ct = setTimeout(updColors, 250); }, true);

  /* ---------- PDF cache ko batao ki smart settings badli hain ---------- */
  const prevGet = W.getSettings || function () { return {}; };
  W.getSettings = function () { return Object.assign({}, prevGet(), { smartVer: ver }); };

  /* ---------- Text badle to list dobara banao ---------- */
  const saveEl = $id('saveState');
  if (saveEl) {
    new MutationObserver(() => {
      if (saveEl.textContent.indexOf('Saved') !== -1) { openIdx = -1; if (st.on) reparse(); }
    }).observe(saveEl, { childList: true, characterData: true, subtree: true });
  }

  /* ---------- Start ---------- */
  W.parseText = st.on ? smartParse : origParse;
  updColors();
  if (st.on) reparse();
  if (W.refreshPreview) W.refreshPreview();
})();
