// Real smoke call: checks OPENAI_API_KEY works end-to-end through the same service code the proxy uses. Prints ONLY generated text.
import { createStoryService } from '../server/story_beat.mjs';
const samples = {
  heavy: { trigger: 'contract_done', town: 'rustline', level: 12, contract: 'Annex Sweep', installed: [{ slot: 'armR', name: 'Slagbreaker Arm', mfr: 'HI', rarity: 'blue' }, { slot: 'torso', name: 'Ironclad Frame', mfr: 'HI', rarity: 'green' }], chips: ['Overdrive'], abilities: ['Shockwave'], cosmetics: ['Soot Hood'], rep: { HI: 40, PS: 0, MM: 5 } },
  surgical: { trigger: 'return_town', town: 'harrow', level: 24, installed: [{ slot: 'brain', name: 'Neural Warden Core', mfr: 'PS', rarity: 'purple' }, { slot: 'face', name: 'Ceramic Mask', mfr: 'PS', rarity: 'blue' }], chips: ['Grid-Link'], abilities: ['Ghost Protocol'], cosmetics: ['Sterile Halo'], rep: { HI: -10, PS: 60, MM: 0 } },
  kestrel: { trigger: 'new_mfr_set', town: 'rustline', level: 6, newMfr: 'MM', installed: [{ slot: 'torso', name: 'Value Chassis', mfr: 'MM', rarity: 'grey' }, { slot: 'legL', name: 'Refurb Leg', mfr: 'MM', rarity: 'green' }], chips: [], abilities: [], cosmetics: [], rep: { HI: 0, PS: 0, MM: 25 } },
};
if (!process.env.OPENAI_API_KEY) { console.error('OPENAI_API_KEY is not set'); process.exit(2); }
const svc = createStoryService(); let bad = 0;
for (const [k, s] of Object.entries(samples)) { const r = await svc.handle(s); if (r.json.ok) console.log(`[${k}] ${r.json.text}\n`); else { bad++; console.log(`[${k}] FAILED: ${r.json.reason}\n`); } }
process.exit(bad ? 1 : 0);
