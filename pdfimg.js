(function () {
  'use strict';
  const W = window.WMN = window.WMN || {};
  const MAXI = 60;

  function mulPdf(M, C) {
    return [
      M[0] * C[0] + M[1] * C[2], M[0] * C[1] + M[1] * C[3],
      M[2] * C[0] + M[3] * C[2], M[2] * C[1] + M[3] * C[3],
      M[4] * C[0] + M[5] * C[2] + C[4], M[4] * C[1] + M[5] * C[3] + C[5]
    ];
  }

  /* Page ki images ki jagah dhundo */
  async function find(page, OPS) {
    const ol = await page.getOperatorList();
    const fa = ol.fnArray, aa = ol.argsArray;
    const res = [];
    let ctm = [1, 0, 0, 1, 0, 0];
    const stack = [];
    for (let i = 0; i < fa.length; i++) {
      const f = fa[i], a = aa[i];
      if (f === OPS.save) stack.push(ctm.slice());
      else if (f === OPS.restore) { if (stack.length) ctm = stack.pop(); }
      else if (f === OPS.transform) ctm = mulPdf(a, ctm);
      else if (f === OPS.paintFormXObjectBegin) { stack.push(ctm.slice()); if (a && a[0]) ctm = mulPdf(a[0], ctm); }
      else if (f === OPS.paintFormXObjectEnd) { if (stack.length) ctm = stack.pop(); }
      else if (f === OPS.paintImageXObject || f === OPS.paintInlineImageXObject) {
        let pw = 0, ph = 0;
        if (f === OPS.paintImageXObject) { pw = (a && a[1]) || 0; ph = (a && a[2]) || 0; }
        else if (a && a[0]) { pw = a[0].width || 0; ph = a[0].height || 0; }
        const xs = [], ys = [];
        [[0, 0], [1, 0], [0, 1], [1, 1]].forEach(p => {
          xs.push(ctm[0] * p[0] + ctm[2] * p[1] + ctm[4]);
          ys.push(ctm[1] * p[0] + ctm[3] * p[1] + ctm[5]);
        });
        res.push({
          x0: Math.min.apply(null, xs), x1: Math.max.apply(null, xs),
          y0: Math.min.apply(null, ys), y1: Math.max.apply(null, ys), pw: pw, ph: ph
        });
      }
    }
    return res;
  }

  function overlap(a, b) {
    const w = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
    const h = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
    if (w <= 0 || h <= 0) return 0;
    return (w * h) / Math.min((a.x1 - a.x0) * (a.y1 - a.y0), (b.x1 - b.x0) * (b.y1 - b.y0));
  }

  /* Chhoti icons, poore page ka background aur repeat hone wale logo hatao */
  function filter(pages) {
    const keyOf = c => Math.round((c.x1 - c.x0) / 8) + 'x' + Math.round((c.y1 - c.y0) / 8) + '@' + Math.round(c.x0 / 12) + ',' + Math.round(c.y0 / 12);
    const cnt = new Map();
    pages.forEach(pg => {
      new Set((pg.cand || []).map(keyOf)).forEach(k => cnt.set(k, (cnt.get(k) || 0) + 1));
    });
    const need = Math.max(2, Math.ceil(pages.length * 0.5));
    pages.forEach(pg => {
      const area = pg.Wd * pg.H;
      const keep = [];
      (pg.cand || []).forEach(c => {
        const w = c.x1 - c.x0, h = c.y1 - c.y0;
        if (w < 36 || h < 36) return;
        if (c.pw && c.ph && c.pw < 40 && c.ph < 40) return;
        if (w * h > area * 0.85) return;
        if (pages.length >= 3 && cnt.get(keyOf(c)) >= need) return;
        if (keep.some(k => overlap(k, c) > 0.9)) return;
        keep.push(c);
      });
      pg.keep = keep;
    });
  }

  /* Page ko render karke image wali jagah crop karo aur library mein save karo */
  async function crop(pdf, pages, env) {
    let made = 0, full = false;
    const withImg = pages.filter(pg => pg.keep && pg.keep.length).length;
    let doneP = 0;
    for (let p = 0; p < pages.length && !full; p++) {
      const pg = pages[p];
      if (!pg.keep || !pg.keep.length) continue;
      if (env.isCancelled()) throw new Error('CANCELLED');
      doneP++;
      env.progress('Images nikal raha hoon... (' + doneP + ' / ' + withImg + ' pages)', Math.round(84 + 14 * doneP / withImg));
      const page = await pdf.getPage(p + 1);
      const vp = page.getViewport({ scale: 2.5 });
      const cv = document.createElement('canvas');
      cv.width = Math.ceil(vp.width); cv.height = Math.ceil(vp.height);
      const cx = cv.getContext('2d');
      cx.fillStyle = '#fff';
      cx.fillRect(0, 0, cv.width, cv.height);
      await page.render({ canvasContext: cx, viewport: vp }).promise;
      pg.imgs = [];
      for (const c of pg.keep) {
        if (made >= MAXI) { full = true; break; }
        const r = vp.convertToViewportRectangle([c.x0, c.y0, c.x1, c.y1]);
        const rx0 = Math.max(0, Math.floor(Math.min(r[0], r[2])));
        const ry0 = Math.max(0, Math.floor(Math.min(r[1], r[3])));
        const rx1 = Math.min(cv.width, Math.ceil(Math.max(r[0], r[2])));
        const ry1 = Math.min(cv.height, Math.ceil(Math.max(r[1], r[3])));
        const w = rx1 - rx0, h = ry1 - ry0;
        if (w < 40 || h < 40) continue;
        const piece = document.createElement('canvas');
        piece.width = w; piece.height = h;
        piece.getContext('2d').drawImage(cv, rx0, ry0, w, h, 0, 0, w, h);
        try {
          const id = await W.images.add(piece, 'PDF page ' + (p + 1), false);
          pg.imgs.push({ id: id, cy: (c.y0 + c.y1) / 2 });
          made++;
        } catch (e) {
          if (e && e.message === 'FULL') { full = true; break; }
          console.error(e);
        }
      }
      cv.width = 0; cv.height = 0;
      page.cleanup();
      await env.tick();
    }
    return { made: made, full: full };
  }

  W.pdfImg = { find: find, filter: filter, crop: crop };
})();
