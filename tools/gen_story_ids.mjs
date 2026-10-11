// Regenerates server/story_catalog.json: the id -> name allowlist the story proxy validates against (so the client never sends free text).
// Run after adding items/chips/abilities/cosmetics/contracts/dungeons:  node tools/gen_story_ids.mjs
import { createServer } from 'vite'; import fs from 'node:fs';
const vs = await createServer({ configFile: false, server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const C = await vs.ssrLoadModule('/src/config.ts'), N = await vs.ssrLoadModule('/src/content/npcs.ts'), D = await vs.ssrLoadModule('/src/content/dungeons.ts'), A = await vs.ssrLoadModule('/src/content/appearance.ts');
const cat = {
  mfr: Object.fromEntries(Object.entries(C.MFR).map(([k, v]) => [k, v.name])),
  items: Object.fromEntries(C.ITEMS.map(i => [i.id, { name: i.name, slot: i.slot, mfr: i.mfr, rarity: i.rarity }])),
  chips: Object.fromEntries(Object.values(C.CHIPS).map(c => [c.id, c.name])),
  abilities: Object.fromEntries(Object.entries(C.ABILITIES).map(([k, v]) => [k, v.name])),
  cosmetics: Object.fromEntries(A.COSMETICS.map(c => [c.id, c.name])),
  contacts: Object.fromEntries(N.CONTACTS.map(c => [c.id, { name: c.name, role: c.role, bio: c.bio }])),
  contracts: Object.fromEntries(Object.values(N.CONTRACT_BY_ID).map(k => [k.id, { title: k.title, contact: k.contact }])),
  dungeons: Object.fromEntries(D.DUNGEON_IDS.map(id => [id, D.DUNGEONS[id].name])),
};
for (const m of ['items', 'chips', 'abilities', 'cosmetics', 'contracts', 'dungeons']) console.log(m, Object.keys(cat[m]).length);
fs.writeFileSync(new URL('../server/story_catalog.json', import.meta.url), JSON.stringify(cat, null, 1) + '\n'); await vs.close();
