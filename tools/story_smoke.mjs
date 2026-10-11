// Real smoke call: checks OPENAI_API_KEY works end-to-end through the same service code the proxy uses. Prints ONLY generated text.
import { createStoryService, CATALOG } from '../server/story_beat.mjs';
const pick = (mfr, n) => Object.entries(CATALOG.items).filter(([, v]) => v.mfr === mfr).slice(-n).map(([k]) => k);
const first = (o, n = 1) => Object.keys(o).slice(0, n);
const samples = {
  heavy: { trigger: 'contract_done', town: 'rustline', level: 12, contract: 'od_floor_sweep', installed: pick('HI', 4), chips: first(CATALOG.chips), abilities: first(CATALOG.abilities), cosmetics: first(CATALOG.cosmetics), rep: { HI: 40, PS: 0, MM: 5 } },
  surgical: { trigger: 'return_town', town: 'harrow', level: 24, dungeon: Object.keys(CATALOG.dungeons)[1], installed: pick('PS', 5), chips: first(CATALOG.chips, 2), abilities: first(CATALOG.abilities, 2), cosmetics: first(CATALOG.cosmetics, 2), rep: { HI: -10, PS: 60, MM: 0 } },
  kestrel: { trigger: 'new_mfr_set', town: 'rustline', level: 6, newMfr: 'MM', installed: pick('MM', 4), chips: [], abilities: [], cosmetics: [], rep: { HI: 0, PS: 0, MM: 25 } },
};
if (!process.env.OPENAI_API_KEY) { console.error('OPENAI_API_KEY is not set'); process.exit(2); }
const svc = createStoryService(); let bad = 0; let i = 0;
for (const [k, s] of Object.entries(samples)) { const r = await svc.handle({ ...s, session: 'abcdef0123456789' }, { ip: 'smoke' }); if (r.json.ok) console.log(`[${k}] ${r.json.text}\n`); else { bad++; console.log(`[${k}] FAILED: ${r.json.reason}\n`); } }
process.exit(bad ? 1 : 0);
