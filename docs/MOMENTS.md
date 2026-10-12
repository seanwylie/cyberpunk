# Shareable moments

Once per session, the game captures your best moment as a shareable **card** (PNG, 1200x630). With the clip buffer on, it also saves a short **WebM clip**. A small **Moment** button appears, and it opens Share / Copy / Download (and Clip).

Code: `src/moments.ts` (selection), `src/moment_card.ts` (card), `src/clipbuf.ts` (rolling buffer), `src/moments_ui.ts` (controller and panel). Test: `tests/moments.mjs`.

## What counts
| Moment | Score | Trigger |
|---|---|---|
| Nemesis slain | 100 | `nemOnKill` |
| Exclusive drop | 90 | reserved for the seasonal / exclusive drop work |
| Orange drop | 80 | picking up an orange item or chip (`autoPickup`) |
| Gateway cleared | 70 | first clear of a gateway dungeon (`gatewayClear`) |
| Flawless boss | 60 | boss killed without taking a hit after it spawned (not in god mode) |

You get one capture per session. A strictly better moment replaces it until you share, copy or download it, and then it's locked.

## Card
A painterly splash frame in the League / Arcane direction: a warm painted wash, soft brush strokes, a thin gold double frame, a scaled screenshot of the moment, the title and line, stats (runner, level, dungeon, kills, trait), the build code (the full code is in the share link), and the wordmark. No particles.

## Clip buffer
* **Off by default.** Behind flag `momentClip`, under Settings > Display > Clip buffer.
* Uses `canvas.captureStream(15)` plus `MediaRecorder` (VP8, 0.9 Mbps). Encoding runs in the browser's media pipeline, so the frame loop does no per-frame work.
* Segments are 5 s long, and each one is a standalone, playable WebM. It keeps the last complete segment and the one recording now. At capture time it finishes the current segment and uses it if it's at least 2 s long, otherwise the previous one.
* **Hard memory cap: 3 MB** across all kept blobs. The oldest segments are dropped first. A segment that breaks the cap by itself is dropped and the buffer shuts down (`disabledWhy:'over memory cap'`).
* It pauses while the tab is hidden, and turning the setting off stops it and frees its memory.

## Performance budget
| Item | Budget | Test |
|---|---|---|
| Clip buffer memory | <= 3 MB (hard) | `tests/moments.mjs`: live peak, plus a forced 20 KB cap that drops and self-stops |
| Frame time with buffer on | p95 <= max(1.25x off, off + 4 ms) | `tests/moments.mjs` (rAF deltas, 3 s each) |
| Flag off | no buffer or recorder allocated | `tests/moments.mjs` |
| Card render | only at capture: one `drawImage` after the frame, then the card renders on `requestIdleCallback`; temporary canvases are released | |

These numbers are meant to drop into `docs/PERF_BUDGETS.md` / `tests/perf_gate.mjs` once that gate lands.

## Share / Copy / Download
* **Share:** the Web Share API with the PNG file (falls back to a link share, then to Copy).
* **Copy:** puts the image on the clipboard (falls back to the title plus the build link).
* **Download:** saves the PNG. **Clip** saves the WebM.
Every control has a short label and a tooltip. The panel fits at 1280 and 390 px, which the test checks.

## Flags
`moments` (default on, Settings > Display > Moment cards) and `momentClip` (default off).
