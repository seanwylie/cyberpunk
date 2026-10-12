# Simulated store (STORE_SIM)

No real money, no payment provider. A mock storefront that behaves like real IAP, so a real provider can be swapped in later. Cosmetics stay stat-neutral and the rarity policy (docs/APPEARANCE_ITEMS.md section 2) is untouched.

## What is sold
* **Premium skins** (`pm_*` cosmetics, source `premium`, grey/green/blue only, $1.99 green / $2.99 blue). Never purple/orange, never in drop tables, appearance only.
* **Bundles** (`bundle_*`): several premium skins at a discount. A bundle grants only the pieces not yet owned.
* **Locker slots**: `locker_slots_1..5`, +20 slots each, prices 0.99 / 1.99 / 2.99 / 4.99 / 7.99, capped at 5 tiers (+100). Feeds `Save.purchases.lockerBlocks`, which every capacity calc already reads.
* **Bank tabs**: `bank_tab_1..4`, +1 tab (60 slots) each, 1.49 / 2.99 / 4.49 / 6.99, capped by the bank tab maximum.
Tiers must be bought in order. All prices are labelled **SIMULATED** in the UI.

## Where it lives
| File | Role |
|---|---|
| `src/store.ts` | Catalog, entitlement logic, purchase flow, mock provider, upsell hooks, `window.wvStore` |
| `src/storeui.ts` | Outfitter modal (Skins / Bundles / Storage tabs, confirm step, processing, funnel panel) |
| `src/analytics.ts` | Event layer: ring buffer, sinks, funnel, export |
| `src/content/appearance.ts` | `premium` cosmetic source + `pm_*` rows |
| `Save.store` (`src/state.ts`) | Receipts, tier counters, simulated spend (persisted with the save) |
| `tests/store.mjs` | `npm run test:store` |

## Entry points
* Town station **Outfitter**, the **Store** button in the Wardrobe and in the Locker header.
* Dressing room (Wardrobe): try any store skin or set on the rotatable model and **Buy** in place through the same purchase flow (docs/DRESSING_ROOM.md).
* Locker or Bank full: one gentle inline row ("Locker is full. Optional: ... Not now"). It is dismissable for 15 minutes and logged once per appearance.
The Store, Wardrobe, Locker and Bank modals refuse to open outside town, and the prompt helpers return nothing when `mode !== 'town'`, so nothing appears in a run or mid-combat.

## Purchase flow
`startPurchase` (user pressed Buy, confirm sheet opens, `purchase_start`) -> `confirmPurchase` (user pressed Confirm, `purchase_confirm`, `provider.purchase()`) -> `fulfil` (idempotent grant, `purchase_success`, `entitlement_granted`) or `purchase_fail` / `purchase_cancel`. Only one order may be active at a time. Cancel works at the confirm sheet and while processing; a failed or cancelled order grants and charges nothing.

**Idempotency:** `Save.store.receipts[receiptId]` exists after the first grant. `fulfil` with a known receipt id returns `{duplicate:true}`, grants nothing, and logs `purchase_duplicate_receipt`. Tier SKUs also check the counter, and skins check ownership.

## Test knobs (mock provider)
```js
wvStore.config({ failureRate: 0.3, delayMs: 800 }) // persists in localStorage 'wv_store_cfg'
```
Defaults: 1200 ms delay, 0% failure.

## Analytics
Events: `store_open, sku_view, purchase_start, purchase_confirm, purchase_success, purchase_fail, purchase_cancel, entitlement_granted, storage_full_prompt, wardrobe_locked_item_click, purchase_duplicate_receipt`.
Ring buffer of the last 500 events in memory, plus a localStorage sink (last 200, key `wv_analytics`) and a console debug sink.
* In game: Store -> **Funnel** button (views > starts > successes, fails, cancels, per-SKU counts, SIMULATED revenue, export to console/clipboard).
* Console: `wvStore.funnel()`, `wvStore.funnelText()`, `wvStore.events()`, `wvStore.export()`, `wvStore.reset()`.
* Sinks implement `{ name, write(event) }`. A sink that throws is ignored. `httpSink(url)` is a ready template (batched `sendBeacon`/`fetch`): `wvStore.addHttpSink('https://example/ingest')` or `addSink(...)` in code.

## Wiring a real provider
1. Implement `PaymentProvider` (`src/store.ts`): `purchase(order) => Promise<{status, receiptId?, reason?}>` and optional `cancel`. For Apple/Google/Stripe, open the native or hosted checkout inside it and return the transaction id as `receiptId`.
2. Call `setProvider(new RealProvider())` at boot. The UI and analytics need no change.
3. **Validate receipts on a server** before granting: have `purchase()` call your backend with the receipt, and only resolve `success` once the backend confirms. Keep `fulfil(save, sku, receiptId, cents)` as the single grant point; it is already idempotent per receipt id, so restore-purchases and retries are safe.
4. Move entitlements server-side (accounts) before real money: saves are local today, so a player can edit `Save.store` or cosmetics. Do not ship real payments on local saves alone.
5. Replace the `SIMULATED` labels and `cents` placeholder prices with store-localised prices (`Order.currency`).
6. Add an `httpSink` to your analytics endpoint and drop the console sink.
