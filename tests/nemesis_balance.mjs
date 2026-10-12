// Nemesis balance (docs/NEMESIS.md "Fairness caps"): for EVERY dungeon, the worst-case nemesis (rank 5, every module, max escorts) must stay
// tougher than a plain elite but well under the dungeon boss, with damage within the cap, and its stand-in body must never be a gate guard / lock elite.
import { build } from 'esbuild'; import fs from 'fs'; import os from 'os'; import path from 'path';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const out = path.join(os.tmpdir(), 'wv_nbal_' + process.pid + '.mjs');
fs.writeFileSync(out + '.ts', `export * from '${path.resolve('src/nemesis.ts')}'; export { bodyFor } from '${path.resolve('src/nemesis_sim.ts')}'; export { ENEMIES } from '${path.resolve('src/config.ts')}'; export { DUNGEONS } from '${path.resolve('src/content/dungeons.ts')}'; export { BAL } from '${path.resolve('src/content/balance.ts')}';`);
await build({ entryPoints: [out + '.ts'], bundle: true, platform: 'node', format: 'esm', outfile: out, logLevel: 'error', loader: { '.png': 'empty', '.jpg': 'empty', '.webp': 'empty', '.mp3': 'empty', '.json': 'json' }, define: { 'import.meta.env': '{}' } });
const M = await import(out); fs.unlinkSync(out); fs.unlinkSync(out + '.ts');
const C = M.NEM_CFG; let rows = []; let worstRatio = 0;
for (const dd of Object.values(M.DUNGEONS)) { const mul = M.BAL.g.tier[dd.tier || 0] ?? M.BAL.g.hp; const boss = M.ENEMIES[dd.defaultBoss]; if (!boss) continue;
  for (const src of [dd.defaultBoss, dd.lockElite, dd.gateGuard].filter(Boolean)) { const body = M.bodyFor(src, [dd.gateGuard, dd.lockElite]); const bd = M.ENEMIES[body];
    ok(body !== dd.gateGuard && body !== dd.lockElite && bd && !bd.boss, `${dd.id}: nemesis from ${src} wears ${body} (never a boss / gate guard / lock elite)`);
    const n = { rank: 5, modules: ['shield', 'resist', 'counter_intrusion', 'gap_closer'], recruits: 9, resist: 'kinetic' }; const st = M.nemStats(n, bd.hp * mul, boss.hp * mul);
    const eHp = st.hp * (1 + st.shield) / (1 - st.resist); const ratio = eHp / (boss.hp * mul); worstRatio = Math.max(worstRatio, ratio); rows.push([dd.id, body, Math.round(st.hp), Math.round(eHp), Math.round(boss.hp * mul), ratio.toFixed(2)]);
    ok(st.hp >= bd.hp * mul - 1e-6 && st.dmgMul <= C.dmgCap && st.escorts <= C.maxRecruits, `${dd.id}/${src}: hp ${Math.round(st.hp)} >= body ${Math.round(bd.hp * mul)}, dmg x${st.dmgMul} <= x${C.dmgCap}, escorts ${st.escorts}`);
    ok(ratio <= 1.0, `${dd.id}/${src}: worst-case effective hp ${Math.round(eHp)} <= boss ${Math.round(boss.hp * mul)} (x${ratio.toFixed(2)})`); } }
// time-to-kill model: rank 1..5 steps are monotonic and bounded (each step <= hpStep of base)
const steps = [1, 2, 3, 4, 5].map(r => M.nemStats({ rank: r, modules: [], recruits: 0, resist: 'kinetic' }, 1000, 1e9).hp); ok(steps.every((v, i) => !i || (v >= steps[i - 1] && v - steps[i - 1] <= 1000 * C.hpStep + 1e-6)), 'rank steps monotonic and bounded: ' + steps.map(Math.round).join(' -> '));
console.log('worst effective-hp / boss-hp ratio: ' + worstRatio.toFixed(2)); fs.mkdirSync('docs/balance', { recursive: true });
fs.writeFileSync('docs/balance/nemesis_caps.csv', 'dungeon,body,nem_hp_r5,effective_hp_r5,boss_hp,ratio\n' + rows.map(r => r.join(',')).join('\n') + '\n');
console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
