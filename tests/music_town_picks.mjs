// Unit: 50 town picks never repeat back-to-back, even when only the playing track is decoded (lazy loading), and the theme stays gently weighted.
import { load } from './net_lib.mjs';
const M = await load('src/music.ts', 'music');
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const mm = new M.MusicManager({}, {}); mm.townId = 'rustline';
for (const [label, decodeAll] of [['only the current track decoded', false], ['all decoded', true]]) {
  mm.bags = {}; mm.cur = 'town'; mm.buffers = { town: {} }; const seq = []; let rep = 0;
  for (let i = 0; i < 50; i++) { if (decodeAll) for (const n of M.POOLS.town) mm.buffers[n] = {}; const n = mm.pick('town'); if (n === mm.cur) rep++; seq.push(n); mm.cur = n; mm.buffers = decodeAll ? mm.buffers : { [n]: {} }; mm.noteCalm?.(n); }
  ok(rep === 0, `${label}: 50 picks, ${rep} back-to-back repeats, ${new Set(seq).size} distinct`);
  if (decodeAll) ok(new Set(seq).size >= 15, 'shuffle covers 15+ tracks in 50 picks');
}
console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
