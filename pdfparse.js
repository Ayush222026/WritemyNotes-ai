(function () {
  'use strict';
  const W = window.WMN = window.WMN || {};
  const median = a => { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
  const r05 = x => Math.round(x * 2) / 2;

  /* Page ke items -> lines (upar se neeche) */
  function buildLines(items) {
    const its = [];
    for (const it of items) {
      if (!it || typeof it.str !== 'string' || !it.transform || !it.str.length) continue;
      const t = it.transform;
      if (!t[0] || Math.abs(t[1]) > 0.1 * Math.abs(t[0])) continue;
      const size = Math.hypot(t[0], t[1]);
      if (!(size > 1)) continue;
      its.push({ s: it.str, x: t[4], y: t[5], w: it.width || 0, size: size });
    }
    its.sort((a, b) => (b.y - a.y) || (a.x - b.x));

    const lines = [];
    let cur = null;
    for (const it of its) {
      if (cur && Math.abs(it.y - cur.y) <= 0.45 * Math.max(it.size, cur.maxSize)) {
        cur.items.push(it);
        if (it.size > cur.maxSize) cur.maxSize = it.size;
      } else {
        cur = { y: it.y, maxSize: it.size, items: [it] };
        lines.push(cur);
      }
    }

    const out = [];
    for (const ln of lines) {
      ln.items.sort((a, b) => a.x - b.x);
      let text = '', prev = null;
      const sizeW = new Map();
      for (const it of ln.items) {
        if (prev) {
          const gap = it.x - (prev.x + prev.w);
          if (gap > 0.18 * it.size && !/\s$/.test(text) && !/^\s/.test(it.s)) text += ' ';
        }
        text += it.s;
        const k = r05(it.size);
        sizeW.set(k, (sizeW.get(k) || 0) + it.s.trim().length);
        prev = it;
      }
      text = text.replace(/\s+/g, ' ').trim();
      if (!text) continue;
      let best = 0, bw = -1;
      sizeW.forEach((w, k) => { if (w > bw) { bw = w; best = k; } });
      out.push({ text: text, x: ln.items[0].x, y: ln.y, size: best || r05(ln.maxSize) });
    }
    return out;
  }

  /* Header / footer / page numbers */
  const PAGENUM = /^(page\s*)?[-\u2013]?\s*\d{1,4}\s*[-\u2013]?(\s*(of|\/)\s*\d{1,4})?$/i;
  const norm = t => t.toLowerCase().replace(/\d+/g, '#').replace(/\s+/g, ' ').trim();

  function cands(pg) {
    const L = pg.lines, res = [], seen = new Set();
    const add = (ln, k) => { if (!seen.has(ln)) { seen.add(ln); res.push([ln, k + norm(ln.text)]); } };
    for (let i = 0; i < Math.min(2, L.length); i++) if (L[i].y > pg.H * 0.9) add(L[i], 'T');
    for (let i = Math.max(0, L.length - 2); i < L.length; i++) if (L[i].y < pg.H * 0.1) add(L[i], 'B');
    return res;
  }

  function stripHF(pages) {
    const cnt = new Map();
    pages.forEach(pg => {
      new Set(cands(pg).map(c => c[1])).forEach(k => cnt.set(k, (cnt.get(k) || 0) + 1));
    });
    const need = Math.max(2, Math.ceil(pages.length * 0.5));
    let removed = 0;
    pages.forEach(pg => {
      const kill = new Set();
      cands(pg).forEach(c => {
        const repeated = pages.length >= 3 && cnt.get(c[1]) >= need;
        if (repeated || PAGENUM.test(c[0].text.trim())) kill.add(c[0]);
      });
      if (kill.size) { removed += kill.size; pg.lines = pg.lines.filter(l => !kill.has(l)); }
    });
    return removed;
  }

  /* Body font size aur normal line gap */
  function bodySize(pages) {
    const m = new Map();
    pages.forEach(pg => pg.lines.forEach(l => {
      const k = r05(l.size);
      m.set(k, (m.get(k) || 0) + l.text.length);
    }));
    let best = 11, bw = -1;
    m.forEach((w, k) => { if (w > bw) { bw = w; best = k; } });
    return best;
  }

  function typicalGap(pages, body) {
    const g = [];
    pages.forEach(pg => {
      for (let i = 1; i < pg.lines.length; i++) {
        const a = pg.lines[i - 1], b = pg.lines[i];
        if (Math.abs(a.size - body) <= 1 && Math.abs(b.size - body) <= 1) {
          const d = a.y - b.y;
          if (d > body * 0.7 && d < body * 3) g.push(d);
        }
      }
    });
    return median(g) || body * 1.3;
  }

  /* Lines + images -> blocks */
  const BUL = /^([\u2022\u25CF\u25AA\u25E6\u25CB\u25A0\u25A1\u2713\u2714\u27A2\u27A4\-\u2013\u2014*])\s+(\S.*)$/;
  const NUM = /^(\d{1,3})[.)]\s+(\S.*)$/;
  const TERM = /[.!?:;\u0964)"'\u201D\u2019]$/;

  function glue(a, b, hy) {
    if (hy && /[A-Za-z\u0900-\u097F]-$/.test(a) && /^[a-z\u0900-\u097F]/.test(b)) return a.slice(0, -1) + b;
    return a + ' ' + b;
  }

  function build(pages, body, typ, hy) {
    const blocks = [];
    let cur = null, prev = null;
    pages.forEach(pg => {
      const imgs = (pg.imgs || []).slice().sort((a, b) => b.cy - a.cy);
      let ip = 0;
      const flush = y => {
        while (ip < imgs.length && imgs[ip].cy >= y) {
          blocks.push({ kind: 'i', id: imgs[ip].id });
          cur = null; prev = null; ip++;
        }
      };
      pg.lines.forEach((ln, li) => {
        flush(ln.y);
        const first = li === 0;
        const head = ln.size >= body * 1.15 && Array.from(ln.text).length <= 120;
        let mb = null, mn = null;
        if (!head) { mb = BUL.exec(ln.text); mn = mb ? null : NUM.exec(ln.text); }
        const gap = (prev && !first) ? prev.y - ln.y : null;

        let join = false;
        if (cur) {
          if (head) {
            join = cur.kind === 'h' && Math.abs(ln.size - cur.size) < 0.6 && gap !== null && gap <= ln.size * 1.5;
          } else if (cur.kind !== 'h' && !mb && !mn && Math.abs(ln.size - cur.size) <= 1) {
            if (cur.kind === 'b' || cur.kind === 'n') {
              join = gap !== null && gap <= typ * 1.45 && ln.x > cur.x + body * 0.4;
            } else {
              join = gap !== null ? gap <= typ * 1.45 : !TERM.test(cur.text);
            }
          }
        }

        if (join) {
          cur.text = glue(cur.text, ln.text, hy);
        } else {
          if (head) cur = { kind: 'h', size: ln.size, text: ln.text, x: ln.x };
          else if (mb) cur = { kind: 'b', size: ln.size, text: mb[2], x: ln.x };
          else if (mn) cur = { kind: 'n', num: mn[1], size: ln.size, text: mn[2], x: ln.x };
          else cur = { kind: 'p', size: ln.size, text: ln.text, x: ln.x };
          blocks.push(cur);
        }
        prev = ln;
      });
      flush(-Infinity);
    });

    const hs = Array.from(new Set(blocks.filter(b => b.kind === 'h').map(b => r05(b.size)))).sort((a, b) => b - a);
    blocks.forEach(b => { if (b.kind === 'h') b.level = r05(b.size) === hs[0] ? 1 : 2; });
    return blocks;
  }

  function toText(blocks) {
    const out = [];
    let prevKind = '';
    blocks.forEach(b => {
      if (b.kind === 'i') {
        if (out.length) out.push('');
        out.push('[[img:' + b.id + ']]');
        prevKind = 'i';
        return;
      }
      const text = b.text.trim();
      if (!text) return;
      const list = b.kind === 'b' || b.kind === 'n';
      if (out.length && !(list && (prevKind === 'b' || prevKind === 'n'))) out.push('');
      if (b.kind === 'h') out.push((b.level === 1 ? '# ' : '## ') + text);
      else if (b.kind === 'b') out.push('- ' + text);
      else if (b.kind === 'n') out.push(b.num + '. ' + text);
      else out.push(text);
      prevKind = b.kind;
    });
    return out.join('\n');
  }

  W.pdfParse = {
    lines: buildLines,
    prep: function (pages, opt) {
      const removed = opt.hf ? stripHF(pages) : 0;
      const chars = pages.reduce((a, pg) => a + pg.lines.reduce((b, l) => b + l.text.length, 0), 0);
      return { removed: removed, empty: chars < Math.max(40, 15 * pages.length) };
    },
    finish: function (pages, opt) {
      const body = bodySize(pages);
      const blocks = build(pages, body, typicalGap(pages, body), opt.hy);
      const text = toText(blocks);
      return {
        text: text,
        heads: blocks.filter(b => b.kind === 'h').length,
        words: text.split(/\s+/).filter(Boolean).length
      };
    }
  };
})();
