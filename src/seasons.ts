// Seasons + the permanent retirement registry (docs/LOOT_ECONOMY.md, "Seasonal drops").
// A season is a dated window. Its exclusive drops (gear + cosmetics) roll only while the window is open and are retired forever
// the moment it closes: retirement is derived from the dates, so nothing has to remember to flip a flag, and a retired id can never
// come back (tests/loot_economy.mjs + the shared retirement check). Store exclusives (monetization job) register here too via RETIRE_EXTRA.
export interface SeasonDef { id:string; n:number; name:string; short:string; start:string; end:string; gear:string[]; cosmetics:string[]; blurb:string; }
export const SEASONS:SeasonDef[]=[
  { id:'s1', n:1, name:'Season 1: Static Bloom', short:'Season 1', start:'2026-10-01T00:00:00Z', end:'2027-01-05T00:00:00Z',
    gear:['s1_bloom_veil','s1_prism_lancer','s1_quiet_halo'], cosmetics:['aura_s1_bloom','back_s1_halo'],
    blurb:'A signal storm over the Basin. What it leaves behind is gone when the static clears.' },
];
export const SEASON_BY_ID:Record<string,SeasonDef>=Object.fromEntries(SEASONS.map(s=>[s.id,s]));
/** item or cosmetic id -> its season */
export const SEASON_OF:Record<string,string>=Object.fromEntries(SEASONS.flatMap(s=>[...s.gear,...s.cosmetics].map(id=>[id,s.id])));
const ms=(iso:string)=>Date.parse(iso);
export const seasonOpen=(s:SeasonDef,now:number)=>now>=ms(s.start)&&now<ms(s.end);
export function activeSeason(now:number=Date.now()):SeasonDef|null{ return SEASONS.find(s=>seasonOpen(s,now))||null; }
/** Extra retirements outside the season system (one-time store/event exclusives): id -> ISO retirement time. Append only. */
export const RETIRE_EXTRA:Record<string,string>={};
/** When an id retires (ms), or null if it never does. */
export function retiresAt(id:string):number|null{ const s=SEASON_OF[id]; if(s) return ms(SEASON_BY_ID[s].end); const x=RETIRE_EXTRA[id]; return x?ms(x):null; }
export function isRetired(id:string,now:number=Date.now()):boolean{ const t=retiresAt(id); return t!==null&&now>=t; }
/** May this exclusive be granted right now? Seasonal ids only inside their window; anything retired: never. */
export function canGrant(id:string,now:number=Date.now()):boolean{ if(isRetired(id,now)) return false; const s=SEASON_OF[id]; return !s||seasonOpen(SEASON_BY_ID[s],now); }
/** Provenance shown on the item and to other players: "Season 1 · Retired" / "Season 1 · Limited". */
export function provenanceLabel(id:string,now:number=Date.now()):string|null{ const s=SEASON_OF[id]; if(!s) return null; const d=SEASON_BY_ID[s]; return d.short+' · '+(isRetired(id,now)?'Retired':'Limited'); }
export function provenanceTip(id:string,at?:number,now:number=Date.now()):string|null{ const s=SEASON_OF[id]; if(!s) return null; const d=SEASON_BY_ID[s]; const day=(t:number)=>new Date(t).toISOString().slice(0,10);
  return d.name+'. '+(at?'Acquired '+day(at)+'. ':'')+(isRetired(id,now)?'Retired '+day(ms(d.end))+': can never drop again.':'Drops until '+day(ms(d.end))+', then retired for good.'); }
