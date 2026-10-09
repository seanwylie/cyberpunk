// Verifies the town hub: spawn and every interact point is on walkable tiles and reachable from spawn (4-connected), and walkable area is substantial.
import { build } from 'esbuild'; import fs from 'fs'; import os from 'os'; import path from 'path'; import { pathToFileURL } from 'url';
const out = path.join(os.tmpdir(), 'level_check.mjs'); await build({ entryPoints: ['src/level.ts'], bundle: true, format: 'esm', outfile: out, logLevel: 'silent' });
const { buildTown } = await import(pathToFileURL(out).href); const L = buildTown(); const W = L.w;
const seen = new Uint8Array(W * L.h); const q = [[Math.floor(L.spawn.x), Math.floor(L.spawn.y)]]; seen[q[0][1] * W + q[0][0]] = 1; let n = 0;
while (q.length) { const [x, y] = q.pop(); n++; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= L.h || L.solid[ny * W + nx] || seen[ny * W + nx]) continue; seen[ny * W + nx] = 1; q.push([nx, ny]); } }
let bad = 0; for (const it of L.interacts) { const i = Math.floor(it.y) * W + Math.floor(it.x); if (L.solid[i] || !seen[i]) { console.log('UNREACHABLE', it.id, it.x, it.y); bad++; } }
for (const nv of L.npcs) { const i = Math.floor(nv.y) * W + Math.floor(nv.x); if (L.solid[i]) { console.log('npc in solid', nv.spr, nv.x, nv.y); } }
console.log('reachable tiles', n, 'unreachable interacts', bad); process.exit(bad || n < 300 ? 1 : 0);
