// Cosmetic model layers (docs/SPRITE_PIPELINE.md "Cosmetic layers", docs/COSMETICS_VARIETY.md).
// Pieces are real meshes on the rig, rendered by tools/sprites/cos3d.py with the body as holdout and packed by
// tools/sprites/pack_cos.py into public/sprites/cos/<id>/<anim>.webp (same cell grid as the body sheets). Sheets are
// channel-coded: red = primary colour (c), green = secondary (c2), blue = glow, equal RGB = white highlight / outline.
// PlayerAnimator composites the recoloured sheet INTO the body's flat sheet once per look (no extra draw calls per piece).
// Items not in COS_ART still use the 2D overlay in src/cosmetics.ts (tests/cos_art_gaps.mjs lists them).
import { COS_ART } from './content/cosart';
import { COS_BY_ID } from './content/appearance';
export { COS_ART };
export const hasCosArt = (id: string | undefined) => !!id && COS_ART.has(id);
/** Slots composited back->front onto the body (later = nearer the camera; occlusion by the body is already baked in). */
export const COS_LAYER_ORDER = ['back', 'pet', 'legs', 'torso', 'arms', 'hands', 'hair', 'head', 'eyes', 'weapon', 'aura'];
export function cosArtIds(ids: readonly (string | undefined)[] | undefined): string[] {
  const out = (ids || []).filter((id): id is string => hasCosArt(id));
  return out.sort((a, b) => COS_LAYER_ORDER.indexOf(COS_BY_ID[a]?.slot) - COS_LAYER_ORDER.indexOf(COS_BY_ID[b]?.slot));
}
const hx = (h: string) => { if (h.length === 4) h = '#' + h[1] + h[1] + h[2] + h[2] + h[3] + h[3]; return [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); };
/** Recolour a channel-coded sheet with the item's colours (once per look at compose time; same formula as tools/sprites/cos_contact.py). */
export function recolorSheet(im: CanvasImageSource & { width: number; height: number }, id: string): HTMLCanvasElement {
  const d = COS_BY_ID[id]; const cv = document.createElement('canvas'); cv.width = im.width; cv.height = im.height; const x = cv.getContext('2d', { willReadFrequently: true })!; x.drawImage(im, 0, 0);
  if (!d) return cv; const c = hx(d.c), c2 = hx(d.c2 || d.c), gl = c2.map(v => Math.min(255, v * .6 + 102));
  const img = x.getImageData(0, 0, cv.width, cv.height), p = img.data;
  for (let i = 0; i < p.length; i += 4) { if (!p[i + 3]) continue; const r = p[i], g = p[i + 1], b = p[i + 2], w = Math.min(r, g, b), R = (r - w) / 255, G = (g - w) / 255, B = (b - w) / 255;
    p[i] = R * c[0] + G * c2[0] + B * gl[0] + w; p[i + 1] = R * c[1] + G * c2[1] + B * gl[1] + w; p[i + 2] = R * c[2] + G * c2[2] + B * gl[2] + w; }
  x.putImageData(img, 0, 0); return cv;
}
/** Store / locker / wardrobe icon: the real model piece (packed by pack_cos.py), or '' when the item has no art yet. */
export const cosIcon = (id: string) => hasCosArt(id) ? `<img class="cosicon" src="sprites/cos/${id}/icon.webp" alt="" loading="lazy" draggable="false">` : '';
