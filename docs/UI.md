# UI text principle

**Don't cram text into the interface.** Panels, tiles, the HUD and station labels show compact labels or icons; full detail lives in the shared tooltip.

- **One tooltip component:** any element with `data-tip="<html>"` gets it (`UI.bindTips` in `src/ui.ts`). Hover on desktop, long-press on touch; placement tries right/left/below/above and is clamped to the viewport, so it is never clipped or off-screen.
- **Short labels:** `shortLabel(name, max)` (`src/uitext.ts`) drops the maker prefix and side suffix and keeps whole words up to `max` characters (story tiles use 12). The full name goes in `data-tip` and `aria-label`.
- **Class helpers:** `.nm2` (2-line clamp with ellipsis) for item names in grids; `.fit` (auto-shrink to a 12px floor, then ellipsis + title); story tile captions use `.cap` (one line, ellipsis).
- **Rule:** text may be shortened (ellipsis or line clamp) only if the full text is reachable through a tooltip, `title` or `aria-label`. Text must never be cut mid-glyph by a box edge.
- **Renamed content:** old saved story lines are rewritten on load (`renameLegacy` in `src/story_beats.ts`), so retired names never show.

## Test
`tests/ui_overflow.mjs` opens story, locker, store, vendor, bank, wardrobe, fixer, guild, travel and the HUD at 1280x720 (desktop) and 844x390 (phone, touch) with the longest item names. It fails on any text element that overflows its box horizontally or vertically and is clipped without an ellipsis/line-clamp plus a tooltip. It also checks that an old story entry that mentions a retired zone name renders with the new names. Screenshots: `shots/ui_overflow/<panel>_<desktop|phone>.png`.
