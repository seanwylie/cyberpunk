// Photosensitivity guard: every full-screen flash (damage vignette etc.) goes through here.
// Max 3 flashes per rolling second, alpha capped, and nothing at all when Reduced FX is on.
export const FLASH_MAX_PER_SEC = 3;
export const FLASH_ALPHA_CAP = 0.35;
const stamps: number[] = [];
export function flashAllowed(reduced: boolean, now = performance.now()): boolean {
  if (reduced) return false;
  while (stamps.length && now - stamps[0] > 1000) stamps.shift();
  if (stamps.length >= FLASH_MAX_PER_SEC - 1 || (stamps.length && now - stamps[stamps.length - 1] < 380)) return false;
  stamps.push(now); return true;
}
