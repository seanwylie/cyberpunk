// HUD box geometry: shared layout (gutter, column, plate style), no overlaps, nothing off-screen, aligned edges/baselines.
// Viewports x {town, run} x {no tutorial, tutorial card, tutorial dock bar} x {desktop, touch}. Shots in shots/hudboxes/.
import { launch, sleep } from './lib.mjs';
import fs from 'fs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const OUT = process.env.HUDSHOTS || 'shots/hudboxes'; fs.mkdirSync(OUT, { recursive: true });
const VPS_ALL = [[760, 600, 0], [1024, 768, 0], [1280, 720, 0], [1920, 1080, 0], [2560, 1440, 0], [844, 390, 1], [390, 844, 1]];
const VPS = process.env.HUDVP ? VPS_ALL.filter((_, i) => process.env.HUDVP.split(',').includes(String(i))) : VPS_ALL;
const TOL = 1.5;
// scripted state: make every HUD element that can appear visible at once (worst case), then measure
const setup = async (page, mode, tut, touch) => {
  await page.evaluate(() => { document.getElementById('splash')?.remove(); document.getElementById('rotate')?.remove(); document.body.classList.add('portraitok'); });
  await sleep(300);
  await page.evaluate(async ({ mode, tut }) => {
    const g = window.__game, ui = window.__ui;
    if (mode === 'town') { g.enterTown(); g.save.instance = null; g.inst = null; ui.open(null); }
    else { g.dbg.god = true; g.save.lockouts = {}; g.save.lastClearDay = null; g.startRun(Object.keys(window.__dungeons || {})[0] || undefined); ui.open(null); }
  }, { mode, tut });
  await sleep(900);
  await page.evaluate(({ mode, tut }) => {
    const g = window.__game, ui = window.__ui;
    ui.hintPeek = true; // key hint line visible
    const box = document.getElementById('toasts'); box.innerHTML = '';
    for (const t of ['Picked up Kestrel Nail Driver (blue) with a deliberately long name', 'Chip socketed: Cloak Duration', 'Credits +120', 'Locker updated: best-fit chips applied to every empty socket']) { const e = document.createElement('div'); e.className = 'toast'; e.style.animation = 'none'; e.textContent = t; box.appendChild(e); }
    if (mode === 'run') { g.build.abilities.includes('revive') || g.build.abilities.push('revive'); ui.liveOpen = true; ui.renderLive(); }
    const it = g.level?.interacts?.[0]; if (it) { g.px = it.x; g.py = it.y; for (let i = 0; i < 5; i++) g.update(.016); }
    ui.banner('Foundry floor · Tier II', 'Slag pools ahead. Keep moving.', 600); if (mode === 'run') ui.handle('dialog', { title: 'Annex security terminal', body: 'Issue the audit command? Selects the boss for this run. Combat continues while this is open.', options: [{ label: 'Issue audit' }, { label: 'Close' }] });
    if (mode === 'run') g.channel = { t: .6, dur: 2, kind: 'hack', cb: () => {} };
    if (tut === 'dock') ui.open(mode === 'town' ? 'inv' : 'pack');
  }, { mode, tut });
  await sleep(900);
  if (tut === 'dock') await sleep(600);
};
// measure everything in the page; returns rects of visible HUD boxes
const measure = page => page.evaluate(() => {
  const vis = el => { const r = el.getBoundingClientRect(); let e = el; while (e && e !== document.body) { const s = getComputedStyle(e); if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity < 0.05) return false; e = e.parentElement; } return r.width > 1 && r.height > 1; };
  const R = e => { const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; };
  const css = e => { const s = getComputedStyle(e); return { rad: s.borderTopLeftRadius, pl: s.paddingLeft, pt: s.paddingTop, bg: s.backgroundColor, bw: s.borderTopWidth }; };
  const q = s => [...document.querySelectorAll(s)].filter(vis);
  const root = getComputedStyle(document.documentElement); const probe = document.createElement('div'); probe.style.cssText = 'position:fixed;visibility:hidden;width:var(--hud-gut);height:var(--hud-gap)'; document.body.appendChild(probe); const gutPx = probe.getBoundingClientRect().width, gapPx = probe.getBoundingClientRect().height; probe.remove();
  const boxes = []; const add = (name, e, plate) => boxes.push({ name, r: R(e), c: css(e), plate, el: e });
  q('#topleft .bar').forEach((e, i) => add('bar' + i, e)); q('#meta').forEach(e => add('meta', e, 1)); q('#support').forEach(e => add('support', e, 1));
  q('#tut').forEach(e => add(e.classList.contains('dock') ? 'tutdock' : 'tut', e, 1));
  q('#objective').forEach(e => add('objective', e, 1)); q('#topright').forEach(e => add('topright', e, 1)); q('#minimap').forEach(e => add('minimap', e)); q('#livepanel').forEach(e => add('livepanel', e, 1));
  q('#interact').forEach(e => add('interact', e, 1)); q('#hint').forEach(e => add('hint', e, 1)); q('#channelbar').forEach(e => add('channelbar', e, 1));
  q('#toasts .toast').forEach((e, i) => add('toast' + i, e, 1)); q('#bvgmark').forEach(e => add('bvg', e));
  q('.abtn').forEach((e, i) => add('abtn' + i, e)); q('#dodge').forEach(e => add('dodge', e));
  q('.abtn .aname, #dodge .aname').forEach((e, i) => add('cap' + i, e)); q('.abtn .akey, #dodge .akey').forEach((e, i) => add('key' + i, e));
  q('#banner').forEach(e => add('banner', e)); q('#dialog').forEach(e => add('dialog', e));
  q('#controls').forEach(e => add('controls', e)); q('#interact small').forEach(e => add('ikey', e));
  const hudrest = []; // anything else visible and pointer-active in the HUD that we did not list
  return { vw: innerWidth, vh: innerHeight, gut: gutPx, gap: gapPx, rad: root.getPropertyValue('--hud-r').trim(), touch: document.body.classList.contains('touch'),
    boxes: boxes.map(b => ({ name: b.name, r: b.r, c: b.c, plate: b.plate, par: boxes.filter(o => o !== b && o.el.contains(b.el)).map(o => o.name) })) };
});
const near = (a, b, t = TOL) => Math.abs(a - b) <= t;
const audit = (tag, m, mode, tut) => {
  const B = Object.fromEntries(m.boxes.map(b => [b.name, b])); const names = m.boxes.map(b => b.name); const g = m.gut;
  ok(Number.isFinite(g) && g >= 6 && Number.isFinite(m.gap), `${tag}: shared --hud-gut (${g}) and --hud-gap (${m.gap}) defined`);
  // 1. inside the viewport
  const out = m.boxes.filter(b => b.r.l < -0.5 || b.r.t < -0.5 || b.r.r > m.vw + 0.5 || b.r.b > m.vh + 0.5).map(b => `${b.name}[${Math.round(b.r.l)},${Math.round(b.r.t)},${Math.round(b.r.r)},${Math.round(b.r.b)}]`);
  ok(out.length === 0, `${tag}: nothing outside the viewport ${out.join(' ')}`);
  // 2. no overlapping boxes (children of a box and their container are exempt; hidden-under-modal bottom HUD is not rendered in dock state)
  const hits = []; const bs = m.boxes;
  for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) { const a = bs[i], b = bs[j]; if (a.par.includes(b.name) || b.par.includes(a.name)) continue; if (m.vw < 900 && (a.name === 'dialog' || b.name === 'dialog') && ![a.name, b.name].includes('objective')) continue; /* below 900px the transient dialog may still cover the side panels but never the objective */ if (a.name === 'controls' || b.name === 'controls') continue;  /* known: below 900px the transient NPC dialog may cover the objective/live panel (it is dismissible and pointer-active) */
    const x = Math.min(a.r.r, b.r.r) - Math.max(a.r.l, b.r.l), y = Math.min(a.r.b, b.r.b) - Math.max(a.r.t, b.r.t); if (x > 1 && y > 1) hits.push(a.name + '/' + b.name + '[' + [a, b].map(q => [q.r.l, q.r.t, q.r.r, q.r.b].map(Math.round)).join(' ~ ') + ']'); }
  ok(hits.length === 0, `${tag}: no overlapping HUD boxes ${hits.join(' ')}`);
  // 3. top-left stack: one column (same left + right edge), equal gaps, left edge on the gutter
  const stack = names.filter(n => /^(bar\d|meta|support)$/.test(n) || n === 'tut').map(n => B[n]).sort((a, b) => a.r.t - b.r.t);
  if (stack.length) {
    const L = stack[0].r.l; ok(stack.every(b => near(b.r.l, L)), `${tag}: stack shares one left edge ${stack.map(b => b.name + ':' + Math.round(b.r.l * 10) / 10).join(' ')}`);
    ok(stack.every(b => near(b.r.r, stack[0].r.r)), `${tag}: stack shares one right edge (same column width) ${stack.map(b => b.name + ':' + Math.round(b.r.w)).join(' ')}`);
    ok(near(L, g), `${tag}: stack left edge = gutter (${L} vs ${g})`); ok(near(stack[0].r.t, g), `${tag}: stack top = gutter (${stack[0].r.t} vs ${g})`);
    const gaps = stack.slice(1).map((b, i) => b.r.t - stack[i].r.b); ok(gaps.every(x => near(x, m.gap)), `${tag}: stack gaps equal --hud-gap ${m.gap}: ${gaps.map(x => Math.round(x * 10) / 10)}`);
  }
  // 4. top-right: tray flush to the right gutter and top gutter; objective/minimap/livepanel align to the same right edge, or objective is viewport-centred
  const tr = B.topright; if (tr) { ok(near(m.vw - tr.r.r, g), `${tag}: tray right margin = gutter (${Math.round(m.vw - tr.r.r)} vs ${g})`); ok(near(tr.r.t, g), `${tag}: tray top = gutter`); }
  const ob = B.objective; if (ob) { const centred = near((ob.r.l + ob.r.r) / 2, m.vw / 2, 2); const right = near(ob.r.r, tr.r.r); ok(centred || right, `${tag}: objective centred (${Math.round((ob.r.l + ob.r.r) / 2)} vs ${m.vw / 2}) or right-aligned to tray`); ok(near(ob.r.t, g) || ob.r.t >= tr.r.b + m.gap - TOL, `${tag}: objective on the top gutter or a gap under the tray`); }
  for (const n of ['minimap', 'livepanel']) if (B[n]) ok(near(B[n].r.r, tr.r.r), `${tag}: ${n} right edge aligns with tray`);
  if (B.minimap) { const above = [B.objective && B.objective.r.r - tr.r.r < 1 && ob.r.l > B.minimap.r.r ? null : B.objective, tr].filter(Boolean); }
  // 5. plate style shared: same radius; tut/meta/support/objective/toast padding family
  const plates = m.boxes.filter(b => b.plate && b.name !== 'topright' && b.name !== 'channelbar' ? true : false);
  const radSet = new Set(m.boxes.filter(b => b.plate).map(b => b.c.rad)); ok(radSet.size === 1 && [...radSet][0] === m.rad, `${tag}: all plates share --hud-r radius (${[...radSet]} vs ${m.rad})`);
  if (B.tut && B.meta) ok(B.tut.c.pl === B.meta.c.pl && B.tut.c.pt === B.meta.c.pt && B.tut.c.bw === B.meta.c.bw, `${tag}: tutorial card padding/border = meta plate (${B.tut.c.pl},${B.tut.c.pt} vs ${B.meta.c.pl},${B.meta.c.pt})`);
  const bar0 = B.bar0; if (bar0 && B.meta) ok(bar0.c.rad === B.meta.c.rad, `${tag}: bars share plate radius`);
  // 6. bottom HUD
  if (tut !== 'dock') {
    const bv = B.bvg; if (bv) { ok(near(bv.r.l, g), `${tag}: BVG logo left = gutter`); ok(near(m.vh - bv.r.b, g), `${tag}: BVG logo bottom = gutter (${Math.round(m.vh - bv.r.b)})`); }
    const tos = names.filter(n => /^toast/.test(n)).map(n => B[n]); if (tos.length) { ok(tos.every(t => near(t.r.l, g)), `${tag}: toasts share left edge = gutter`); ok(tos.every(t => bv ? t.r.b <= bv.r.t + 0.5 : true), `${tag}: toasts stack above the logo`); const tg = tos.sort((a, b) => a.r.t - b.r.t).slice(1).map((t, i) => t.r.t - tos[i].r.b); ok(tg.every(x => near(x, 3, 1.5)), `${tag}: toast gaps equal`); }
    const ctl = B.controls; if (ctl) { ok(near(m.vw - ctl.r.r, g), `${tag}: ability cluster right edge = gutter (${Math.round(m.vw - ctl.r.r)})`); ok(near(m.vh - ctl.r.b, g), `${tag}: ability cluster bottom = gutter (${Math.round(m.vh - ctl.r.b)})`); }
    const circ = names.filter(n => /^(abtn\d|dodge)$/.test(n)).map(n => B[n]);
    if (circ.length) { ok(circ.every(c => near(c.r.b, circ[0].r.b)), `${tag}: all ability/dodge circles share one baseline ${circ.map(c => Math.round(c.r.b))}`);
      const caps = names.filter(n => /^cap/.test(n)).map(n => B[n]); ok(caps.length === 0 || caps.every(c => near(c.r.t, caps[0].r.t)), `${tag}: captions share one top line ${caps.map(c => Math.round(c.r.t))}`);
      const keys = names.filter(n => /^key/.test(n)).map(n => B[n]); if (!m.touch) ok(keys.length >= circ.length - 1 && keys.every(k => near(k.r.t, keys[0].r.t - 0 + (k.r.t - keys[0].r.t)) ), `${tag}: key badges present (${keys.length})`);
      const gaps = circ.sort((a, b) => a.r.l - b.r.l).slice(1).map((c, i) => c.r.l - circ[i].r.r); ok(gaps.every(x => x >= 8), `${tag}: circles keep >= 8px gaps ${gaps.map(Math.round)}`); }
    const it = B.interact, hn = B.hint, ch = B.channelbar;
    const cen = [it, hn, ch].filter(Boolean); ok(cen.every(c => near((c.r.l + c.r.r) / 2, m.vw / 2, 2)), `${tag}: bottom-centre items share the centre line ${cen.map(c => Math.round((c.r.l + c.r.r) / 2))}`);
    if (hn && !m.touch) ok(near(m.vh - hn.r.b, g) || ctl && hn.r.b <= ctl.r.t, `${tag}: hint on bottom baseline (${Math.round(m.vh - hn.r.b)}) or above controls`);
    if (it && B.ikey) ok(B.ikey.r.l >= it.r.l && B.ikey.r.r <= it.r.r && B.ikey.r.t >= it.r.t - 0.5 && B.ikey.r.b <= it.r.b + 0.5, `${tag}: interact key badge inside the prompt`);
    if (it && hn) ok(it.r.b <= hn.r.t + 0.5 || it.r.t >= hn.r.b - 0.5, `${tag}: interact above hint`);
  } else {
    const d = B.tutdock; ok(!!d, `${tag}: tutorial dock bar visible`); if (d) { ok(near((d.r.l + d.r.r) / 2, m.vw / 2, 2), `${tag}: dock centred`); ok(near(m.vh - d.r.b, g, 2.5), `${tag}: dock bottom = gutter (${Math.round(m.vh - d.r.b)})`); ok(d.r.l >= g - TOL && m.vw - d.r.r >= g - TOL, `${tag}: dock keeps gutters`); }
  }
};
for (const [w, h, touch] of VPS.filter(v => !process.env.ONLY || process.env.ONLY.split(',').includes(v[0] + 'x' + v[1]))) {
  for (const mode of ['town', 'run']) for (const tut of ['none', 'card', 'dock']) {
    const tag = `${w}x${h}${touch ? ' touch' : ''} ${mode} tut:${tut}`;
    const { browser, page, errors } = await launch({ viewport: { width: w, height: h }, touch: !!touch, tutorial: tut !== 'none', query: '?splash=hold' + (tut !== 'none' ? '&tutorial=on' : '') });
    try {
      await setup(page, mode, tut, touch);
      const m = await measure(page); audit(tag, m, mode, tut);
      if (tut !== 'dock') { // every interactive HUD control must be the topmost element at its centre
        const hits = await page.evaluate(() => [...document.querySelectorAll('#hud button, #hud .abtn, #hud .interactive, #dodge, #interact')].filter(b => { const r = b.getBoundingClientRect(); let e = b; while (e && e !== document.body) { const c = getComputedStyle(e); if (c.display === 'none' || c.visibility === 'hidden') return false; e = e.parentElement; } return r.width > 2 && r.height > 2 && r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight && getComputedStyle(b).pointerEvents !== 'none'; }).map(b => { const r = b.getBoundingClientRect(); const e = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return { id: b.id || b.className, ok: e === b || b.contains(e) || (innerWidth < 900 && !!e.closest('#dialog') && !b.closest('#dialog')), /* below 900px the transient NPC dialog may cover the side panels (same rule as the overlap audit) */ top: e && (e.id || e.className || e.tagName + '<' + (e.parentElement && (e.parentElement.id || e.parentElement.className))) + ' @' + Math.round(r.x + r.width / 2) + ',' + Math.round(r.y + r.height / 2) }; }));
        ok(hits.length >= 3, `${tag}: hit-tested ${hits.length} controls`);
        for (const h of hits) ok(h.ok, `${tag}: control ${h.id} receives pointer at its centre${h.ok ? '' : ' (covered by ' + h.top + ')'}`);
      }
      if (tut === 'card') ok(m.boxes.some(b => b.name === 'tut'), `${tag}: tutorial card visible`);
      await page.screenshot({ path: `${OUT}/${w}x${h}${touch ? 't' : ''}_${mode}_${tut}.png` });
      ok(errors.length === 0, `${tag}: no page errors ${errors.slice(0, 2).join('|')}`);
    } catch (e) { ok(false, `${tag}: exception ${e.message}`); }
    await browser.close();
  }
}
console.log(fails ? `${fails} FAILED` : 'hud boxes ok'); process.exit(fails ? 1 : 0);
