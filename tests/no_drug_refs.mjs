// Content rating guard: MA (violence, gore, grit) but NO drug references. Scans every player-facing string literal in src/ + index.html,
// the story allowlist (server/story_catalog.json), the story system prompt and docs/*.md prose for a banned-word list.
// Pure identifiers (ids like coke_ovens, pharmacy_vault, apothecary, the 'stim' input key) are internal and allowed; anything a player can read is not.
import fs from 'fs'; import path from 'path';
const BANNED = /\b(coke|cocaine|heroin|meth|crackhead|narcotics?|dealers?|dealing|junkies?|drugs?|drugged|overdos\w*|dispensary|dispensed|pharmacy|pharmacist|apothecary|prescriptions?|sedatives?|stoned|opioids?|opiates?|stims?|stimulants?|doses?|dosage|pills?|get high|getting high|hooked on|addicts?|addiction)\b/i;
const ID = /^[a-z0-9_.:\-\/]*$/; // ids, keys, file names
let fails = 0; const hits = [];
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const lits = s => { const out = []; const re = /'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g; let m; while ((m = re.exec(s))) out.push(m[1] ?? m[2] ?? m[3]); return out; };
const stripCode = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1'); // comments are not player-facing
for (const f of walk('src').filter(f => /\.(ts|js)$/.test(f)).concat(['index.html', 'server/story_beat.mjs'])) {
  const src = f.endsWith('.html') ? fs.readFileSync(f, 'utf8').replace(/<[^>]+>/g, ' ') : stripCode(fs.readFileSync(f, 'utf8'));
  const texts = f.endsWith('.html') ? [src] : lits(src).map(t => t.replace(/\$\{[^}]*\}/g, ' '));
  for (const t of texts) { if (ID.test(t) || /[;{}]|=>|\+\+|\?\./.test(t)) continue; for (const w of t.split(/(?<=[.!?])\s+|\n/)) { const m = w.match(BANNED); if (m && !(f.endsWith('story_beat.mjs') && /no drugs|\(\?:drugs/.test(w))) hits.push(`${f}: "${m[0]}" in ${JSON.stringify(w.trim().slice(0, 90))}`); } } }
const cat = JSON.parse(fs.readFileSync('server/story_catalog.json', 'utf8')); const vals = []; const rec = o => { for (const v of Object.values(o)) typeof v === 'string' ? vals.push(v) : v && typeof v === 'object' && rec(v); }; rec(cat);
for (const v of vals) if (!ID.test(v) && BANNED.test(v)) hits.push(`story_catalog: ${v}`);
for (const f of walk('docs').filter(f => f.endsWith('.md'))) { const s = fs.readFileSync(f, 'utf8').replace(/`[^`]*`/g, ' '); s.split('\n').forEach((l, i) => { const m = l.match(BANNED); if (m) hits.push(`${f}:${i + 1}: "${m[0]}"`); }); }
for (const h of hits.slice(0, 40)) console.log('HIT', h);
if (hits.length) { fails++; console.log(`FAIL ${hits.length} drug references in player-facing text/docs`); } else console.log('PASS no drug references in player-facing text, story prompt/catalog or docs');
console.log(fails ? '1 FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
