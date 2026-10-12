// node tools/startsheet.mjs [outDir=shots/starts]: top-down maps of 6 dungeons with the safe entry radius and every enemy spawn.
import { build } from 'esbuild'; import fs from 'fs'; import path from 'path'; import { execFileSync } from 'child_process'; import { pathToFileURL } from 'url';
const out = process.argv[2] || 'shots/starts'; fs.mkdirSync(out, { recursive: true }); const tmp = fs.mkdtempSync('/tmp/startsheet-'); const entry = path.join(tmp, 'e.ts');
fs.writeFileSync(entry, `export * as D from '${path.resolve('src/content/dungeons.ts')}'; export * as S from '${path.resolve('src/content/safestart.ts')}'; export * as C from '${path.resolve('src/config.ts')}';`);
await build({ entryPoints: [entry], bundle: true, platform: 'node', format: 'esm', outfile: path.join(tmp, 'e.mjs'), logLevel: 'error' });
const { D, S, C } = await import(pathToFileURL(path.join(tmp, 'e.mjs')).href);
const ids = ['annex', 'foundry', 'clinic', 'coke_ovens', 'parcel_tower', 'warranty_vault']; const dump = ids.map(id => { const L = D.DUNGEONS[id].build(2468); return { id, w: L.w, h: L.h, solid: Buffer.from(L.solid).toString('base64'), zone: Buffer.from(L.zone).toString('base64'), zn: L.zoneNames, spawn: L.spawn, R: S.SAFE_R, sp: L.spawns.map(s => [s.x, s.y, (C.ENEMIES[s.type].elite || C.ENEMIES[s.type].ranged) ? 1 : 0]) }; });
fs.writeFileSync(path.join(tmp, 'd.json'), JSON.stringify(dump)); execFileSync('python3', ['tools/startsheet.py', path.join(tmp, 'd.json'), out], { stdio: 'inherit' });
