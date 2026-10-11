// Regenerates server/story_catalog.json: the id -> name allowlist the story proxy validates against (so the client never sends free text).
// Run after adding items/chips/abilities/cosmetics/contracts/dungeons:  node tools/gen_story_ids.mjs
import { createServer } from 'vite'; import fs from 'node:fs';
const vs = await createServer({ configFile: false, server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const C = await vs.ssrLoadModule('/src/config.ts'), N = await vs.ssrLoadModule('/src/content/npcs.ts'), D = await vs.ssrLoadModule('/src/content/dungeons.ts'), A = await vs.ssrLoadModule('/src/content/appearance.ts');
// Short manufacturer prefixes (HB, AS, KV ...) are derived from the data: the 2-3 capital-letter first token shared by 3+ items of one manufacturer.
const firstTok = {}; for (const i of C.ITEMS) { const m = /^([A-Z]{2,3})(?:-\d+)?\s/.exec(i.name); if (m) { const k = i.mfr + ':' + m[1]; firstTok[k] = (firstTok[k] || 0) + 1; } }
const prefixes = {}; for (const [k, n] of Object.entries(firstTok)) if (n >= 3) { const [mfr, tok] = k.split(':'); prefixes[tok] = mfr; }
const stripName = (n) => { for (const t of Object.keys(prefixes)) { const r = new RegExp('^' + t + '(?:-\\d+)?\\s+'); if (r.test(n)) return n.replace(r, ''); } return n; };
const cat = {
  /** abbreviations the story output filter rejects: manufacturer codes plus the derived item-name prefixes */ codeTokens: [...Object.keys(C.MFR), ...Object.keys(prefixes)],
  mfr: Object.fromEntries(Object.entries(C.MFR).map(([k, v]) => [k, v.name])),
  items: Object.fromEntries(C.ITEMS.map(i => [i.id, { name: stripName(i.name), slot: i.slot, mfr: i.mfr, rarity: i.rarity }])),
  chips: Object.fromEntries(Object.values(C.CHIPS).map(c => [c.id, c.name])),
  abilities: Object.fromEntries(Object.entries(C.ABILITIES).map(([k, v]) => [k, v.name])),
  cosmetics: Object.fromEntries(A.COSMETICS.map(c => [c.id, c.name])),
  contacts: Object.fromEntries(N.CONTACTS.map(c => [c.id, { name: c.name, role: c.role, bio: c.bio }])),
  contracts: Object.fromEntries(Object.values(N.CONTRACT_BY_ID).map(k => [k.id, { title: k.title, contact: k.contact }])),
  dungeons: Object.fromEntries(D.DUNGEON_IDS.map(id => [id, D.DUNGEONS[id].name])),
};
for (const m of ['items', 'chips', 'abilities', 'cosmetics', 'contracts', 'dungeons']) console.log(m, Object.keys(cat[m]).length);
fs.writeFileSync(new URL('../server/story_catalog.json', import.meta.url), JSON.stringify(cat, null, 1) + '\n'); await vs.close();
