// Key-letter consistency: every player-facing key hint must agree with KEYS in src/config.ts; objective text must use the town key.
import fs from 'fs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const cfg = fs.readFileSync('src/config.ts', 'utf8');
const KEYS = Object.fromEntries([...cfg.match(/export const KEYS = \{([^}]*)\}/)[1].matchAll(/(\w+):'([^']*)'/g)].map(m => [m[1], m[2]]));
ok(KEYS.town === 'B' && KEYS.stim === 'T', `KEYS town=${KEYS.town} stim=${KEYS.stim}`);
// word -> action; a literal "<word> ... (X)" / "press X" / "X to <word>" must match
const WORDS = { town: 'town', stim: 'stim', pack: 'pack', minimap: 'minimap', interact: 'interact', contacts: 'contacts', dodge: 'dodge', music: 'music' };
const files = fs.readdirSync('src').filter(f => f.endsWith('.ts')); let n = 0;
for (const f of files) { const lines = fs.readFileSync('src/' + f, 'utf8').split('\n');
  lines.forEach((ln, i) => { for (const m of ln.matchAll(/'([^'\n]*)'|`([^`\n]*)`|"([^"\n]*)"/g)) { const str = m[1] ?? m[2] ?? m[3]; if (str.includes('${') && /key\(/.test(str)) continue;
    for (const [act, w] of Object.entries(WORDS)) { const re = [new RegExp(`${w}[^.()]{0,20}\\(([A-Z])\\)`, 'i'), new RegExp(`\\b[Pp]ress ([A-Z])\\b[^.']{0,30}${w}`), new RegExp(`\\b([A-Z]) to (?:toggle )?(?:the )?${w}`)];
      for (const r of re) { const x = r.exec(str); if (x) { n++; if (x[1] !== KEYS[act]) ok(false, `src/${f}:${i + 1} says ${x[1]} for ${act} (should be ${KEYS[act]}): ${str.slice(0, 80)}`); } } } } }); }
ok(true, `scanned ${files.length} files, ${n} key mentions checked`);
// runtime objective text
const src = fs.readFileSync('src/sim.ts', 'utf8');
ok(!/town \([A-Z]\)/.test(src), 'sim.ts has no hardcoded town key');
ok(/TOWN_KEY|key\('town'\)/.test(src), 'objective uses the key map');
const { launch, sleep } = await import('./lib.mjs');
const { browser, page } = await launch();
await page.evaluate(() => document.getElementById('splash')?.remove());
await page.evaluate(() => { const g = window.__game; g.dbg.god = true; g.startRun(Object.keys(window.__dungeons || {})[0]); });
await sleep(800);
const txt = await page.evaluate(() => { const g = window.__game; g.inst.flags = g.inst.flags || {}; g.inst.flags.bossDead = true; return g.objective()?.text; });
ok(/press B to return to town/.test(txt || ''), `objective after boss: "${txt}"`);
await browser.close();
console.log(fails ? `${fails} FAILED` : 'keys OK'); process.exit(fails ? 1 : 0);
