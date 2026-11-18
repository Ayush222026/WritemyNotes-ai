(function () {
  'use strict';
  const W = window.WMN;
  const E = W && W.engine;
  if (!E) { console.error('engine.js not loaded'); return; }
  const $id = id => document.getElementById(id);
  if (!$id('cvCard')) return;

  const FIELDS = [
    ['school', 'School / College Name', 80, true, 'e.g. ABC Public School'],
    ['title', 'Assignment Title', 120, true, 'e.g. Chapter 1 Notes'],
    ['name', 'Student Name', 60, false, ''],
    ['roll', 'Roll Number', 30, false, ''],
    ['cls', 'Class', 30, false, ''],
    ['section', 'Section', 20, false, ''],
    ['subject', 'Subject', 60, false, ''],
    ['teacher', 'Teacher Name', 60, false, ''],
    ['date', 'Submission Date', 10, false, '']
  ];

  const TPLS = [
    ['classic', 'Classic Border'],
    ['modern', 'Modern Blue'],
    ['minimal', 'Minimal Line'],
    ['notebook', 'Notebook Label'],
    ['elegant', 'Elegant Purple']
  ];

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function pad(n) { return n < 10 ? '0' + n : String(n); }
  function fmtDate(v) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || '');
    if (!m) return '';
    const mi = Number(m[2]) - 1;
    if (mi < 0 || mi > 11) return '';
    return m[3] + ' ' + MONTHS[mi] + ' ' + m[1];
  }

  const DEFAULT_F = {};
  FIELDS.forEach(f => { DEFAULT_F[f[0]] = ''; });

  function sanitize(o) {
    const s = { on: false, tpl: 'classic', f: Object.assign({}, DEFAULT_F) };
    if (!o || typeof o !== 'object') return s;
    s.on = !!o.on;
    if (TPLS.some(t => t[0] === o.tpl)) s.tpl = o.tpl;
    if (o.f && typeof o.f === 'object') {
      FIELDS.forEach(f => {
        const v = o.f[f[0]];
        if (typeof v === 'string') s.f[f[0]] = Array.from(v).slice(0, f[2]).join('');
      });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s.f.date)) s.f.date = '';
    return s;
  }

  let state = sanitize(null);
  try {
    const raw = load('wmn_cover');
    if (raw) state = sanitize(JSON.parse(raw));
  } catch (e) { /* use default */ }

  function save() { store('wmn_cover', JSON.stringify(state)); }

  function ellipsize(ctx, text, maxW) {
    if (ctx.measureText(text).width <= maxW) return text;
    const ch = Array.from(text);
    while (ch.length > 1 && ctx.measureText(ch.join('') + '…').width > maxW) ch.pop();
    return ch.join('') + '…';
  }

  function fit(ctx, text, fontFn, size, minSize, maxW) {
    let sz = Math.max(size, minSize);
    ctx.font = fontFn(sz);
    while (sz > minSize && ctx.measureText(text).width > maxW) { sz -= 1; ctx.font = fontFn(sz); }
    return { size: sz, text: ellipsize(ctx, text, maxW) };
  }

  function wrapWords(ctx, text, maxW) {
    const words = text.split(/\s+/).filter(Boolean);
    const lines = [];
    let cur = '';
    for (const w of words) {
      const t = cur ? cur + ' ' + w : w;
      if (!cur || ctx.measureText(t).width <= maxW) cur = t;
      else { lines.push(cur); cur = w; }
    }
    if (cur) lines.push(cur);
    return lines;
  }

  function fitLines(ctx, text, fontFn, size, minSize, maxW, maxLines) {
    let sz = Math.max(size, minSize), lines;
    for (;;) {
      ctx.font = fontFn(sz);
      lines = wrapWords(ctx, text, maxW);
      const wide = lines.some(l => ctx.measureText(l).width > maxW);
      if ((lines.length <= maxLines && !wide) || sz <= minSize) break;
      sz -= 1;
    }
    if (lines.length > maxLines) {
      lines = lines.slice(0, maxLines);
      lines[maxLines - 1] += '…';
    }
    lines = lines.map(l => ellipsize(ctx, l, maxW));
    return { size: sz, lines: lines };
  }

  function hText(ctx, s, text, x, y, color) {
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.globalAlpha = s.opacity;
    ctx.fillText(text, x, y);
    if (s.ink > 0) {
      ctx.lineWidth = s.ink;
      ctx.lineJoin = 'round';
      ctx.strokeText(text, x, y);
    }
    ctx.globalAlpha = 1;
  }

  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function content(ctx, s, d, o) {
    const k = o.k, fs = s.fontScale || 1;
    const hf = sz => Math.round(sz) + 'px ' + s.fontFamily;
    const pf = (w, sz) => w + ' ' + Math.round(sz) + 'px "Poppins","Kalam",sans-serif';
    const body = s.colors.body, head = s.colors.heading;
    const maxW = o.x1 - o.x0;
    const ax = o.align === 'center' ? (o.x0 + o.x1) / 2 : o.x0;
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = o.align;

    const school = d.school.trim();
    if (school) {
      const f = fit(ctx, school, hf, 36 * k * fs, 16 * k * fs, maxW);
      ctx.font = hf(f.size);
      hText(ctx, s, f.text, ax, o.schoolY, o.schoolColor || head);
    }

    ctx.font = pf('600', 15 * k);
    ctx.fillStyle = o.accent;
    ctx.fillText('A S S I G N M E N T', ax, o.titleY - 58 * k);

    let lastY = o.titleY;
    const title = d.title.trim();
    if (title) {
      const t = fitLines(ctx, title, hf, 48 * k * fs, 24 * k * fs, maxW, 3);
      const lh = t.size * 1.22;
      ctx.font = hf(t.size);
      t.lines.forEach((ln, i) => {
        lastY = o.titleY + i * lh;
        hText(ctx, s, ln, ax, lastY, head);
      });
    }
    ctx.strokeStyle = o.accent;
    ctx.lineWidth = 3 * k;
    ctx.lineCap = 'round';
    ctx.beginPath();
    if (o.align === 'center') { ctx.moveTo(ax - 70 * k, lastY + 16 * k); ctx.lineTo(ax + 70 * k, lastY + 16 * k); }
    else { ctx.moveTo(ax, lastY + 16 * k); ctx.lineTo(ax + 140 * k, lastY + 16 * k); }
    ctx.stroke();

    const rows = [
      ['Student Name', d.name], ['Roll Number', d.roll], ['Class', d.cls],
      ['Section', d.section], ['Subject', d.subject], ['Teacher Name', d.teacher],
      ['Submission Date', fmtDate(d.date)]
    ];
    const gap = o.rowGap || Math.min(62 * k, (s.pageH * 0.92 - o.rowsY) / rows.length);
    const rx0 = o.rx0 !== undefined ? o.rx0 : o.x0;
    const rx1 = o.rx1 !== undefined ? o.rx1 : o.x1;
    const lblW = 170 * k;
    const vx = rx0 + lblW;

    rows.forEach((r, i) => {
      const by = o.rowsY + i * gap;
      ctx.textAlign = 'left';
      ctx.font = pf('500', 16 * k);
      ctx.fillStyle = o.label;
      ctx.fillText(r[0] + ':', rx0, by);

      ctx.strokeStyle = o.rule;
      ctx.lineWidth = Math.max(1, 1.2 * k);
      ctx.lineCap = 'butt';
      ctx.beginPath();
      ctx.moveTo(vx, by + 8 * k);
      ctx.lineTo(rx1, by + 8 * k);
      ctx.stroke();

      const v = (r[1] || '').trim();
      if (v) {
        const f = fit(ctx, v, hf, 30 * k * fs, 14 * k * fs, rx1 - vx - 10 * k);
        ctx.font = hf(f.size);
        hText(ctx, s, f.text, vx + 6 * k, by + 2 * k, body);
      }
    });
  }

  const TPL = {
    classic: function (ctx, s, k) {
      const W_ = s.pageW, H = s.pageH;
      ctx.strokeStyle = '#1f2a5c';
      ctx.lineWidth = 4 * k;
      ctx.strokeRect(36 * k, 36 * k, W_ - 72 * k, H - 72 * k);
      ctx.lineWidth = 1.2 * k;
      ctx.strokeRect(50 * k, 50 * k, W_ - 100 * k, H - 100 * k);
      ctx.fillStyle = '#1f2a5c';
      [[36, 36], [W_ / k - 36, 36], [36, H / k - 36], [W_ / k - 36, H / k - 36]].forEach(p => {
        ctx.fillRect(p[0] * k - 7 * k, p[1] * k - 7 * k, 14 * k, 14 * k);
      });
      return { align: 'center', x0: 110 * k, x1: W_ - 110 * k, schoolY: H * 0.17, titleY: H * 0.36,
        rowsY: H * 0.52, accent: '#1f2a5c', label: '#333333', rule: '#9aa0b5' };
    },

    modern: function (ctx, s, k) {
      const W_ = s.pageW, H = s.pageH;
      const g = ctx.createLinearGradient(0, 0, W_, H * 0.3);
      g.addColorStop(0, '#4f6bff');
      g.addColorStop(1, '#8b5cf6');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W_, H * 0.28);
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.beginPath(); ctx.arc(W_ * 0.86, H * 0.05, 90 * k, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(W_ * 0.08, H * 0.26, 60 * k, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = g;
      ctx.fillRect(0, H - 16 * k, W_, 16 * k);
      return { align: 'center', x0: 100 * k, x1: W_ - 100 * k, schoolY: H * 0.15, schoolColor: '#ffffff',
        titleY: H * 0.42, rowsY: H * 0.56, accent: '#6d4aff', label: '#444444', rule: '#b9bdd6' };
    },

    minimal: function (ctx, s, k) {
      const W_ = s.pageW, H = s.pageH;
      ctx.fillStyle = '#4f6bff';
      ctx.fillRect(56 * k, 0, 12 * k, H);
      ctx.fillStyle = '#8b5cf6';
