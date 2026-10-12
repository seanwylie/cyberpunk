// The trigger IS the drawn pad: the interact point/radius equals the ring the renderer draws, the label's tail points at the trigger centre, the station's focal prop sits right behind it,
// the pad is walkable, and the prompt flips exactly at the ring edge. Every station, both towns.
import { launch, sleep } from './lib.mjs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
import fs from 'node:fs';
const MAX_CENTER_PX = 3; // label centre and tail vs the drawn ring centre, screen px (unless the pill is clamped at a screen edge)
fs.mkdirSync('shots/town_align', { recursive: true });
for (const vp of [{ name: 'desktop', viewport: { width: 1920, height: 1080 } }, { name: 'phone', viewport: { width: 844, height: 390 }, touch: true, dpr: 2 }]) {
const { browser, page, errors } = await launch({ viewport: vp.viewport, touch: vp.touch, dpr: vp.dpr, query: '?splash=hold' }); const ev = (f, a) => page.evaluate(f, a);
await ev(() => document.getElementById('splash')?.remove()); await page.waitForFunction(() => window.__rend?.town?.ready, null, { timeout: 60000 });
const MAX_EDGE = 2.4, MAX_TAIL_TILES = 3.2; // focal prop footprint edge within 2.2 tiles of the pad; tail within ~3 tiles of screen-x of the pad centre
for (const town of ['rustline', 'harrow']) {
  await ev(async town => { const g = window.__game; g.save.level = 30; g.checkTownUnlocks(); if (g.townId !== town) g.travel(town); window.__ui.open(null); g.save.settings.stationMarkers = false; }, town);
  await page.waitForFunction(t => window.__rend.town?.ready && window.__game.townId === t, town, { timeout: 30000 }); await sleep(1000);
  const sts = await ev(async () => { const S = await import('/src/stations.ts'); const g = window.__game, L = g.level; return L.interacts.filter(i => S.STATIONS.some(q => q.key === i.station)).map(i => { const s = S.STATIONS.find(q => q.key === i.station); const own = L.decor.filter(d => d.station === s.key && !String(d.spr).startsWith('sign_')); const f = own.find(d => Math.abs(d.x - s.lx) < .01 && Math.abs(d.y - s.ly) < .01) || own[0]; if (!f) return { id: i.id, key: s.key, nof: true }; const dx = Math.max(f.x - i.x, 0, i.x - (f.x + f.fw)), dy = Math.max(f.y - i.y, 0, i.y - (f.y + f.fd)); return { id: i.id, key: s.key, x: i.x, y: i.y, r: i.r, edge: Math.hypot(dx, dy), sdx: (i.x - i.y) - ((f.x + f.fw / 2) - (f.y + f.fd / 2)), solid: g.solidAt(i.x, i.y), sx: s.x, sy: s.y }; }); });
  for (const st0 of sts) { const st = { ...st0, key: vp.name + ':' + st0.key };
    if (st.nof) { ok(false, `${town}/${st.key}: no focal prop flagged with the station`); continue; }
    ok(st.sx === st.x && st.sy === st.y, `${town}/${st.key}: interact point equals the station pad (${st.x},${st.y})`); ok(!st.solid, `${town}/${st.key}: pad is walkable`);
    ok(st.edge <= MAX_EDGE, `${town}/${st.key}: focal prop footprint ${st.edge.toFixed(1)} tiles from the pad centre (<= ${MAX_EDGE})`);
    // stand on the pad: ring info + tail
    await ev(st => { const g = window.__game; g.px = st.x; g.py = st.y; for (let i = 0; i < 4; i++) g.update(.016); }, st); await sleep(900);
    const r = await ev(st => { const R = window.__rend, g = window.__game; const ri = R.ringInfo[st.id], l = (R.lblRects || []).find(q => q.id === st.id); return { ri, tail: l ? l.tailX : null, prompt: g.prompt?.id === st.id, n: (R.lblRects || []).filter(q => q.id === st.id).length, ax: R.sx(st.x, st.y), TW: R.TW }; }, st);
    ok(r.ri && Math.abs(r.ri.x - st.x) < 1e-6 && Math.abs(r.ri.y - st.y) < 1e-6 && Math.abs(r.ri.r - st.r) < 1e-6, `${town}/${st.key}: drawn ring centre/radius (${r.ri?.x},${r.ri?.y} r${r.ri?.r}) equals the trigger (${st.x},${st.y} r${st.r})`);
    ok(r.prompt && r.n === 1, `${town}/${st.key}: standing on the pad prompts, exactly one label`);
    const clamped = await ev(st => { const l = (window.__rend.lblRects || []).find(q => q.id === st.id); return !!l && (l.x <= 8.5 || l.x + l.w >= innerWidth - 8.5 || l.y <= 8.5); }, st);
    ok(clamped || Math.abs(r.tail - r.ax) <= MAX_TAIL_TILES * r.TW / 2, `${town}/${st.key}: label tail ${Math.round(r.tail - r.ax)}px from the trigger centre on screen (<= ${Math.round(MAX_TAIL_TILES * r.TW / 2)})`);
    const cen = await ev(st => { const R = window.__rend; const ri = R.ringInfo[st.id], l = (R.lblRects || []).find(q => q.id === st.id); return l && ri ? { lc: l.x + l.w / 2, tail: l.tailX, ax: ri.ax, cl: l.x <= 8.5 || l.x + l.w >= innerWidth - 8.5 } : null; }, st);
    ok(cen && (cen.cl ? Math.abs(cen.tail - cen.ax) <= MAX_CENTER_PX : Math.abs(cen.lc - cen.ax) <= MAX_CENTER_PX && Math.abs(cen.tail - cen.ax) <= MAX_CENTER_PX), `${town}/${st.key}: label centre ${cen ? (cen.lc - cen.ax).toFixed(1) : '?'}px, tail ${cen ? (cen.tail - cen.ax).toFixed(1) : '?'}px from the ring centre (<= ${MAX_CENTER_PX})${cen?.cl ? ' [edge-clamped]' : ''}`);
    await page.screenshot({ path: `shots/town_align/${vp.name}_${town}_${st0.key}.png` });
    ok(Math.abs(st.sdx) <= MAX_TAIL_TILES, `${town}/${st.key}: pad is under the prop on screen (offset ${st.sdx.toFixed(1)} tiles)`);
    // prompt flips at the ring edge
    const edge = await ev(st => { const g = window.__game; const out = []; for (const dd of [st.r + .25, st.r - .25]) { let hit = null; for (let a = 0; a < 32 && hit === null; a++) { const t = a * Math.PI / 16, x = st.x + Math.cos(t) * dd, y = st.y + Math.sin(t) * dd; if (g.solidAt(x, y)) continue; g.px = x; g.py = y; g.prompt = null; for (let i = 0; i < 4; i++) g.update(.016); hit = g.prompt?.id === st.id; } out.push(hit); } return out; }, st);
    ok(edge[0] !== true && edge[1] !== false, `${town}/${st.key}: prompt off just outside the ring (${edge[0]}), on just inside (${edge[1]})`);
  }
}
ok(errors.length === 0, vp.name + ': no page errors ' + (errors[0] || '')); await browser.close();
}
console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
