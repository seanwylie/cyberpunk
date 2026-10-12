// Alternative gameplay framework (docs/ALT_GAMEPLAY.md, docs/HUMANITY.md).
// One pattern for every non-combat style (hack, speech; later stealth, drones, bribe...):
//   STYLE  -> tierOf(ctx) 0..3 from explicit sources (hardware caps, abilities, traits, reputation)
//   NODE   -> something in the world with a minimum tier, a reward and a ALWAYS-PRESENT non-style fallback
//   T0     -> anyone can try (hack: timing mini-game; speech: choices with the odds shown). Failure costs (alarm / fight), never a lock.
//   TEACH  -> first exposure shows one prompt once (save.alt.seen[style]), then it is just an option.
// Outcomes are pure functions here so tests can drive them without a browser; sim.ts only applies them.
import { ITEM_BY_ID, SLOTS, type ItemDef, type Rarity, type Slot } from './config';
import { TRAIT_BY_ID, abilityFamilies } from './traits';

export type Style='hack'|'speech';
export interface Ctx { caps:Set<string>; abilities:string[]; traits:{ l10?:string|null; l20?:string|null }; rep?:Record<string,number>; mfr?:string; humanity:number; credits?:number }
export const ALT_CFG={
  hack:{ failCd:4, alarmN:3 },
  speech:{ repTier:40, bribe:[60,120,220,400] as number[] },
  minigame:{ speed:1.15, zone:[.2,.16,.12,.1] as number[] },
};
export const STYLE_META:Record<Style,{ name:string; icon:string; family:'hack'|'social'; fallback:string }>={
  hack:{ name:'Hack', icon:'⌁', family:'hack', fallback:'Or fight: kill the lock elite, or take the keycard it drops.' },
  speech:{ name:'Talk', icon:'❝', family:'social', fallback:'Or fight: every talk can turn into a fight.' },
};

// ---------------- humanity ----------------
/** cost by rarity (base) x how invasive the slot is. Orange heavy body mods cost the most. */
export const HUM_RARITY:Record<Rarity,number>={ grey:0, green:1, blue:2, purple:5, orange:9 };
export const HUM_SLOT:Record<Slot,number>={ brain:1.6, torso:1.4, face:1.3, armL:1.1, armR:1.1, handL:.9, handR:.9, legL:.9, legR:.9, footL:.5, footR:.5 };
export function humanityCost(d:ItemDef|undefined):number{ if(!d) return 0; if(typeof d.hum==='number') return d.hum; const base=HUM_RARITY[d.rarity]*HUM_SLOT[d.slot];
  const extra=(d.weapon?1:0)+(d.caps||[]).filter(c=>c!=='speech').length+(d.abilities?.length||0)*.5-((d.caps||[]).includes('speech')?1:0); return Math.max(0,Math.round(base+extra)); }
export const humanityOfDefs=(defs:(ItemDef|undefined)[])=>Math.max(0,Math.min(100,100-defs.reduce((a,d)=>a+humanityCost(d),0)));
export function humanityOfSave(s:any):number{ return humanityOfDefs(SLOTS.map(sl=>{ const u=s.installed?.[sl]; const it=u&&s.items?.find((i:any)=>i.uid===u); return it?ITEM_BY_ID[it.def]:undefined; })); }
export type Band='human'|'mixed'|'chrome'|'psycho';
export const band=(h:number):Band=>h>=70?'human':h>=35?'mixed':h>=15?'chrome':'psycho';
export const BAND_LABEL:Record<Band,string>={ human:'Human', mixed:'Mixed', chrome:'Chromed', psycho:'Cyberpsycho' };
/** humanity -> speech odds modifier: high helps persuade/charm, low helps intimidate */
export const persuadeMod=(h:number)=>(h-50)/250;
export const intimidateMod=(h:number)=>(50-h)/250;
/** vendor price multiplier and refusal. Refusal only for optional vendors in high-humanity districts; never the critical path. */
export function vendorTerms(h:number,district?:string):{ mul:number; refuse:boolean; line:string }{ const b=band(h); const posh=district==='aldane_spire';
  if(b==='human') return { mul:.92, refuse:false, line:'Good to see a face.' };
  if(b==='mixed') return { mul:1, refuse:false, line:'' };
  if(b==='chrome') return { mul:posh?1.15:1.06, refuse:false, line:'Keep the hands where I can see them.' };
  return { mul:1.15, refuse:posh, line:posh?'We do not serve your kind here.':'Cash first. Then we talk.' }; }
/** dark bonus: below 35 humanity, up to +8% damage ("cyberpsycho") */
export const psychoDmg=(h:number)=>h<35?(35-h)/35*.08:0;
/** telegraphed loss-of-control at very low humanity: a 1s warning, then 1.2s of auto-attacking the nearest target. Never while a dialog or mini-game is open. */
export const PSYCHO={ below:10, everyS:45, warnS:1, lossS:1.2 };
export function humanityDelta(cur:ItemDef|undefined,next:ItemDef|undefined,h:number):{ d:number; text:string }{ const d=humanityCost(cur)-humanityCost(next); if(!d) return { d, text:'' };
  const nb=band(Math.max(0,Math.min(100,h+d))); const why=d<0?(nb==='psycho'?'cyberpsycho risk':nb==='chrome'?'persuasion down, intimidate up':'persuasion odds down'):'persuasion odds up';
  return { d, text:(d>0?'+':'−')+Math.abs(d)+' Humanity: '+why }; }

// ---------------- tiers ----------------
const fams=(id?:string|null)=>id?TRAIT_BY_ID[id]?.fams||[]:[];
const effSum=(c:Ctx,t:string)=>[c.traits.l10,c.traits.l20].reduce((a,id)=>a+(id?TRAIT_BY_ID[id]?.effects.filter(e=>e.t===t).reduce((x,e)=>x+e.v,0)||0:0),0);
export function tierOf(style:Style,c:Ctx):0|1|2|3{ let n=0;
  if(style==='hack'){ if(c.caps.has('hack')) n++; if(c.abilities.some(a=>(abilityFamilies(a).hack||0)>=.5)) n++; if(fams(c.traits.l10).includes('hack')) n++; if(fams(c.traits.l20).includes('hack')) n++; }
  else { if(c.caps.has('speech')) n++; if(c.rep&&c.mfr&&(c.rep[c.mfr]||0)>=ALT_CFG.speech.repTier) n++; n+=Math.round(effSum(c,'speechTier')); if(fams(c.traits.l10).includes('social')&&!effSum(c,'speechTier')) n++; }
  return Math.max(0,Math.min(3,n)) as 0|1|2|3; }
export function tierSources(style:Style):string{ return style==='hack'?'hack augment or chip, a hacking ability, a hacker trait':'speech augment, faction rep, a Face trait'; }

// ---------------- nodes ----------------
export type Payoff='shortcut'|'lights'|'turret'|'cache'|'shield'|'standdown'|'switch'|'bribe'|'flee'|'sitout'|'discount';
export interface NodeDef { payoff:Payoff; style:Style; min:0|1|2|3; label:string; reward:string }
export const NODES:Record<Payoff,NodeDef>={
  shortcut:{ payoff:'shortcut', style:'hack', min:0, label:'Hack relay', reward:'Opens the lock' },
  lights:  { payoff:'lights', style:'hack', min:3, label:'Kill lights', reward:'Enemies see less' },
  turret:  { payoff:'turret', style:'hack', min:1, label:'Hack turret', reward:'Turret fights for you' },
  cache:   { payoff:'cache', style:'hack', min:1, label:'Crack cache', reward:'Bonus chip' },
  shield:  { payoff:'shield', style:'hack', min:2, label:'Hack shield', reward:'Boss shield down' },
  standdown:{ payoff:'standdown', style:'speech', min:0, label:'Talk down', reward:'Guard stands down' },
  switch:  { payoff:'switch', style:'speech', min:1, label:'Turn guard', reward:'Guard joins you' },
  bribe:   { payoff:'bribe', style:'speech', min:0, label:'Bribe', reward:'Pay to pass' },
  flee:    { payoff:'flee', style:'speech', min:0, label:'Intimidate', reward:'Pack flees' },
  sitout:  { payoff:'sitout', style:'speech', min:3, label:'Sit it out', reward:'Skips a boss phase' },
  discount:{ payoff:'discount', style:'speech', min:1, label:'Haggle', reward:'Vendor discount' },
};
/** tooltip: requirement, your tier, reward. No hidden rules. */
export function tooltip(p:Payoff,tier:number):string{ const n=NODES[p]; return `${STYLE_META[n.style].name} T${n.min}+ · You T${tier} · ${n.reward}`; }
export const canUse=(p:Payoff,tier:number)=>tier>=NODES[p].min;

// ---------------- T0 hack mini-game (timing) ----------------
export interface Mini { start:number; w:number; speed:number; seed:number }
export function miniFor(tier:number,seed:number):Mini{ const r=((seed*9301+49297)%233280)/233280; const w=ALT_CFG.minigame.zone[0]+tier*.06; return { start:.15+r*(.85-w-.15), w, speed:ALT_CFG.minigame.speed, seed }; }
/** cursor position (0..1, ping-pong) after t seconds */
export const cursorAt=(m:Mini,t:number)=>{ const x=(t*m.speed)%2; return x<=1?x:2-x; };
export const miniHit=(m:Mini,pos:number)=>pos>=m.start&&pos<=m.start+m.w;

// ---------------- speech ----------------
export interface SpeechOpt { payoff:Payoff; label:string; chance:number; cost?:number; ok:boolean; why?:string }
/** options for a guard/elite encounter, odds shown up front. Humanity reshapes them: high opens persuade/turn, low pushes intimidate and opens Terrify. */
export function speechOptions(c:Ctx,opts:{ elite?:boolean; boss?:boolean; level?:number }={}):SpeechOpt[]{ const t=tierOf('speech',c); const h=c.humanity; const b=band(h); const bonus=effSum(c,'speechOdds')+t*.1;
  const cl=(x:number)=>Math.round(Math.max(.05,Math.min(.95,x))*100)/100; const out:SpeechOpt[]=[];
  if(opts.boss){ out.push({ payoff:'sitout', label:'Ask the lieutenant to sit out', chance:cl(.45+bonus+persuadeMod(h)), ok:canUse('sitout',t), why:canUse('sitout',t)?undefined:'Needs Talk T3' }); return out; }
  if(b!=='psycho') out.push({ payoff:'standdown', label:'Talk them down', chance:cl((opts.elite?.3:.45)+bonus+persuadeMod(h)), ok:b!=='chrome'||t>=1, why:b==='chrome'&&t<1?'Too much chrome to be trusted':undefined });
  if(h>=50) out.push({ payoff:'switch', label:'Persuade: switch sides', chance:cl((opts.elite?.35:.5)+bonus+persuadeMod(h)), ok:canUse('switch',t), why:canUse('switch',t)?undefined:'Needs Talk T1' });
  const cost=ALT_CFG.speech.bribe[Math.min(3,Math.floor((opts.level||1)/10))]*(opts.elite?2:1)*vendorTerms(h).mul; const can=(c.credits??0)>=cost;
  out.push({ payoff:'bribe', label:`Bribe (${Math.round(cost)}c)`, chance:1, cost:Math.round(cost), ok:can, why:can?undefined:'Not enough credits' });
  out.push({ payoff:'flee', label:h<25||t>=2?'Terrify the pack':'Intimidate', chance:cl(.35+t*.08+intimidateMod(h)+(h<25?.15:0)), ok:true });
  return out; }
/** deterministic roll helper: r in [0,1) */
export const rollOk=(chance:number,r:number)=>r<chance;

// ---------------- onboarding + fixer hints ----------------
export const TEACH:Record<Style,{ title:string; body:string }>={
  hack:{ title:'Hack', body:'Press F, then stop the bar in the zone. Miss and an alarm sounds. You can always try again, or fight.' },
  speech:{ title:'Talk', body:'Pick a line. The odds are shown. If it fails, it is a fight, same as before.' },
};
export function altState(s:any){ const a=s.alt??={}; a.seen??={}; a.n??={ hack:0, speech:0 }; a.fails??={ hack:0, speech:0 }; a.hinted??={}; return a; }
/** returns true exactly once per style per save */
export function firstSeen(s:any,style:Style):boolean{ const a=altState(s); if(a.seen[style]) return false; a.seen[style]=Date.now(); return true; }
export const FIXER_HINTS:{ id:string; when:(a:any,h:number)=>boolean; line:string }[]=[
  { id:'hack1', when:a=>a.n.hack>=3, line:'Odalys: "You keep talking to machines. Get a deck and they will talk back."' },
  { id:'speech1', when:a=>a.n.speech>=3, line:'Odalys: "Half my jobs end in a talk. Yours too, lately."' },
  { id:'hum_hi', when:(a,h)=>h>=85&&a.n.speech>=1, line:'Odalys: "Still all you under there. People can tell."' },
  { id:'hum_lo', when:(a,h)=>h<25, line:'Odalys: "Less of you every visit. Some doors shut for that."' },
];
export function nextHint(s:any,h:number):string|null{ const a=altState(s); for(const x of FIXER_HINTS){ if(!a.hinted[x.id]&&x.when(a,h)){ a.hinted[x.id]=Date.now(); return x.line; } } return null; }
