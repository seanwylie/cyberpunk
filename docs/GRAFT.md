# Field grafts

The moment-to-moment hook: rip a part off a fresh kill and wire it in mid-fight (`src/graft.ts`).

- **Drop:** every elite (and affixed mob) drops a part; ordinary mobs 6%. Bosses drop one too (carries into the rest of the run). Static turrets never.
- **On the floor 7 s**, blinking in the last 1.5 s. Matte part in the manufacturer colour, torn flesh end, oil stain, bone-white outline ring. No glow.
- **Graft:** F, the Interact button (mobile), or tap the part. A fresh part outranks every other prompt while it lasts. Tooltip names the part, the source enemy, the effect and the humanity cost.
- **One graft at a time**, a new one replaces it. Lasts 40 s, strength decays linearly from 100% to 25%, then "GRAFT SPENT". A thin bar under the player shows time left.
- **Effects by manufacturer** (names come from the source enemy, e.g. Forklift Tine, Piston Fist, Ceramic Blades, Bone Saw, Scrap Ribcage):
  - Heavy Industrial: hits +40%, every 4th auto hit slams enemies within 1.8 tiles.
  - Precision Surgical: hits +25%, mend 3% of damage dealt.
  - Mass-Market: take 25% less damage, jams (no protection) for 1.2 s now and then.
- **Bosses stay deadly:** offensive bonus and mend are halved against bosses; Mass-Market protection is 60% as strong against boss hits.
- **Humanity:** −2 per graft for the current run, capped at −10, reset on town return. Applied in `altsim.humanity()`, so talk/persuade odds feel it.
- **Perf:** fixed pool of 3 floor parts (oldest recycled), no allocations per frame, draws culled off-screen.
- **Never paid:** earned in combat only; nothing in the store touches it.
- Test: `tests/graft.mjs` (drop, prompt/tooltip, damage, decay, cap, pool/expiry, idle player still dies to mobs, reset). `SHOTS=1 [TOUCH=1]` writes `shots/graft/`.
