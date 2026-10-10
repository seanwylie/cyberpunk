# Chip / body-part compatibility

The design docs define socket capacity per body part (hand 2, torso 8; the rest are placeholders) and give example chip plans, but do not define which chips fit which parts. This is the prototype mapping. Numbers are placeholders, not approved balance.

Every chip declares the body-part groups it fits (`CHIP_FITS` in `src/config.ts`). `chipFits(chip, slot)` is the single check.

| Group | Sockets | Theme | Chips |
|---|---|---|---|
| Hands (L/R) | 2 | damage, attack speed, attack pattern | speed, fineedge, power, overdrive, cutwide, bladepat |
| Arms (L/R) | 3 | damage, attack speed, attack pattern | speed, fineedge, power, overdrive, cutwide, bladepat |
| Legs (L/R) | 3 | durability, movement | sustain, ablative, plating, stride, servo |
| Feet (L/R) | 1 | movement, pickup | stride, servo, magnet |
| Torso | 8 | HP, armor, regen, cooling, cloak | coolant, quench, sustain, ablative, plating, cloakdur |
| Face | 2 | pickup, control, cloak | magnet, cloakdur, ctrldur, gridlink |
| Brain | 4 | cooling, control | coolant, quench, ctrldur, gridlink |

Parity: every chip fits at least two groups, every group has at least two chip options, and the spec's example plans (hand: speed + cut/blade pattern; torso: cooling, sustain, cloak; brain: control uptime + cooling) are all legal. New chips `stride` (+6% move, green) and `servo` (+10% move, +1 armor, blue) were added so legs and feet have movement options. The game has no dodge or crit stat, so those chip themes are not implemented.

## Enforcement
- The locker only lists chips that fit the selected part; "Show all" dims the rest with the reason in the tooltip.
- `socketChip` and `applyDraft` (UI) reject incompatible chips, and `computeBuild` ignores any incompatible chip on a part.
- Saves are migrated on load (`sanitizeChips`): incompatible socketed chips go back to locker stock, with a toast.
