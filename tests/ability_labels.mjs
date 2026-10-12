// Ability bar captions: every ability name (+ Dodge) at every UI size and viewport (incl. 360px phones): break only at spaces (checked per character via Range rects),
// <= 2 lines, nothing clipped / overflowing / overlapping a neighbouring caption, readable size, uniform caption heights.
import { launch, sleep } from './lib.mjs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const VPS = [[1280, 720, 0], [1024, 600, 0], [844, 390, 1], [360, 740, 1]]; const SIZES = (process.env.SIZES || 'S,M,L,XL').split(',');
for (const [W, H, T] of VPS) {
  const { browser, page, errors } = await launch({ viewport: { width: W, height: H }, touch: !!T, query: '?splash=hold' }); const ev = (f, a) => page.evaluate(f, a);
  await ev(() => { document.getElementById('splash')?.remove(); document.getElementById('rotate')?.remove(); document.body.classList.add('portraitok'); }); await sleep(800);
  const names = await ev(async () => { const m = await import('/src/config.ts'); return Object.values(m.ABILITIES).map(a => a.name); });
  for (const US of SIZES) {
    await ev(async US => { const m = await import('/src/config.ts'); m.applyUiScale(US); document.body.classList.remove('intown'); const bar = document.getElementById('hudbot'); window.__fit = (await import('/src/ablabel.ts')).fitAbLabel; document.querySelectorAll('.abtn').forEach(b => b.classList.remove('empty')); }, US); await sleep(500);
    const res = await ev(names => { const els = [...document.querySelectorAll('.abtn .aname'), document.querySelector('#dodge .aname')]; const bad = []; let hs = new Set(), minFs = 99, n = 0, ell = 0;
      const lines = el => { const t = el.firstChild; if (!t || t.nodeType !== 3) return { ok: false, why: 'no text', n: 0 }; const txt = t.data; const r = document.createRange(); let tops = [], prevTop = null, breaks = []; for (let i = 0; i < txt.length; i++) { if (/\s/.test(txt[i])) continue; r.setStart(t, i); r.setEnd(t, i + 1); const q = r.getClientRects()[0]; if (!q) continue; const top = Math.round(q.top); if (prevTop !== null && Math.abs(top - prevTop) > 3) { breaks.push(i); tops.push(top); } if (prevTop === null || Math.abs(top - prevTop) > 3) prevTop = top; } let mid = breaks.filter(i => !/\s/.test(txt[i - 1] || '')); return { n: breaks.length + 1, mid }; };
      const all = [...names, 'Dodge'];
      for (let k = 0; k < names.length; k++) { const set = els.map((e, i) => { const nm = i === 3 ? 'Dodge' : names[(k + i) % names.length]; e.textContent = nm; return nm; }); els.forEach(e => window.__fit(e)); n++;
        const rects = els.map(e => e.getBoundingClientRect()); const hh = rects.map(r => Math.round(r.height)); hh.forEach(h => hs.add(h));
        els.forEach((e, i) => { const r = rects[i], L = lines(e), cs = getComputedStyle(e), fs = parseFloat(cs.fontSize); const nm = set[i]; const isE = e.dataset.fit === 'ellipsis'; if (isE) ell++; minFs = Math.min(minFs, isE ? 99 : fs);
          if (L.mid && L.mid.length) bad.push(`${nm}: breaks inside a word`); if (!isE && L.n > 2) bad.push(`${nm}: ${L.n} lines`); if (!isE && e.scrollWidth > e.clientWidth + 1) bad.push(`${nm}: text overflows its box (${e.scrollWidth}>${e.clientWidth})`);
          if (r.left < -0.5 || r.right > innerWidth + 0.5 || r.bottom > innerHeight + 0.5) bad.push(`${nm}: label outside the viewport (${Math.round(r.left)}..${Math.round(r.right)} x ${Math.round(r.bottom)})`);
          if (!isE && fs < 9.99) bad.push(`${nm}: font ${fs}px below 10px`); });
        for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) { const a = rects[i], b = rects[j]; if (a.left < b.right - .5 && a.right > b.left + .5 && a.top < b.bottom - .5 && a.bottom > b.top + .5) bad.push(`${set[i]} / ${set[j]}: captions overlap`); } }
      return { n, bad: [...new Set(bad)].slice(0, 12), heights: [...hs], minFs, ell }; }, names);
    ok(res.bad.length === 0, `${W}x${H} UI ${US}: ${res.n} name sets x 4 captions: no mid-word breaks/overflow/clipping/overlap${res.bad.length ? ' :: ' + res.bad.join(' | ') : ''}`);
    ok(res.heights.length <= 2 && Math.max(...res.heights) - Math.min(...res.heights) <= 1, `${W}x${H} UI ${US}: caption box heights uniform (${res.heights.join(',')}px), min font ${res.minFs}px, ellipsis fallbacks ${res.ell}`);
  }
  ok(errors.length === 0, `${W}x${H}: no page errors ${errors[0] || ''}`); await browser.close();
}
console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
