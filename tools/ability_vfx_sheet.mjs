// node tools/ability_vfx_sheet.mjs <beforeDir> <afterDir> <out.png>: rows = abilities, top strip before / bottom strip after (frames at cast, +90, +240, +460 ms)
import fs from 'fs'; import { PNG } from 'pngjs';
const [b, a, out] = process.argv.slice(2); const IDS = ['sweep', 'bladeburst', 'pulse', 'control', 'brace', 'reposition', 'cloak', 'forcedcool', 'revive'];
const W = 1600, H = 300, rows = IDS.length * 2; const o = new PNG({ width: W, height: H * rows }); o.data.fill(20);
IDS.forEach((id, i) => { [b, a].forEach((d, j) => { const p = `${d}/${id}.png`; if (!fs.existsSync(p)) return; const im = PNG.sync.read(fs.readFileSync(p)); PNG.bitblt(im, o, 0, 0, Math.min(W, im.width), H, 0, (i * 2 + j) * H); }); });
fs.writeFileSync(out, PNG.sync.write(o));
