// Contact sheet of every dungeon layout: node tools/mapsheet.mjs [outDir=shots/mapvary]. Bundles the generators with esbuild (vite dep), dumps level JSON, renders with python PIL.
import { build } from 'esbuild'; import fs from 'fs'; import path from 'path'; import { execFileSync } from 'child_process'; import { pathToFileURL } from 'url';
const out = process.argv[2] || 'shots/mapvary'; fs.mkdirSync(out, { recursive: true });
const tmp = fs.mkdtempSync('/tmp/mapsheet-'); const entry = path.join(tmp, 'e.ts');
fs.writeFileSync(entry, `export * as D from '${path.resolve('src/content/dungeons.ts')}';`);
await build({ entryPoints: [entry], bundle: true, platform: 'node', format: 'esm', outfile: path.join(tmp, 'e.mjs'), logLevel: 'error' });
const { D } = await import(pathToFileURL(path.join(tmp, 'e.mjs')).href);
const SEEDS = [11, 4242, 90001]; const dump = [];
for (const d of D.DUNGEON_LIST) for (const s of SEEDS) { const L = d.build(s); dump.push({ id: d.id, seed: s, arch: L.arch?.name || 'chain', w: L.w, h: L.h, solid: Buffer.from(L.solid).toString('base64'), zone: Buffer.from(L.zone).toString('base64'), zn: L.zoneNames, doors: L.doors.map(x => ({ id: x.id, tiles: x.tiles })), spawn: L.spawn, boss: L.bossSpawn, hz: (L.hazards || []).map(h => [h.x, h.y, h.r]), it: L.interacts.map(i => [i.id, i.x, i.y]), props: L.props.map(p => [p.x, p.y]), sp: L.spawns.map(p => [p.x, p.y]) }); }
fs.writeFileSync(path.join(tmp, 'd.json'), JSON.stringify(dump));
execFileSync('python3', ['tools/mapsheet.py', path.join(tmp, 'd.json'), out], { stdio: 'inherit' });
