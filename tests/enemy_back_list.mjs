// enemyart.ts BACK must list exactly the *_back.png files shipped in public/dungeons/enemies (no 404 probes, no missed art).
import { readFileSync, readdirSync } from 'node:fs';
const src = readFileSync('src/enemyart.ts', 'utf8'); const m = src.match(/const BACK = new Set\(\[([^\]]*)\]\)/);
const listed = new Set([...(m?.[1] || '').matchAll(/'([^']+)'/g)].map(x => x[1]));
const files = new Set(readdirSync('public/dungeons/enemies').filter(f => f.endsWith('_back.png')).map(f => f.slice(0, -9)));
const miss = [...files].filter(f => !listed.has(f)), extra = [...listed].filter(f => !files.has(f));
console.log((miss.length || extra.length ? 'FAIL' : 'PASS') + ' BACK list matches shipped _back art', JSON.stringify({ miss, extra }));
process.exit(miss.length || extra.length ? 1 : 0);
