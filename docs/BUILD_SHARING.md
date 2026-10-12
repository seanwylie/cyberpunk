# Build inspector, export and catalog versions

* **Inspector**: Locker → **Build** (next to Abilities codex). Shows equipped augments (icon tiles, details in tooltips), chips, abilities, totals and active synergies (ability tag combos, maker set / mixing penalty, conflicts).
* **Export**: Copy code (`WVB1.<base64url JSON>`), Copy link (`?build=`), Copy text (markdown summary), JSON download. Every export carries `game` (build id) and `cat` (catalog version).
* **Import**: paste a code or link and press View, or open a `?build=` link. It's a **read-only preview**: nothing is granted.
* **Console**: `wvBuild.code()`, `.url()`, `.text()`, `.json()`, `.decode(code)`, `.view(code)`, `.diff(code)`, `.catalog`.

## Catalog versions
`npm run catalog` (tools/gen_catalog.mjs) writes docs/CATALOG.md, docs/catalog/augments.json and docs/catalog/index.html. It also hashes the compact snapshot
(`src/catalog_snap.ts snapshot()`: items, chips, abilities, sockets, conflicts) into `CATALOG_VERSION` (src/catalog_version.ts) and stores it in
`public/catalog/v/<version>.json`. Snapshots are append-only: never delete them, or old links lose their "What changed" detail.

If a build's `cat` differs from the current version, the preview fetches the old snapshot and shows **What changed** (`diffBuild`):
stat, ability and rename changes; removed augments or chips, chips that no longer fit, fewer sockets, new hard conflicts and lost combos are flagged **Incompatible**.
If the old snapshot is missing, the preview shows a clear warning. It never silently shows different numbers.

Tests: `tests/catalog.mjs` (freshness, gaps, versions, old-version diffs) and `tests/build_export.mjs` (round trip, bad codes, inspector vs equipped state, preview, What changed).
Run `npm run catalog` after changing items, chips or abilities, or `tests/catalog.mjs` fails as stale.
