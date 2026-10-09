// 8-way SCREEN-SPACE facing for enemy sprites (pure logic, no DOM; unit-tested in tests/facing.mjs).
// Directions are clockwise from screen-right: E, SE, S(down/front), SW, W, NW, N(up/back), NE. World (x,y) maps to screen (x-y, x+y) after undoing the 2:1 squash.
export const DIR_NAMES = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'] as const;
export const E = 0, SE = 1, S = 2, SW = 3, W = 4, NW = 5, N = 6, NE = 7;
const TAU = Math.PI * 2;
/** world direction -> screen vector */
export const toScreen = (wx: number, wy: number) => ({ sx: wx - wy, sy: wx + wy }); // un-squashed (true-iso) so ground axes read as the 4 screen diagonals and ground diagonals as up/down/left/right
/** nearest of the 8 notches for a screen vector (angle measured clockwise from +x because screen y points down) */
export function dirIndex(sx: number, sy: number) { const a = (Math.atan2(sy, sx) + TAU) % TAU; return Math.round(a / (TAU / 8)) % 8; }
const diff = (a: number, b: number) => { let d = ((b - a) % 8 + 8) % 8; if (d > 4) d -= 8; return d; }; // signed notch distance a->b (shortest way)
/**
 * Smooth turning: stays on the current notch until the target is clearly past the sector edge (hysteresis, `margin` of a notch beyond the
 * boundary), then advances exactly ONE notch toward it, at most once per `minHold` seconds. So a 180 degree turn walks through the intermediate
 * notches instead of popping.
 */
export function stepDir(cur: number, sx: number, sy: number, held: number, minHold = .1, margin = .3) {
  if (Math.hypot(sx, sy) < 1e-6) return cur;
  const a = (Math.atan2(sy, sx) + TAU) % TAU / (TAU / 8); const d = ((a - cur) % 8 + 8) % 8; const signed = d > 4 ? d - 8 : d; // fractional notch offset
  if (Math.abs(signed) < .5 + margin || held < minHold) return cur;
  return (cur + Math.sign(signed) + 8) % 8;
}
export interface Variant { kind: 'front' | 'back' | 'side' | 'tfront'; flip: 1 | -1; xs: number; skew: number; dark: boolean; }
/** fallback (no 3D atlas): which flat sprite draws a facing. NO squash/skew; real 8-direction art lives in the 3D atlases (src/enemyart.ts).  `has` says which optional art exists for the enemy: back / side (profile facing screen-right) / tfront (true front). */
export function variantFor(dir: number, has: { back?: boolean; side?: boolean; tfront?: boolean }): Variant {
  switch (dir) {
    case S: return has.tfront ? { kind: 'tfront', flip: 1, xs: 1, skew: 0, dark: false } : { kind: 'front', flip: 1, xs: 1, skew: 0, dark: false };
    case N: return { kind: has.back ? 'back' : 'front', flip: 1, xs: 1, skew: 0, dark: !has.back };
    case E: return has.side ? { kind: 'side', flip: 1, xs: 1, skew: 0, dark: false } : { kind: 'front', flip: 1, xs: 1, skew: 0, dark: false };
    case W: return has.side ? { kind: 'side', flip: -1, xs: 1, skew: 0, dark: false } : { kind: 'front', flip: -1, xs: 1, skew: 0, dark: false };
    case SE: return { kind: 'front', flip: 1, xs: 1, skew: 0, dark: false };
    case SW: return { kind: 'front', flip: -1, xs: 1, skew: 0, dark: false };
    case NE: return { kind: has.back ? 'back' : 'front', flip: -1, xs: 1, skew: 0, dark: !has.back };
    default: return { kind: has.back ? 'back' : 'front', flip: 1, xs: 1, skew: 0, dark: !has.back }; // NW
  }
}
export { diff as notchDiff };
