// NPCs that remember you (docs/NPC_MEMORY.md). Per-character memory log for key NPCs, stored in the character save (save.npcmem).
// The log is DATA. Everything mechanical (prices, trust, hostility, quest access, speech odds) comes from the bounded rules below,
// never from AI text. AI only ever sees enum facts from memFacts() and writes words.
import { CONTACTS } from './content/npcs';
import { traitsOf } from './traitstate';
import { TRAIT_BY_ID } from './traits';
import { ITEM_BY_ID, SLOTS } from './config';
import { humanityOfSave } from './altplay';

export type MemKind='talked_down'|'bribed'|'intimidated'|'deceived'|'empathized'|'betrayed'|'scammed'|'helped'|'killed_crew'|'cleared'|'contract_done'|'speech_failed'|'gift'|'witnessed_death'|'failed_job'|'met';
export const MEM_KINDS:MemKind[]=['talked_down','bribed','intimidated','deceived','empathized','betrayed','scammed','helped','killed_crew','cleared','contract_done','speech_failed','gift','witnessed_death','failed_job','met'];
export type NpcRole='fixer'|'vendor'|'guard'|'boss'|'speech'|'trader'|'technician'|'handler';
export interface NpcDef { id:string; name:string; role:NpcRole; faction:'HI'|'PS'|'MM'|'independent'; /** guards share a crew with their faction boss */ crew?:string }
export interface MemEntry { k:MemKind; npc:string; at:number; key?:string; /** humanity (0-100) and confirmed traits at the time: NPCs remember who you were */ hum:number; tr?:string|null }
export interface NpcMem { v:1; log:MemEntry[]; met:Record<string,number>; refs:Record<string,number> }

export const MEM_CFG={ maxLog:240, maxPerNpc:40, halfLifeDays:21, clamp:20,
  /** standing weight of each memory (positive = goodwill) */
  w:{ talked_down:1, bribed:1, intimidated:-2, deceived:-1, empathized:2, betrayed:-8, scammed:-5, helped:3, killed_crew:-3, cleared:1, contract_done:2, speech_failed:-1, gift:2, witnessed_death:0, failed_job:-2, met:0 } as Record<MemKind,number>,
  trust:{ trusted:8, friendly:3, wary:-3, hostile:-8 },
  /** price multiplier bounds: goodwill can save at most 10%, bad blood costs at most 15% */ price:{ per:.01, min:.90, max:1.15 },
  /** speech odds bonus from history, per intent, clamped to +-maxMod */ maxMod:.15 };

const FAC_BOSS:Record<string,string>={ HI:'ten_hallowell', PS:'noor_abiodun', MM:'handler_cole' };
export const NPCS:NpcDef[]=[
  ...CONTACTS.map(c=>({ id:c.id, name:c.name, role:(c.id==='odalys_vane'?'fixer':Object.values(FAC_BOSS).includes(c.id)?'boss':c.role) as NpcRole, faction:c.faction as any })),
  { id:'vendor_rustline', name:'Pike', role:'vendor', faction:'independent' },
  { id:'vendor_harrow', name:'Greaves', role:'vendor', faction:'HI' },
  { id:'guard_HI', name:'Harrow-Brandt security', role:'guard', faction:'HI', crew:'ten_hallowell' },
  { id:'guard_PS', name:'Aldane ward staff', role:'guard', faction:'PS', crew:'noor_abiodun' },
  { id:'guard_MM', name:'Kestrel floor crew', role:'guard', faction:'MM', crew:'handler_cole' },
];
export const NPC_BY_ID:Record<string,NpcDef>=Object.fromEntries(NPCS.map(n=>[n.id,n]));
export const NPC_IDS=NPCS.map(n=>n.id);

// ---------- humanity (provider so the hacking/speech/humanity module can plug in its exact formula) ----------
const HR:Record<string,number>={ grey:0, green:1, blue:2, purple:5, orange:9 };
const HS:Record<string,number>={ brain:1.6, torso:1.4, face:1.3, armL:1.1, armR:1.1, handL:.9, handR:.9, legL:.9, legR:.9, footL:.5, footR:.5 };
function fallbackHumanity(s:any):number{ if(typeof s?.humanity==='number') return Math.max(0,Math.min(100,s.humanity)); let cost=0;
  for(const sl of SLOTS){ const u=s?.installed?.[sl]; const it=u&&s.items?.find((i:any)=>i.uid===u); const d:any=it&&ITEM_BY_ID[it.def]; if(!d) continue; cost+=typeof d.hum==='number'?d.hum:Math.round((HR[d.rarity]||0)*(HS[sl]||1)); }
  return Math.max(0,Math.min(100,100-cost)); }
let humProvider:(s:any)=>number=(s:any)=>typeof s?.humanity==='number'?s.humanity:humanityOfSave(s);
export const humanityOf=(s:any)=>{ const h=humProvider(s); return Number.isFinite(h)?Math.max(0,Math.min(100,h)):fallbackHumanity(s); };
export type HumBand='human'|'mixed'|'chrome'|'psycho';
export const humBand=(h:number):HumBand=>h>=70?'human':h>=35?'mixed':h>=15?'chrome':'psycho';

// ---------- log ----------
export const memOf=(s:any):NpcMem=>{ if(!s.npcmem||s.npcmem.v!==1) s.npcmem={ v:1, log:[], met:{}, refs:{} }; const m=s.npcmem; m.log=Array.isArray(m.log)?m.log:[]; m.met=m.met||{}; m.refs=m.refs||{}; return m; };
/** Record one notable interaction. Unknown NPCs / kinds are ignored (a tampered or old save can't inject new ones). Guards also tell their faction boss. */
export function remember(s:any,npc:string,k:MemKind,key?:string,now=Date.now()):MemEntry|null{ if(!NPC_BY_ID[npc]||!MEM_KINDS.includes(k)) return null; const m=memOf(s);
  const e:MemEntry={ k, npc, at:now, hum:Math.round(humanityOf(s)), tr:traitsOf(s).l10?.id||null }; if(key) e.key=String(key).slice(0,32);
  if(k==='met'){ if(!m.met[npc]) m.met[npc]=now; return e; } if(!m.met[npc]) m.met[npc]=now;
  m.log.push(e); const crew=NPC_BY_ID[npc].crew; if(crew&&k==='betrayed') m.log.push({ ...e, npc:crew });
  trim(m); return e; }
function trim(m:NpcMem){ const per:Record<string,number>={}; const keep:MemEntry[]=[]; for(let i=m.log.length-1;i>=0;i--){ const e=m.log[i]; per[e.npc]=(per[e.npc]||0)+1; if(per[e.npc]<=MEM_CFG.maxPerNpc&&keep.length<MEM_CFG.maxLog) keep.push(e); } m.log=keep.reverse(); }
export const memFor=(s:any,npc:string)=>memOf(s).log.filter(e=>e.npc===npc&&NPC_BY_ID[e.npc]&&MEM_KINDS.includes(e.k));

// ---------- rules (bounded, tested) ----------
const decay=(at:number,now:number)=>Math.pow(.5,Math.max(0,now-at)/(MEM_CFG.halfLifeDays*864e5));
/** Goodwill score in [-clamp, clamp]. */
export function standing(s:any,npc:string,now=Date.now()):number{ let v=0; for(const e of memFor(s,npc)) v+=(MEM_CFG.w[e.k]||0)*decay(e.at,now); const c=MEM_CFG.clamp; return Math.round(Math.max(-c,Math.min(c,v))*100)/100; }
export type Trust='trusted'|'friendly'|'neutral'|'wary'|'hostile';
export function trust(s:any,npc:string,now=Date.now()):Trust{ const v=standing(s,npc,now), T=MEM_CFG.trust; return v>=T.trusted?'trusted':v>=T.friendly?'friendly':v<=T.hostile?'hostile':v<=T.wary?'wary':'neutral'; }
/** Vendor/fixer price multiplier from memory alone, in [0.90, 1.15]. Combined multiplicatively with rep discounts by the caller. */
export function priceMul(s:any,npc:string,now=Date.now()):number{ const P=MEM_CFG.price; return Math.round(Math.max(P.min,Math.min(P.max,1-standing(s,npc,now)*P.per))*1000)/1000; }
/** Guards / crews that remember a betrayal or a massacre start hostile: talk options get harder and they open fire. Fighting is always possible, so this is never a block. */
export const hostile=(s:any,npc:string,now=Date.now())=>trust(s,npc,now)==='hostile';
/** Quest access: personal contracts from an NPC need them not hostile; 'trusted' unlocks the premium slot. */
export function questAccess(s:any,npc:string,now=Date.now()):{ offers:boolean; premium:boolean }{ const t=trust(s,npc,now); return { offers:t!=='hostile', premium:t==='trusted' }; }
export type Intent='persuade'|'intimidate'|'bribe'|'deceive'|'empathize';
/** Speech odds modifier from shared history: people you scared stay scared; people you lied to stop believing you. */
export function memSpeechMod(s:any,npc:string,intent:Intent,now=Date.now()):number{ const L=memFor(s,npc); const n=(k:MemKind)=>L.filter(e=>e.k===k).reduce((a,e)=>a+decay(e.at,now),0); let v=standing(s,npc,now)*.006;
  if(intent==='intimidate') v+=n('intimidated')*.05-n('empathized')*.02; if(intent==='deceive') v-=(n('deceived')+n('scammed'))*.06+n('betrayed')*.1; if(intent==='bribe') v+=n('bribed')*.03; if(intent==='empathize'||intent==='persuade') v+=n('empathized')*.03-n('betrayed')*.08;
  const c=MEM_CFG.maxMod; return Math.round(Math.max(-c,Math.min(c,v))*1000)/1000; }

// ---------- references (deterministic canned lines; the AI path gets memFacts()) ----------
const SALIENCE:Record<MemKind,number>={ betrayed:9, scammed:8, killed_crew:7, intimidated:6, talked_down:5, bribed:5, deceived:5, empathized:5, helped:4, contract_done:3, cleared:2, speech_failed:2, gift:3, witnessed_death:6, failed_job:5, met:0 };
const LINES:Record<MemKind,string[]>={
  talked_down:['You talked me out of a bad idea last time. Do not make it a habit.','Last time you talked your way past me. I remember the words, not the face.'],
  bribed:['Your credits spent fine last time. Same rate?','You paid last time. People who pay get remembered.'],
  intimidated:['Last time you made it clear what happens if I say no. I heard you.','I still remember how you said it last time. Go ahead.'],
  deceived:['Your story last time did not hold up. Try the truth.','I checked what you told me. It was not true.'],
  empathized:['You listened last time. Not many do.','You were straight with me last time. I have not forgotten.'],
  betrayed:['You sold us out. Everyone on this floor knows your face.','After what you did, I am only talking because you are armed.'],
  scammed:['You scammed me once. The price went up for you.','I remember the last deal. Pay first this time.'],
  helped:['You came through for me. That counts here.','You helped when it mattered. Ask.'],
  killed_crew:['You put my crew in the ground. Say your piece fast.','My people did not come home after your last visit.'],
  cleared:['Heard you cleared {key}. Word gets around.','{key} went quiet after you walked in. People noticed.'],
  contract_done:['You finished the job clean. I have more like it.','Last contract closed on time. That is rare.'],
  speech_failed:['Last time you tried to talk, it ended in a fight. Try better words.','You are the one who could not talk your way out last time.'],
  gift:['You brought something last time. I noticed.','Thanks for the gift. It did not go unnoticed.'],
  witnessed_death:['I watched you go down in {key}. Glad it did not stick.','Last I saw you, they were dragging you out of {key}.'],
  failed_job:['You walked away from the {key} job. I had to cover it.','{key} is still unfinished. Your name is on it.'],
  met:['We have met. Make it quick.'] };
const HUM_LINES:Record<HumBand,string>={ human:'Still mostly you under there. People can tell.', mixed:'', chrome:'More metal every time you come by.', psycho:'There is less of you each visit. People are starting to step back.' };
const pick=<T>(a:T[],n:number)=>a[Math.abs(n)%a.length];
export interface MemRef { kind:MemKind|'humanity'|'trait'|'first'; text:string }
/** The most salient memory this NPC has of you, as a ready line. Deterministic for a given log (no RNG), so it's testable. */
export function memLine(s:any,npc:string,keyName:(k:string)=>string=(k)=>k,now=Date.now()):MemRef{ const L=memFor(s,npc); const m=memOf(s);
  if(!L.length){ const h=humBand(humanityOf(s)); if(m.met[npc]&&HUM_LINES[h]) return { kind:'humanity', text:HUM_LINES[h] }; return { kind:'first', text:'First time I see you. Keep it simple.' }; }
  let best=L[L.length-1], bs=-1; for(const e of L){ const sc=SALIENCE[e.k]*decay(e.at,now)+(e.at/1e13); if(sc>bs){ bs=sc; best=e; } }
  const t=pick(LINES[best.k],L.length).replace('{key}',best.key?keyName(best.key):'that place');
  const before=best.hum, nowH=humanityOf(s); if(before-nowH>=20) return { kind:best.k, text:t+' And you have more chrome than last time.' };
  return { kind:best.k, text:t }; }
/** Enum-only facts for the AI writer (no free text ever leaves the client from the log). */
export function memFacts(s:any,npc:string,now=Date.now()):{ trust:Trust; kinds:MemKind[]; band:HumBand; trait:string|null }{ const L=memFor(s,npc); const kinds:MemKind[]=[]; for(let i=L.length-1;i>=0&&kinds.length<6;i--) if(!kinds.includes(L[i].k)) kinds.push(L[i].k);
  const tr=traitsOf(s).l10?.id||null; return { trust:trust(s,npc,now), kinds, band:humBand(humanityOf(s)), trait:tr&&TRAIT_BY_ID[tr]?tr:null }; }
/** Hook for a dungeon clear: the fixer who sells that dungeon hears about it; the faction boss counts the crew you put down. */
export function memOnClear(s:any,dungeon:{ id:string; fixer?:string; mfr?:string },now=Date.now()){ remember(s,'odalys_vane','cleared',dungeon.id,now); if(dungeon.fixer&&dungeon.fixer!=='odalys_vane'&&NPC_BY_ID[dungeon.fixer]) remember(s,dungeon.fixer,'cleared',dungeon.id,now);
  const g='guard_'+(dungeon.mfr||''); if(NPC_BY_ID[g]) remember(s,g,'killed_crew',dungeon.id,now); }

// ---------- gifts / deaths / failures (rules only) ----------
export const GIFT_CFG={ base:40, perLevel:8, perDay:1 };
export const giftCost=(s:any)=>GIFT_CFG.base+GIFT_CFG.perLevel*Math.max(1,s.level||1);
/** Give a gift: costs credits by formula, once per NPC per day. Returns why not, or null on success. */
export function giveGift(s:any,npc:string,now=Date.now()):string|null{ if(!NPC_BY_ID[npc]) return 'unknown'; const day=new Date(now).toDateString(); const m=memOf(s) as any; m.gifts=m.gifts&&typeof m.gifts==='object'?m.gifts:{};
  if(m.gifts[npc]===day) return 'Already gave a gift today.'; const c=giftCost(s); if((s.credits||0)<c) return 'Not enough credits.'; s.credits-=c; m.gifts[npc]=day; remember(s,npc,'gift',undefined,now); return null; }
/** You went down in a dungeon: its fixer hears about it (once per run, keyed by dungeon). */
export function memOnDown(s:any,dungeon:{ id:string; fixer?:string },runId:string,now=Date.now()){ const m=memOf(s) as any; if(m.lastDown===runId) return; m.lastDown=runId; const f=dungeon.fixer&&NPC_BY_ID[dungeon.fixer]?dungeon.fixer:'odalys_vane'; remember(s,f,'witnessed_death',dungeon.id,now); }
/** Dungeon speech node outcome: that faction's crew remembers how you talked. */
const SPEECH_KIND:Record<string,MemKind>={ persuade:'talked_down', standdown:'talked_down', bribe:'bribed', intimidate:'intimidated', flee:'intimidated', deceive:'deceived', empathize:'empathized' };
export function memOnSpeech(s:any,mfr:string|undefined,how:string,ok:boolean,now=Date.now()){ const g='guard_'+(mfr||''); if(!NPC_BY_ID[g]) return; remember(s,g,ok?(SPEECH_KIND[how]||'talked_down'):'speech_failed',undefined,now); }
/** Haggle discount from a successful talk today (bounded 8%), on top of memory pricing. Lives here so the shop needn't load the talk UI. */
export function vendorMul(s:any,npc:string):number{ const day=new Date().toDateString(); const hg=s.haggle?.day===day&&s.haggle.npc===npc&&s.haggle.ok?.92:1; return Math.round(priceMul(s,npc)*hg*1000)/1000; }
