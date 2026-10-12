// Runs every tests/*.mjs one at a time with a per-file timeout. A failing test is re-run up to --reruns (default 3) more times and classified:
//   PASS   passed first try      FLAKY  failed, then passed on a rerun (environment noise or a nondeterministic test: investigate)      FAIL  failed every attempt (real)
// Appends "<name> <CLASS> <secs>s attempts=<n>" per file to the results file and prints a classification summary at the end.
// Resumable: files already recorded as PASS/FLAKY are skipped (--fresh starts over). Tests slower than --slow seconds get only 1 rerun.
// Usage: URL=http://127.0.0.1:5391/ node tools/run_tests.mjs [--fresh] [--out /workspace/test_results.txt] [--timeout 900] [--reruns 3] [--slow 300] [name ...]
import fs from 'fs'; import path from 'path'; import { spawn, execSync } from 'child_process';
const args = process.argv.slice(2); const VAL = ['--out', '--timeout', '--reruns', '--slow']; const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const OUT = opt('--out', '/workspace/test_results.txt'), TMO = +opt('--timeout', 900) * 1000, RERUNS = +opt('--reruns', 3), SLOW = +opt('--slow', 300);
const SKIP = /^(lib|mobile_lib|net_lib)$|_shots?$|gifs$|^screenshots$|^sprite_shot$|^prod$/;
const named = args.filter((a, i) => !a.startsWith('--') && !VAL.includes(args[i - 1]));
if (args.includes('--fresh')) fs.writeFileSync(OUT, '');
const lines = () => fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8').split('\n').filter(Boolean) : [];
const done = new Set(lines().filter(l => / (PASS|FLAKY) /.test(l)).map(l => l.split(' ')[0]));
const files = fs.readdirSync('tests').filter(f => f.endsWith('.mjs')).map(f => path.basename(f, '.mjs')).filter(n => named.length ? named.includes(n) : !SKIP.test(n)).sort();
const logDir = path.join(path.dirname(OUT), 'test_logs'); fs.mkdirSync(logDir, { recursive: true });
const run = (n, k) => new Promise(res => { const log = fs.openSync(path.join(logDir, k ? `${n}.rerun${k}.log` : `${n}.log`), 'w'); const p = spawn('node', ['tests/' + n + '.mjs'], { stdio: ['ignore', log, log], env: process.env }); const to = setTimeout(() => { p.kill('SIGKILL'); res('TIMEOUT'); }, TMO); p.on('exit', c => { clearTimeout(to); res(c); }); });
const clean = () => { try { execSync('git checkout -- shots docs/art 2>/dev/null; git clean -fdq shots 2>/dev/null', { stdio: 'ignore' }); } catch { } }; // tests rewrite tracked screenshots
for (const n of files) {
  if (done.has(n)) continue; const t0 = Date.now(); let code = await run(n, 0), att = 1; clean();
  const slow = (Date.now() - t0) / 1000 > SLOW; const max = 1 + (slow ? Math.min(1, RERUNS) : RERUNS);
  while (code !== 0 && att < max) { code = await run(n, att); att++; clean(); }
  const cls = code === 0 ? (att === 1 ? 'PASS' : 'FLAKY') : 'FAIL';
  fs.appendFileSync(OUT, `${n} ${cls} ${Math.round((Date.now() - t0) / 1000)}s attempts=${att}\n`);
}
const last = new Map(); for (const l of lines()) { const [n, c] = l.split(' '); if (['PASS', 'FLAKY', 'FAIL'].includes(c)) last.set(n, c); }
const by = c => [...last].filter(([, v]) => v === c).map(([k]) => k);
const sum = `SUMMARY pass=${by('PASS').length} flaky=${by('FLAKY').length} fail=${by('FAIL').length}\nFLAKY: ${by('FLAKY').join(' ') || '-'}\nFAIL: ${by('FAIL').join(' ') || '-'}`;
fs.appendFileSync(OUT, sum + '\nRUN_DONE\n'); console.log(sum);
