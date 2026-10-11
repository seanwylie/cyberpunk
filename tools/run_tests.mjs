// Runs every tests/*.mjs one at a time with a per-file timeout; appends "<name> PASS|FAIL <secs>s" to the results file as each finishes.
// Resumable: files already recorded as PASS in the results file are skipped (delete the file or pass --fresh to start over).
// Usage: URL=http://127.0.0.1:5391/ node tools/run_tests.mjs [--fresh] [--out /workspace/test_results.txt] [--timeout 900] [name ...]
import fs from 'fs'; import path from 'path'; import { spawn } from 'child_process';
const args = process.argv.slice(2); const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const OUT = opt('--out', '/workspace/test_results.txt'), TMO = +opt('--timeout', 900) * 1000;
const SKIP = /^(lib|mobile_lib|net_lib)$|_shots?$|gifs$|^screenshots$|^sprite_shot$|^prod$/;
const named = args.filter((a, i) => !a.startsWith('--') && !['--out', '--timeout'].includes(args[i - 1]));
if (args.includes('--fresh')) fs.writeFileSync(OUT, '');
const done = new Set(fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8').split('\n').filter(l => / PASS /.test(l)).map(l => l.split(' ')[0]) : []);
const files = fs.readdirSync('tests').filter(f => f.endsWith('.mjs')).map(f => path.basename(f, '.mjs')).filter(n => named.length ? named.includes(n) : !SKIP.test(n)).sort();
const logDir = path.join(path.dirname(OUT), 'test_logs'); fs.mkdirSync(logDir, { recursive: true });
for (const n of files) {
  if (done.has(n)) continue; const t0 = Date.now(); const log = fs.openSync(path.join(logDir, n + '.log'), 'w');
  const code = await new Promise(res => { const p = spawn('node', ['tests/' + n + '.mjs'], { stdio: ['ignore', log, log], env: process.env }); const to = setTimeout(() => { p.kill('SIGKILL'); res('TIMEOUT'); }, TMO); p.on('exit', c => { clearTimeout(to); res(c); }); });
  fs.appendFileSync(OUT, `${n} ${code === 0 ? 'PASS' : 'FAIL'} ${Math.round((Date.now() - t0) / 1000)}s${code === 0 ? '' : ' (' + code + ')'}\n`);
}
fs.appendFileSync(OUT, 'RUN_DONE\n');
