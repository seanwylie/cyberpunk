// Hardware vendor buy prices by rarity (Outfitter). Rarities missing here are not sold. Harrow Reach also sells purple.
// Shared by the UI and tools/gen_catalog.mjs (store availability in docs/CATALOG.md).
export const VENDOR_BUY:Record<string,number>={ grey:15, green:60, blue:300 };
export const VENDOR_BUY_HARROW:Record<string,number>={ grey:15, green:60, blue:300, purple:1600 };
