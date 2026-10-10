# Mobile

**Tiers** (`src/quality.ts`, Settings > Display > Graphics quality: Auto / High / Medium / Low; `?q=low` overrides for testing; FPS overlay toggle in the same tab, F3 on desktop).

| Tier | canvas dpr cap | max canvas MP | effects | enemy sprite smoothing | atlases kept | variety music preload |
|---|---|---|---|---|---|---|
| High (desktop, unchanged) | 2 | unlimited | all | high | 8 | yes |
| Medium (phones/tablets) | 1.5 | 2.6 | no dust/fog/steam, half the lights | medium | 6 | no (on demand) |
| Low (<=3GB RAM, <=4 cores, Save-Data) | 1 | 1.3 | no lights/glows, no walk-frame blends for non-elites | low | 4 | no |

Auto = High on fine pointers; coarse pointer -> Medium, or Low on weak hardware. On Auto + coarse pointer only, the frame loop also scales resolution (floor 0.7) and then drops a tier when the 1.5 s average frame exceeds 26 ms; it recovers resolution after 4 good windows but never climbs back to a tier it fell from. Desktop never enters the dynamic path.

**Controls**: floating joystick (left 46%), aim-drag ability buttons, 44px+ targets, multi-touch, `touch-action:none`, overscroll/selection/callout/pinch suppression, 100dvh + visualViewport, safe-area insets. Portrait shows a rotate prompt with "Play in portrait anyway" (panels become bottom sheets under 640px).

**PWA**: manifest (fullscreen, landscape, maskable icons), Apple meta, versioned service worker (production builds only; code network-first, art/audio cache-first per build id), wake lock, audio unlock on first touchend, suspend on hide, save on hide/pagehide/freeze.

**Test**: `node tests/mobile.mjs` (QUICK=1 skips throttled perf).
