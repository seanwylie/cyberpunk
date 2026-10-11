// Test helpers: bundle the TypeScript server + client core with esbuild and import them in plain node.
import { build } from 'esbuild'; import os from 'os'; import path from 'path'; import fs from 'fs'; import { pathToFileURL } from 'url';
export async function load(entry, name) {
  fs.mkdirSync(path.join(process.cwd(),'server','dist'),{recursive:true}); const out = path.join(process.cwd(), 'server', 'dist', 'wv_net_' + name + '_' + process.pid + '.mjs');
  await build({ entryPoints: [entry], bundle: true, platform: 'node', format: 'esm', packages: 'external', outfile: out, logLevel: 'error' });
  return import(pathToFileURL(out).href + '?t=' + Date.now());
}
export const sleep = ms => new Promise(r => setTimeout(r, ms));
export function mkTest() { let fails = 0; return { ok(c, m) { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; }, done() { console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0); } }; }
export async function until(f, ms = 8000, step = 25) { const t = Date.now(); while (Date.now() - t < ms) { if (await f()) return true; await sleep(step); } return false; }
