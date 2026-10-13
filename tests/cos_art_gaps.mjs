// Cosmetic model art coverage (docs/COSMETICS_VARIETY.md). COS_ART must match public/sprites/cos/<id>/ exactly (every anim sheet present),
// and every cosmetic WITHOUT model layers is listed per slot, so the remaining 2D-overlay fallbacks stay visible. Fails only on mismatch.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
const ANIMS = ['idle', 'run', 'dodge', 'attack', 'cast', 'hit', 'down'];
const listed = new Set([...readFileSync('src/content/cosart.ts', 'utf8').matchAll(/'([^']+)'/g)].map(x => x[1]));
const dir = 'public/sprites/cos'; const shipped = existsSync(dir) ? readdirSync(dir) : [];
const incomplete = shipped.filter(id => ANIMS.some(a => !existsSync(`${dir}/${id}/${a}.webp`)));
const miss = shipped.filter(id => !listed.has(id)), extra = [...listed].filter(id => !shipped.includes(id));
import { execSync } from 'node:child_process';
const ids = JSON.parse(execSync(`npx tsx -e "import {COSMETICS} from './src/content/appearance.ts'; console.log(JSON.stringify(COSMETICS.map(d=>[d.id,d.slot])))"`, { encoding: 'utf8' }).trim().split('\n').pop());
const gaps = {}; for (const [id, sl] of ids) if (!listed.has(id)) (gaps[sl] ||= []).push(id);
const total = ids.length, have = ids.filter(([id]) => listed.has(id)).length;
console.log(`INFO model art: ${have}/${total} cosmetics; 2D-overlay fallbacks by slot:`); for (const [sl, l] of Object.entries(gaps)) console.log(`  ${sl} (${l.length}): ${l.join(' ')}`);
const bad = miss.length || extra.length || incomplete.length;
console.log((bad ? 'FAIL' : 'PASS') + ' COS_ART matches shipped model layers', JSON.stringify({ miss, extra, incomplete }));
process.exit(bad ? 1 : 0);
