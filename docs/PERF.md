
## Walker frame cache (quiet box, 1280x720, software raster, medians of 2-3 runs)
| | submit p95 x1 | submit p95 x4 CPU | draw+raster p95 x1 | x4 |
|---|---|---|---|---|
| before | 6.6-8.5 ms | 33-36 ms | 38-50 ms | 172-185 ms |
| after  | 4.5-4.8 ms | 20-27 ms | 35.5-37 ms | 158-171 ms |
Walkers (up to 11) used to composite 5-6 canvas ops each per frame (frame blend + multiply tint + destination-in mask + scaled blit); steady walkers now blit one cached, tinted frame (bounded LRU of 360 canvases). The remaining cost is software rasterisation of the town items (headless SwiftShader), not JS submit. A full profile pass (draw-call counts, GC, HUD DOM) was not completed because the box was saturated (load 70) when the pass began.

# Memory (Chrome "Out of Memory" tab crash on load)

Sean's Chrome tab died with *Error code: Out of Memory* while the game was **loading**. Root cause: `MusicManager.load()` decoded all 8 core tracks and then every "variety" track at start-up (36 `AudioBuffer`s). Each 146 s stereo 44.1 kHz track decodes to ~23 MB (Float32 PCM, 2 ch), measured 837 MB for the set, on top of ~110 MB of images and ~190 MB of canvases. That alone put the process at ~1.6 GB before the first frame was drawn.

## What changed
| Area | Before | After |
|---|---|---|
| Music at boot | 36 tracks decoded (837 MB PCM) | **1** track (+1 queued next track). `window.__WV_MUSIC_ALL=1` restores the old behaviour for the music tests only |
| Music while playing | everything stayed decoded | LRU cap: High 5, Medium/Low 3 decoded tracks (current, fading-out, queued next and pending are never evicted); others re-fetch from the HTTP/SW cache. Tab hidden: no background decoding, idle tracks dropped after 20 s |
| Enemy 3D atlases (~23 MB each at full res, 6 MB half-res) | LRU cap 8 / 6 / 4 | cap **5 / 4 / 3** (High / Medium / Low). Medium/Low already load the `_h.webp` half-res sheets |
| Quality | desktop always High | desktop with `navigator.deviceMemory` <= 4 starts on Medium, <= 2 on Low |
| Memory pressure | none | every 5 s: if the JS heap passes 70% of its limit, idle music is freed and Auto quality drops one tier (`Q.lowMem`). An explicit Settings > Display choice is never overridden |
| Dev tooling | none | `?mem` (or `localStorage.wv_mem=1`) shows a bottom-left overlay: JS heap, decoded images, canvases, music. `window.__memSnap()` returns the same numbers by directory (`src/memtrack.ts`, WeakRef tracking, zero cost when off) |

## Measured (headless Chrome, software GL, 1920x1080, whole process tree PSS, quiet box)
Process numbers include ~450 MB of Chrome + SwiftShader baseline, so compare before/after, not against a laptop's Task Manager.

| Scenario | Before | After |
|---|---|---|
| Load to first interactive frame + 8 s, High, DPR 1.5, dev server | peak **1630 MB** (audio 837 MB / 36 tracks) | peak **~820-860 MB** (audio 48-73 MB / 2 tracks) |
| Same, DPR 1.0 | 1602 MB | 710-800 MB |
| Same, production build (`vite build` + preview), DPR 1.5 | n/a | 750-870 MB |
| Town -> dungeon -> town x2, High | peak 1820 MB, music 886-959 MB | (4 rounds) peak 1146 MB, music <= 171 MB |
| Same, Medium / Low (4 rounds) | n/a | peak 896 / 899 MB, decoded 459 / 444 MB |

Dev (`vite` unbundled modules) vs production build differ by < 10% in process memory; the crash cause was not dev-only.

## Remaining known costs (not yet changed)
* Player sprite sheets: 8 sheets of 2560x1280 WebP decode to **75 MB** on every tier (half-res player sheets would cut it to ~19 MB on Medium/Low; needs an art pass + atlas cell scaling).
* Town canvases at DPR: ~125-190 MB at DPR 1-1.5 (2880x1620 main canvas 18 MB, town layers 16 + 12 MB). Dungeon runs create ~350 extra small canvases (floor/prop tints) that are freed on return to town.
* Process memory still creeps ~40-80 MB per dungeon round after the JS-tracked decoded total has stopped growing (allocator retention of freed image/audio memory, seen with a pure load/release experiment as well); it plateaus per atlas cap.
* The service worker caches heavy files in Cache Storage (disk, not RAM).

## Tests
* `node tests/memory.mjs` (`npm run test:memory`) — median of `MEM_RUNS` (default 3) runs per tier; per-tier scenario (boot, town, [dungeon, town] x N) with budgets (process memory, decoded images+canvases+audio, music) and growth checks (process, JS heap, decoded, canvas count, listeners). Env: `MEM_TIERS`, `MEM_ROUNDS`, `MEM_TOWN_S`, `MEM_RUN_S`, `MEM_REPORT=1` (print only).
* `node tests/memory_boot.mjs` — peak process memory while loading at DPR 1 / 1.25 / 1.5 (`BOOT_TIERS`, `BOOT_DPRS`, `URL=` for a preview build), plus "at most 2 music tracks decoded at boot".
* Budgets and the perf gate: see `docs/PERF_BUDGETS.md` (`npm run test:perf`).
