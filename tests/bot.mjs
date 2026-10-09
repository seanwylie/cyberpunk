// Naive bot playthrough (no god mode) to sanity check pacing/difficulty of the Annex with each build kit.
import { launch } from './lib.mjs';
const kitName = process.argv[2] || 'A';
const { browser, page, errors } = await launch();
const res = await page.evaluate(([k, process_t]) => {
  const g = window.__game, ui = window.__ui; ui.kit(k, true); g.save.level = 12; g.startRun();
  const wps = [[12,19.5],[22,19.5],[25,19.5],[36,19.5],[47,19.5],[52,19.5],[57,19.5],'ctrl',[63.5,19.5],[68,19.5],[76,19.5]];
  let wi = 0, t = 0, downs = 0, dodges = 0; const dt = 0.016;
  const L = g.level; let fl = null, flT = 0, flTarget = '';
  const bfs = (tx, ty) => { const f = new Int16Array(L.w * L.h).fill(-1); const q = [(ty | 0) * L.w + (tx | 0)]; f[q[0]] = 0; for (let h = 0; h < q.length; h++) { const c = q[h], cx = c % L.w, cy = (c / L.w) | 0; for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) { const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= L.w || ny >= L.h) continue; const i = ny * L.w + nx; if (f[i] >= 0 || L.solid[i]) continue; f[i] = f[c] + 1; q.push(i); } } return f; };
  const nav = (tx, ty) => { const key = tx + ',' + ty; if (key !== flTarget || t - flT > 5) { fl = bfs(tx, ty); flTarget = key; flT = t; } const cx = g.px | 0, cy = g.py | 0; let best = fl[cy * L.w + cx], bx = cx, by = cy; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const nx = cx + dx, ny = cy + dy; const i = ny * L.w + nx; if (L.solid[i] || fl[i] < 0) continue; if (dx && dy && (L.solid[cy * L.w + nx] || L.solid[ny * L.w + cx])) continue; if (fl[i] < best) { best = fl[i]; bx = nx; by = ny; } } mv(bx + .5 - g.px, by + .5 - g.py); };
  const mv = (wx, wy) => { const l = Math.hypot(wx, wy) || 1; wx /= l; wy /= l; g.setMove(wx - wy, (wx + wy) / 2); };
  while (t < (+process_t || 900) && !g.inst.flags.bossDead) {
    t += dt;
    if (g.downed) { downs++; g.returnToCheckpoint(); }
    const alive = g.enemies.filter(e => !e.dead && e.faction === 'enemy' && e._rt.reveal <= 0 && Math.hypot(e.x - g.px, e.y - g.py) < 9 && g.los(g.px, g.py, e.x, e.y) && (e.type !== 'turret' || wi >= 1));
    const near = alive.sort((a, b) => Math.hypot(a.x - g.px, a.y - g.py) - Math.hypot(b.x - g.px, b.y - g.py))[0];
    // dodge when a telegraph is about to land close by
    const threat = g.enemies.find(e => !e.dead && e._rt.st === 'tele' && Math.hypot(e.x - g.px, e.y - g.py) < 3.5 && e._rt.t > 0.6);
    if (threat && g.dodgeCd <= 0) { g.dodge(); dodges++; }
    const boss = g.enemies.find(e => !e.dead && e.type !== 'worker' && e._rt.reveal === 0 && /overseer|enforcer|warden/.test(e.type));
    if (g.revealing) { mv(0, 0); }
    else if (near && (wi >= 9 || near.type === 'turret' || Math.hypot(near.x - g.px, near.y - g.py) < 6)) { const d = Math.hypot(near.x - g.px, near.y - g.py); const keep = near.type === 'warden' ? 0 : 1.2; if (d > keep) (d < 3 ? mv(near.x - g.px, near.y - g.py) : nav(near.x | 0, near.y | 0)); else g.setMove(0, 0); if (!g.aim && g.build.abilities.length) { for (let i = 0; i < 3; i++) { if (g.build.abilities[i] && g.abCd[i] <= 0 && !g.cast && !g.overheated && alive.length >= 2 && d < 3) { g.beginAim(i); g.updateAim(near.x, near.y, true); g.releaseAim(); break; } } } }
    else { const w = wps[wi]; if (w === 'ctrl') { if (g.px < 56) { nav(57, 19); } else { g.px = 58; g.py = 19.5; g.update(0.001); g.interact(); wi++; } } else { const d = Math.hypot(w[0] - g.px, w[1] - g.py); if (d < 1.2) wi = Math.min(wps.length - 1, wi + 1); else nav(w[0], w[1]); } }
    if (g.hp < g.maxHp * 0.4 && g.inst.carried.stims > 0) g.useStim();
    g.update(dt);
  }
  return { turrets: g.enemies.filter(e=>e.type==='turret').map(e=>[e.dead,e.hp,e.x,e.y]), near: g.enemies.filter(e=>!e.dead&&Math.hypot(e.x-g.px,e.y-g.py)<8).map(e=>[e.type,e.x|0,e.y|0,e._rt.st]), target: g.target, atkCd: g.atkCd, move: g.inputMove, t: Math.round(t), done: g.inst.flags.bossDead, downs, dodges, hp: Math.round(g.hp), boss: g.inst.flags.bossKey, kills: g.kills, drops: g.inst.drops.length, wi, pos: [g.px | 0, g.py | 0] };
}, [kitName, process.argv[3] || 900]);
console.log(kitName, JSON.stringify(res), errors);
await browser.close();
