// Offscreen sheet of every trail (dark + light floor, moving and 0.35 s after stop) for eyeballing. node tools/cos/trail_sheet.mjs out.png
import { launch } from '../../tests/lib.mjs'; import fs from 'fs';
const { browser, page } = await launch({ viewport: { width: 800, height: 600 } });
const b64 = await page.evaluate(async () => { const A = await import('/src/content/appearance.ts'), C = await import('/src/cosmetics.ts');
  const tr = A.COSMETICS.filter(d => d.slot === 'trail'); const CW = 260, CH = 120, W = CW * 3, H = CH * tr.length; const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const c = cv.getContext('2d');
  tr.forEach((d, r) => { for (let col = 0; col < 3; col++) { const ox = col * CW, oy = r * CH; c.fillStyle = col === 1 ? '#9a8c74' : '#2a2724'; c.fillRect(ox, oy, CW, CH); const now = 10, hd = col === 2 ? now - .35 : now; const pts = []; for (let tt = hd - C.TRAIL_LIFE; tt <= hd; tt += C.TRAIL_STEP) { const q = hd - tt; pts.push({ x: ox + 200 - q * 220 + Math.sin(tt * 4) * 6, y: oy + 90 - Math.sin(tt * 4) * 14 + Math.sin(hd * 4) * 14, t: tt }); }
    C.drawTrail(c, pts, now, 2.2, d, col === 2 ? undefined : { x: ox + 200, y: oy + 90 }); c.fillStyle = '#ddd'; c.fillRect(ox + 196, oy + 50, 8, 40); c.font = '12px sans-serif'; c.fillText(d.name + ' (' + d.rarity + ')' + (col === 2 ? ' stopped' : ''), ox + 6, oy + 14); } });
  return cv.toDataURL().slice(22); });
fs.writeFileSync(process.argv[2] || '/tmp/trails.png', Buffer.from(b64, 'base64')); await browser.close();
