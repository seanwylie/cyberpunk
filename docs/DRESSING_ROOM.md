# Dressing room

The Wardrobe modal (`src/wardrobeui.ts`) is a dressing room. **Selecting never changes your character.** Every pick is a preview on a large model, and only **Apply** commits it.

## Layout
* **Stage (left):** a large model drawn from the Blender pipeline's 8-direction sprite atlas (`public/sprites/player.json`). It runs the idle animation under a key light and spotlight, on a floor disc lit in the selected item's rarity colour.
  * **Rotate:** drag or swipe the model (40px per 45° step), use the ⟲ ⟳ buttons, or the arrow keys when the model has focus.
  * **Smooth snapping:** the shown direction eases to the target step, cross-fading the two nearest baked directions on the way, so there is never a ghost image at rest.
* **Diff chips** under the model show every slot where the preview differs from what you wear: `+` is an owned piece, `$` is a store piece still to buy, `−` is a removed piece. The full "from → to" shows in each chip's tooltip.
* **Action bar:**
  * **Apply n** wears the previewed pieces you own. Store pieces stay previews until bought.
  * **Revert** drops the whole preview.
  * **Buy** is shown when the selection is buyable. **Confirm / Cancel** replace it during the simulated checkout.
* **Browser (right):**
  * Tabs: All, Sets and one per slot.
  * Filters:
    * **All** shows everything, with undiscovered drops as `?` tiles.
    * **Owned** shows only what you own.
    * **Store** shows only what you can buy.
  * Each tile has a rarity border (with a glow for purple and orange), and shows `✓` when owned, `●` when worn and an outline while previewing. Unowned tiles show their price.
  * Badges: **NEW** (owned within 7 days and not yet previewed), **★** (featured: part of a set), **LTD** (limited event drop).
* **Outfits:** **Save** stores the current preview (owned pieces only) in L1–L3. Clicking an outfit previews it; Apply wears it.

UI rule (docs/UI.md): labels are short (slot codes, prices, badges). Names, lore, sources and diffs live in the shared `data-tip` tooltip, shown on hover or on long-press on touch.

## Monetization hooks (simulated store, docs/STORE_SIM.md)
* **Try before you buy:** store skins (`pm_*`) and credit items preview exactly like owned items.
* **Sets:** the Sets tab lists bundles. A tile shows the bundle price, and its tooltip lists the pieces and the separate total struck through. Clicking a set tries every piece on, and Buy then targets the bundle SKU.
* **Buy** runs `startPurchase` → (Confirm) → `confirmPurchase` → `fulfil` in `src/store.ts`. That is the same idempotent path, receipts and funnel as the Outfitter, so a real provider swap needs no dressing-room changes.
  * After a purchase the piece is owned but still only a preview, and the player presses Apply.
  * Cancel charges and grants nothing.
  * Credit items (vendor source) use `buyCos`.
* **Analytics** (`src/analytics.ts`):
  * `dr_preview` (item or set; carries the SKU for store items)
  * `dr_rotate` (via button, drag or key)
  * `dr_buy_intent`
  * `dr_apply`
  * `dr_revert`
  * `dr_outfit_save`
  * `dr_outfit_load`
  * The store events (`purchase_start/confirm/success/...`) and `wardrobe_locked_item_click` are logged as before. Read them with `wvStore.events()` or `wvStore.funnel()`.
* The Outfitter's **Preview** button opens the dressing room with that skin staged (`previewFromStore`).

## State and API
* `WD.staged` holds the per-slot preview overrides: an id tries an item on, `null` takes the slot off. The live save is never touched until Apply.
* Functions (all exported):
  * Looks: `wornLook`, `previewLook`, `lookDiff`
  * Staging: `stageItem`, `stageSet`, `revert`, `applyLook`
  * Rotation and buying: `rotate`, `buyTarget`
  * Outfits: `saveOutfit`, `loadOutfit`
* Saved outfits persist in `save.cosmetics.outfits` (3 slots).
* Debug hook: `window.__dr` (`WD`, `previewLook()`, `wornLook()`, `diff()`, `activeOrder()`).

## Tests
* `tests/dressing_room.mjs` (`npm run test:dressing-room`) runs at 1280x720 and at 844x390 touch. It checks:
  * Preview does not change the equipped look, and the diff chips match.
  * Revert works.
  * Apply commits.
  * Rotation works by button, key and drag, walking all 8 directions and snapping.
  * A store try-on goes through Buy → Confirm in the sim store (receipt and funnel success) and stays a preview until Apply.
  * Cancel charges and grants nothing.
  * The set price is right.
  * Outfits save and load.
  * Badges and analytics events are present.
* Screenshots: `shots/dressing_room/{preview,rotated,tryon_store,set}_{desktop,phone}.png`.
* `tests/ui_overflow.mjs` covers the panel for clipped text, and `tests/appearance.mjs` and `tests/store.mjs` cover the Apply flow and the store entry point.
