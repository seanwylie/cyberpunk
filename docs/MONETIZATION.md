# Warranty Void: Monetization Strategy

Rating: MA. The store is simulated (see `docs/STORE_SIM.md`, `wvStore`). Nothing is charged.
Hard rule: **no pay-to-win.** We sell cosmetics, convenience and account-wide storage only. `tests/monet.mjs` asserts that buying any SKU changes no stat.

## 1. Benchmarks

| Game | What works | What we adopt | What we avoid |
|---|---|---|---|
| League of Legends | Tier ladder (Standard → Epic → Legendary → Ultimate), themed skin **lines**, chromas, recall animations, rotating sale + "Your Shop" | Tier ladder, lines, chromas, custom recall, weekly hero discount | Gacha capsules / Mythic essence loops |
| Valorant | Bundles of weapon skins with finishers and VFX levels; 2-week bundle rotation | Line bundles (~25% off), weapon skins, finishers (as ability flourish) | Very high bundle prices ($60–100) |
| Path of Exile | Pure cosmetics + **stash tabs** (account-wide storage); supporter packs | Locker/bank tiers, starter/supporter pack, "Founder" line | Storage pressure tuned so tabs feel mandatory |
| Fortnite | Daily/weekly item shop, battle pass that pays back its own price, emotes | Weekly featured + 6-slot deterministic rotation, Season pass skeleton, emotes | Artificial FOMO timers on non-dated items |
| Diablo IV | Premium armor sets, season pass with free track | Free + premium tracks, MA-toned dark premium sets | Pass XP boosters (pay-for-power adjacent) |

## 2. Tiers and price ladder (USD, simulated)

| Tier | Rarity color | Price | Includes |
|---|---|---|---|
| Standard | blue | $4.99 | recolor / material swap |
| Epic | purple | $9.99 | unique accent silhouette (pmfx `ACC`) + emissive |
| Legendary | orange | $17.99 | new Blender 8-direction body, emissives, ability flourish, **custom recall**, SFX |
| Ultimate | orange | $24.99 | Legendary + bundled pet / extra recall, crest silhouette |
| Chroma | (skin's) | $2.99 | palette variant; requires the base skin |

Legendary/Ultimate are only sold while **featured or in rotation** ("Returns in a future rotation" otherwise) — same as LoL's legendary-in-shop model, with no expiry pressure (they always come back). Source: `src/content/skinlines.ts` `TIER`.

**Currency:** the sim prices in USD directly for transparency. For live, recommend one premium currency ("Credits") with packs that **match** item prices (no leftover-orphan amounts), always showing the real-money equivalent next to the credit price.
**No loot boxes.** If a random cosmetic box is ever added: show exact odds, use a pity counter shown in the UI (guaranteed at N), never put new or exclusive items only in boxes, and disable boxes in regions that ban them (BE/NL) and for under-18 accounts.

## 3. Lines and collections (shipped in the sim)

| Line | Top skin | Epics | Chromas | Collection reward |
|---|---|---|---|---|
| Hextech Saints | **Hextech Saint** (Ultimate, halo crest, crystal pauldrons, hextech pet) | Hextech Warden, Hextech Lancer (+ Standard Recruit) | ruby, obsidian, jade | `col_hextech_*` banner |
| Chrome Bloom | **Chrome Bloom Empress** (Legendary, petal fins, glow veins, orchid crest) | Bloom Courier, Orchid Medic | violet, jade, frost | `col_bloom_*` |
| Neon Ronin | **Neon Ronin** (Legendary, kasa hat with neon brim, scabbard, sash) | Ronin Initiate, Street Ronin | gold + 2 | `col_ronin_*` |
| Undercity | — | Pipefitter, Alchemist | — | `col_undercity_*` |
| Void | — | Void Auditor, Breach | — | `col_void_*` |
| Founder | **Founder's Mark** (Legendary, mantle, filament pin, circlet; dated window) | — | ember | `col_founder_plate` |

Owning every skin in a line auto-grants its reward (`checkCollections`). The line bundle is the whole line for about 25% off.

## 4. Shop structure

- **Featured (weekly hero):** one Legendary/Ultimate, 20% off, rotates every Monday 00:00 UTC (Sunday 8 PM ET). The schedule is deterministic from the week number (`weekOf`, epoch 2026-01-05), so everyone sees the same shop.
- **Rotation:** 6 seeded slots per week. The hero is excluded, and **retired items are excluded forever** (tested over 260 weeks).
- **Starter pack ($4.99, once per account):** Ronin Initiate (Epic), Wave emote, Scout drone pet, and +1 locker tier. Value is shown in the UI.
- **Line bundles:** described above.
- **Season pass (Season 1: Neon Saints, Oct 1 – Dec 31 2026):** 30 levels × 1000 XP, with free and premium ($9.99) tracks. XP **only** from play: kill 4, elite 20, boss 120, clear 300, first visit 150. There are no XP boosters for sale, and pass rewards are cosmetic.
- **Extra cosmetic slots:** emote, recall, weapon skin, pet (plus the existing 12 slots).
- **Account-wide storage:** locker tiers $0.99 → $7.99 and bank tabs (existing). Recommend **character slots beyond 10** at $4.99 each, uncapped (convenience only).
- **Gifting (recommended, not built):** gift any sellable SKU to a friend of 3+ days. Exclusives and retired items are not giftable.

## 5. Exclusivity pillar (Webkinz-style)

- **Dated releases:** these show "Available until <date> · Xd Yh left". When the window closes the item becomes **Retired**, with its original dates ("Retired · Oct 1 – Nov 1, 2026"), and **never returns**.
- **Retirement registry:** `src/retire.ts` `RETIRED` is append-only. `tests/monet.mjs` fails if any retired id appears in featured, rotation, bundles, or as a buyable SKU, or if a past window is missing from the registry.
- **Earn-only exclusives:**
  - `ex_launch_week_halo`: clear a gateway during launch week, Oct 5–19.
  - `ex_world_first_gateway`: world-first gateway clear.
  - `ex_alpha_visor`: closed alpha, retired Sep 30.
  These can never be bought. Orange earned cosmetics from events and achievements remain earn-only.
- **Founder line:** Founder's Mark, sold Oct 1 – Nov 1 2026, then retired.
- **Proof of ownership:**
  - Badges: Founder / Retired / Limited / Exclusive.
  - Provenance line: "Acquired Oct 12, 2026 · Retired (Oct 1 – Nov 1, 2026)".
  - Shown in the wardrobe, in build exports (`buildcode` `ex`), and to other players.
- **Multiplayer:**
  - Other players see the exclusive render, a subtle brass filigree arc and glint.
  - Hub arrival triggers a ~3 s nameplate flair (◆ and a soft gold border).
  - Clicking a player opens the **inspect card**: exclusives with badge, acquired date and "1 of N owners", plus a showcase slot pinned from the wardrobe.
  - Owner counts are **simulated** until a backend exists.
- **Tradability:** exclusives are **account-bound** (`canTrade` = false). This prevents real-money trading markets, scam pressure and price speculation on minors, and keeps "I was there" meaningful.
- **Fairness:**
  - Every limited item has a clear end date shown up front.
  - No fake scarcity: no "only 3 left", and non-dated items are never shown with timers.
  - Nothing with gameplay power is ever retired.
  - Retired status is disclosed before purchase.

## 6. Ethical guardrails

- No stat effects (tested). No pay-for-XP. No loot boxes.
- **Age:**
  - Under-18 accounts get a monthly spend cap (default $50), no timers on the shop home, and parental purchase approval.
  - The MA rating means age-gating at account creation.
- **Regional:**
  - Show prices with tax.
  - Regional pricing parity (PPP tiers).
  - Follow the BE/NL loot box bans and the EU/UK consumer law 14-day refund on unused items.
  - Japan: no kompu-gacha mechanics.
- Confirm step on every purchase (sim has one), visible receipt history, one-click refund for unused SKUs within 48 h.
- Analytics are a funnel for UX, not for whale targeting. There is no personalized pricing.

## 7. Funnel analytics (implemented)

Events (`src/analytics.ts`): `store_open`, `shop_tab`, `featured_view`, `rotation_view`, `line_view`, `starter_view`, `pass_view`, `pass_level`, `pass_claim`, `sku_view`, `purchase_start` (with `first`), `purchase_success/fail/cancel`, `collection_complete`, `exclusive_earned`, `exclusive_view`, `showcase_set`, `inspect_open`, `emote_play`, `recall_play`, `retired_blocked`.

KPIs to watch:
- view→start and start→success per tab
- first-purchase conversion (the starter pack is the target)
- pass attach rate and level-30 completion
- collection completion
- refund rate

## 8. Priority (impact × effort)

| # | Lever | Impact | Effort | Status |
|---|---|---|---|---|
| 1 | Starter pack | High (first conversion) | S | ✅ sim |
| 2 | Weekly featured + rotation | High | S | ✅ sim |
| 3 | Season pass | High (recurring) | M | ✅ skeleton |
| 4 | Legendary/Ultimate lines + chromas | High ARPPU | L (art) | ✅ 3 full lines + 2 epic lines |
| 5 | Account storage + char slots >10 | Medium, evergreen | S | storage ✅ / slots: recommended |
| 6 | Exclusives / Founder / retired | Medium revenue, high retention | M | ✅ |
| 7 | Emotes, recalls, weapon skins, pets | Medium | M | ✅ slots + starter items |
| 8 | Gifting | Medium (holiday spikes) | M | recommended |
| 9 | Housing / banners / prestige skins | Medium, long-term | L | recommended (prestige = earn via pass level 30 repeat) |
| 10 | Premium currency | Required for live | M | recommended |
