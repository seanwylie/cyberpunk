// Offscreen sheet of every aura at 3 moments (dark + light floor) with the real body sprite. node tools/cos/aura_sheet.mjs out.png
import { launch, sleep } from '../../tests/lib.mjs'; import fs from 'fs';
const { browser, page } = await launch({ viewport: { width: 800, height: 600 } }); await page.waitForFunction(() => window.__rend?.anim, null, { timeout: 120000 }).catch(() => {});
const b64 = await page.evaluate(async () => { const A = await import('/src/content/appearance.ts'), C = await import('/src/cosmetics.ts'), S = await import('/src/sprites.ts'); const an = window.__rend.anim ? new S.PlayerAnimator(window.__rend.anim.loaded) : null;
  const L = A.COSMETICS.filter(d => d.slot === 'aura'); const CW = 150, CH = 150, W = CW * 4, H = CH * L.length; const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const c = cv.getContext('2d');
  L.forEach((d, r) => { for (let col = 0; col < 4; col++) { const ox = col * CW, oy = r * CH; c.fillStyle = col === 3 ? '#9a8c74' : '#2a2724'; c.fillRect(ox, oy, CW, CH); const k = { c, x: ox + 75, y: oy + 128, u: 2.2, t: 3 + col * .7, moving: false, face: 0, id: 'sheet' };
    c.save(); c.beginPath(); c.rect(ox, oy, CW, CH); c.clip(); C.drawCosmetics(k, [d], 'back'); if (an) { an.anim = 'idle'; an.t = 1; an.dir = 2; an.draw(c, k.x, k.y, k.u); } C.drawCosmetics(k, [d], 'front'); c.restore(); c.fillStyle = '#ddd'; c.font = '11px sans-serif'; c.fillText(d.name + ' ' + d.rarity, ox + 4, oy + 12); } });
  return cv.toDataURL().slice(22); });
fs.writeFileSync(process.argv[2] || '/tmp/auras.png', Buffer.from(b64, 'base64')); await browser.close();
