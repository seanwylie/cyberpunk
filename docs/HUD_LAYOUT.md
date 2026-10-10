# HUD layout system

One layout layer, defined at the end of `src/style.css` ("HUD layout system"). Tested by `tests/hud_boxes.mjs`.

Shared variables (`:root` / `body`): `--hud-gut` (edge gutter, clamp 8-14px), `--hud-gap` (4px between stacked boxes), `--hud-r` (corner radius),
`--hud-padv/--hud-padh` (plate padding), `--hud-plate`/`--hud-line` (plate fill/border), `--hud-col` (stack column width),
`--ctl-w` / `--cap-h` (ability cluster width and caption strip). Safe-area insets are added once, at the edge of each region.

Regions (no per-element absolute offsets):
- `#hudtop` grid: `#topleft` stack (HP bar, heat bar, `#meta` level/credits/instance/pack line, `#support`, tutorial card `#tut`) in one column;
  `#objective` centred between stack and tray (>= 820px) or right-aligned under the tray (< 820px); `#topright` tray, `#minimap`, `#livepanel` share the right edge.
- `#hudbot` grid: `#toasts` (bottom-left, above the BVG mark), `#hudmid` (cast bar, interact prompt, key hint, centred), `#controls` (ability + dodge
  circles on one baseline, caption strip below). < 820px the centre row moves above toasts | controls.
- `#bvgmark` sits on the bottom gutter, left edge = gutter. Tutorial dock bar (`#tut.dock`) is a bottom-gutter plate; the bottom HUD is hidden while it shows.

All text boxes use the same plate (radius, padding, border, fill); accent colour is an inset 3px stripe (`--ac`) so geometry never differs between components.
