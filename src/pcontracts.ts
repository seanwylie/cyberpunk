// Contracts written for you (docs/CONTRACTS.md). The fixer assembles personal jobs from TESTED pieces:
//   dungeon template x boss kit x objective type x modifiers x rewards.
// Rules generate and validate every combination; the AI (story Lambda, kind "contract_pick") may only choose among the valid candidates and
// write the title + briefing. Rewards are always recomputed here, so neither the model nor a tampered save can inflate them.
import { DUNGEONS, DUNGEON_LIST, unlockReason, type DungeonDef } from './content/dungeons';
import { KITS } from './content/boss_kits';
import { CONTRACT_BY_ID, type ContractDef, type Goal } from './content/npcs';
import { ENEMIES } from './config';
import { contractState, lockDay, todayStr } from './state';
import { hostsOf, isUnlocked } from './towns';
import { SEAL_MARGIN } from './discovery';
import { traitsOf } from './traitstate';
import { TRAIT_BY_ID } from './traits';
import { tier as facTier } from './factions';
import { humanityOf, humBand, questAccess, NPC_BY_ID, trust, memFor, remember } from './npcmem';

export type ObjType='clear'|'boss'|'cull'|'salvage'|'condition';
export type ModId='patron'|'premium'|'nemesis'|'face'|'chrome'|'rival'|'hacker'|'repeat'|'redeem';
export interface PContract extends ContractDef { personal:true; giver:string; tpl:string; boss:string; kit:string|null; obj:ObjType; mods:ModId[]; brief?:string; src:'rules'|'ai'; made:number; why:string[] }
export const PC_CFG={ offers:3, candidates:6, maxActivePersonal:2,
  objMul:{ clear:1, boss:1.1, cull:.7, salvage:.45, condition:1.2 } as Record<ObjType,number>,
  modMul:{ patron:.15, premium:.25, nemesis:.3, face:.1, chrome:.1, rival:.15, hacker:.1, repeat:.05, redeem:.1 } as Record<ModId,number>,
  maxModMul:.5, cull:[12,18,24] as number[], salvage:[3,4,5] as number[], creditPerLevel:28, creditCap:2400, repMax:10 };
export const OBJ_LABEL:Record<ObjType,string>={ clear:'Clear', boss:'Boss', cull:'Cull', salvage:'Salvage', condition:'Wake' };
export const MOD_LABEL:Record<ModId,{ label:string; tip:string }>={
  patron:{ label:'Patron', tip:'The house that made your parts trusts you: +15% credits.' },
  premium:{ label:'Premium', tip:'Trusted contact: +25% credits.' }, nemesis:{ label:'Rival', tip:'Your nemesis is the target or haunts this place: +30% credits.' },
  face:{ label:'Clean', tip:'For a human face: +10% credits.' }, chrome:{ label:'Loud', tip:'For a chromed runner: +10% credits.' },
  rival:{ label:'Grudge', tip:'Hits a faction that wants you gone: +15% credits.' }, hacker:{ label:'Wired', tip:'Uses the hack route you favor: +10% credits.' },
  redeem:{ label:'Second shot', tip:'Somewhere you went down or a job you dropped: +10% credits.' },
  repeat:{ label:'Known', tip:'A place you have cleared before: +5% credits.' } };

// ---------- inputs from other systems (all optional, all validated) ----------
/** Nemesis bosses from the nemesis system if present (save.nemesis.list or save.nemeses): only boss types that exist in some dungeon are used. */
export function nemesesOf(s:any):{ boss:string; dungeon?:string; name?:string }[]{ const raw=s?.nemesis?.list??s?.nemeses??[]; if(!Array.isArray(raw)) return [];
  return raw.filter((n:any)=>n&&n.status!=='dead').map((n:any)=>({ ...n, boss:typeof n.boss==='string'?n.boss:typeof n.src==='string'?n.src:n.body })).filter((n:any)=>typeof n.boss==='string'&&ENEMIES[n.boss]).slice(0,5).map((n:any)=>({ boss:n.boss, dungeon:typeof n.dungeon==='string'?n.dungeon:undefined, name:typeof n.name==='string'?n.name.slice(0,24):undefined })); }
export const bossesOf=(d:DungeonDef,caps:Set<string>)=>[...new Set([d.boss||d.defaultBoss,...d.conds.filter(c=>caps.has(c.cap)).map(c=>c.boss)].filter(Boolean))] as string[];
/** Template eligibility = the same gates the player faces: unlock chain, a reachable host town, not sealed for level, not locked out today. */
export function templateOk(s:any,d:DungeonDef,now=Date.now()):string|null{ if(unlockReason(s,d.id)) return 'locked'; if(!hostsOf(d.id).some(t=>isUnlocked(s,t))) return 'no_town';
  if(s.level<d.minLevel-SEAL_MARGIN) return 'underlevel'; if(s.level>d.maxLevel+8) return 'overlevel'; if(lockDay(s,d.id)===todayStr(now)) return 'locked_out'; return null; }
export const giverOf=(d:DungeonDef)=>NPC_BY_ID[d.fixer]?d.fixer:'odalys_vane';
export function rewardFor(s:any,d:DungeonDef,obj:ObjType,mods:ModId[],giver:string):{ credits:number; rep:Record<string,number> }{ const C=PC_CFG; const lv=Math.max(d.minLevel,Math.min(d.maxLevel,s.level||1));
  const mm=Math.min(C.maxModMul,mods.reduce((a,m)=>a+(C.modMul[m]||0),0)); const credits=Math.min(C.creditCap,Math.round((200+lv*C.creditPerLevel)*(d.creditMul||1)*C.objMul[obj]*(1+mm)/10)*10);
  const fac=(NPC_BY_ID[giver]?.faction&&NPC_BY_ID[giver].faction!=='independent')?NPC_BY_ID[giver].faction:d.mfr; return { credits, rep:{ [fac]:Math.min(C.repMax,Math.round(3+lv/8)) } }; }
const goalOf=(d:DungeonDef,obj:ObjType,boss:string,n:number,cond?:string):Goal=>obj==='clear'?{ kind:'clear', dungeon:d.id, n:1 }:obj==='boss'?{ kind:'boss', key:boss, dungeon:d.id, n:1 }:obj==='cull'?{ kind:'kill_mfr', key:'any', dungeon:d.id, n }:obj==='salvage'?{ kind:'pickup', dungeon:d.id, n }:{ kind:'condition', key:cond, dungeon:d.id, n:1 };
const hash=(x:string)=>{ let h=2166136261; for(let i=0;i<x.length;i++){ h^=x.charCodeAt(i); h=Math.imul(h,16777619); } return (h>>>0).toString(36); };

/** Modifiers this character qualifies for on this combo (each has a checkable precondition). */
export function modsFor(s:any,d:DungeonDef,obj:ObjType,boss:string,giver:string,caps:Set<string>):ModId[]{ const out:ModId[]=[]; const h=humanityOf(s), b=humBand(h); const fams=[traitsOf(s).l10,traitsOf(s).l20].flatMap(p=>p&&TRAIT_BY_ID[p.id]?(TRAIT_BY_ID[p.id] as any).fams:[]);
  { const ft=facTier(s,d.mfr); if(ft==='trusted'||ft==='loyal') out.push('patron'); }
  if(questAccess(s,giver).premium) out.push('premium'); if(nemesesOf(s).some(n=>(obj==='boss'&&n.boss===boss)||n.dungeon===d.id)) out.push('nemesis');
  if(memFor(s,giver).some(e=>(e.k==='failed_job'||e.k==='witnessed_death')&&e.key===d.id)) out.push('redeem');
  if(b==='human') out.push('face'); else if(b==='chrome'||b==='psycho') out.push('chrome');
  if(trust(s,'guard_'+d.mfr)==='hostile'||trust(s,'guard_'+d.mfr)==='wary') out.push('rival');
  if(obj==='condition'&&(fams.includes('hack')||(s.speechStats?.by?.hack||0)>0)&&d.conds.some(c=>c.cap==='hack'&&caps.has('hack'))) out.push('hacker');
  if(s.cleared?.[d.id]) out.push('repeat'); return out.slice(0,3); }

/** faction weighting: houses that like you send more work, hostile houses less (never zero, never story jobs) */
const FAC_W:Record<string,number>={ hostile:-2, wary:-.7, neutral:0, trusted:.8, loyal:1.5 };
export interface GenCtx { caps:Set<string>; now?:number; salt?:number }
/** All valid combos for this character, scored by how personal they are. Deterministic for (save, day, salt). */
export function candidates(s:any,ctx:GenCtx):PContract[]{ const now=ctx.now??Date.now(); const day=todayStr(now); const out:PContract[]=[]; const nem=nemesesOf(s); const fams=[traitsOf(s).l10,traitsOf(s).l20].flatMap(p=>p&&TRAIT_BY_ID[p.id]?(TRAIT_BY_ID[p.id] as any).fams:[]);
  const rep=s.rep||{}; const topFac=Object.entries(rep).sort((a:any,b:any)=>b[1]-a[1])[0]?.[0];
  for(const d of DUNGEON_LIST){ if(templateOk(s,d,now)) continue; const giver=giverOf(d); if(!questAccess(s,giver,now).offers) continue; const bosses=bossesOf(d,ctx.caps);
    const objs:{ obj:ObjType; boss:string; n:number; cond?:string; w:number; why:string[] }[]=[];
    objs.push({ obj:'clear', boss:bosses[0], n:1, w:1, why:['level'] });
    for(const bo of bosses){ const isNem=nem.some(n=>n.boss===bo); objs.push({ obj:'boss', boss:bo, n:1, w:(isNem?6:0)+(fams.includes('ghost')?1:0)+.5, why:isNem?['nemesis']:['boss'] }); }
    const ci=Math.min(2,Math.floor(Math.max(0,s.level-d.minLevel)/6)); objs.push({ obj:'cull', boss:bosses[0], n:PC_CFG.cull[ci], w:(fams.includes('brute')||fams.includes('gun')?2:.5)+(trust(s,'guard_'+d.mfr)==='hostile'?1:0), why:['playstyle'] });
    objs.push({ obj:'salvage', boss:bosses[0], n:PC_CFG.salvage[ci], w:fams.includes('tech')?2:.4, why:['playstyle'] });
    for(const c of d.conds) if(ctx.caps.has(c.cap)) objs.push({ obj:'condition', boss:c.boss, n:1, cond:c.id, w:(c.cap==='hack'&&fams.includes('hack')?3:1), why:['caps'] });
    for(const o of objs){ const mods=modsFor(s,d,o.obj,o.boss,giver,ctx.caps); const goal=goalOf(d,o.obj,o.boss,o.n,o.cond); const id='pc_'+hash([day,ctx.salt||0,d.id,o.obj,o.boss,o.n,o.cond||''].join('|'));
      const lvFit=1-Math.min(1,Math.abs(s.level-(d.minLevel+d.maxLevel)/2)/12); const w=o.w+lvFit*2+(d.mfr===topFac?.5:0)+FAC_W[facTier(s,d.mfr)]+(memFor(s,giver).length?.3:0)+mods.length*.4+((hash(id+day).charCodeAt(1)%7)/20);
      const kit=KITS[o.boss]?o.boss:null; const r=rewardFor(s,d,o.obj,mods,giver);
      out.push({ id, personal:true, title:OBJ_LABEL[o.obj]+': '+d.short, text:'', goal, reward:r, minLevel:Math.max(1,d.minLevel-SEAL_MARGIN), repeat:'once', giver, tpl:d.id, boss:o.boss, kit, obj:o.obj, mods, src:'rules', made:now, why:[...o.why,...mods], _w:w } as any); } }
  out.sort((a:any,b:any)=>b._w-a._w||a.id.localeCompare(b.id)); const pick:PContract[]=[];
  // variety: first pass = distinct dungeon AND distinct objective; second pass fills with distinct dungeon; third with anything new
  const passes:((c:PContract)=>boolean)[]=[c=>!pick.some(p=>p.tpl===c.tpl||p.obj===c.obj),c=>!pick.some(p=>p.tpl===c.tpl),c=>!pick.some(p=>p.tpl===c.tpl&&p.obj===c.obj)];
  for(const ok of passes) for(const c of out){ if(pick.length>=PC_CFG.candidates) break; if(!pick.includes(c)&&ok(c)) pick.push(c); }
  for(const c of out) delete (c as any)._w; return pick; }

/** Server-independent validation of one contract against the CURRENT game state. Empty array = valid. */
export function validateContract(s:any,c:any,caps:Set<string>,now=Date.now()):string[]{ const e:string[]=[]; if(!c||typeof c!=='object') return ['shape'];
  const d=DUNGEONS[c.tpl]; if(!d) return ['template']; const tk=templateOk(s,d,now); if(tk&&tk!=='locked_out') e.push('template:'+tk);
  if(!['clear','boss','cull','salvage','condition'].includes(c.obj)) e.push('objective');
  const bosses=bossesOf(d,caps); if(!bosses.includes(c.boss)) e.push('boss'); if(c.kit!=null&&(c.kit!==c.boss||!KITS[c.kit])) e.push('kit');
  const g=c.goal; if(!g||g.dungeon!==d.id) e.push('goal');
  else if(c.obj==='clear'&&!(g.kind==='clear'&&g.n===1)) e.push('goal'); else if(c.obj==='boss'&&!(g.kind==='boss'&&g.key===c.boss&&g.n===1)) e.push('goal');
  else if(c.obj==='cull'&&!(g.kind==='kill_mfr'&&g.key==='any'&&PC_CFG.cull.includes(g.n))) e.push('goal'); else if(c.obj==='salvage'&&!(g.kind==='pickup'&&PC_CFG.salvage.includes(g.n))) e.push('goal');
  else if(c.obj==='condition'&&!(g.kind==='condition'&&d.conds.some(x=>x.id===g.key&&caps.has(x.cap)&&x.boss===c.boss))) e.push('goal:condition_needs_cap');
  if(!Array.isArray(c.mods)||c.mods.length>3) e.push('mods'); else { const ok=modsFor(s,d,c.obj,c.boss,c.giver,caps); for(const m of c.mods) if(!ok.includes(m)) e.push('mod:'+m); }
  if(c.giver!==giverOf(d)) e.push('giver'); else if(!questAccess(s,c.giver,now).offers) e.push('giver:hostile');
  const r=rewardFor(s,d,c.obj,Array.isArray(c.mods)?c.mods:[],c.giver); if(!c.reward||c.reward.credits!==r.credits||JSON.stringify(c.reward.rep||{})!==JSON.stringify(r.rep)) e.push('reward');
  if(c.brief!=null&&(typeof c.brief!=='string'||c.brief.length>240)) e.push('brief'); if(typeof c.title!=='string'||c.title.length>40||!c.title) e.push('title');
  return e; }

// ---------- per-character board ----------
export interface PBoard { v:1; day:string; offers:PContract[]; defs:Record<string,PContract>; n:number }
export const boardOf=(s:any):PBoard=>{ if(!s.pcon||s.pcon.v!==1) s.pcon={ v:1, day:'', offers:[], defs:{}, n:0 }; return s.pcon; };
/** Contract definition lookup for the shared contract machinery (static contracts first, then this character's personal ones). */
export function contractDefOf(s:any,id:string):(ContractDef&{ contact:string; personal?:boolean })|undefined{ const st=(CONTRACT_BY_ID as any)[id]; if(st) return st; const p=s?.pcon?.defs?.[id]; return p?{ ...p, contact:p.giver }:undefined; }
/** Refresh at a checkpoint (town entry / dungeon clear) or a new day. Keeps accepted contracts. Returns the candidate set for AI picking. */
export function refreshBoard(s:any,caps:Set<string>,now=Date.now(),force=false):{ board:PBoard; cands:PContract[] }{ const B=boardOf(s); const day=todayStr(now);
  if(!force&&B.day===day&&B.offers.length) return { board:B, cands:[] }; if(B.day!==day) B.n=0; else B.n++;
  const cands=candidates(s,{ caps, now, salt:B.n }).filter(c=>!validateContract(s,c,caps,now).length); B.day=day; B.offers=cands.slice(0,PC_CFG.offers).map(c=>({ ...c, brief:cannedBrief(s,c) }));
  pruneDefs(s); return { board:B, cands }; }
function pruneDefs(s:any){ const B=boardOf(s), cs=contractState(s); for(const id of Object.keys(B.defs)) if(!(id in cs.active)) delete B.defs[id]; }
/** AI pick: ids must be a subset of the validated candidates; titles/briefs are length-capped strings. Anything else -> keep rules offers. */
export function applyPick(s:any,cands:PContract[],pick:unknown,caps:Set<string>,now=Date.now()):boolean{ if(!Array.isArray(pick)||!pick.length||pick.length>PC_CFG.offers) return false; const B=boardOf(s); const out:PContract[]=[];
  for(const p of pick as any[]){ const c=cands.find(x=>x.id===p?.id); if(!c||out.some(o=>o.id===c.id)) return false; if(typeof p.title!=='string'||typeof p.brief!=='string'||p.title.length>40||p.brief.length>240||p.title.length<3||p.brief.length<20) return false;
    const nc={ ...c, title:p.title, brief:p.brief, src:'ai' as const }; if(validateContract(s,nc,caps,now).length) return false; out.push(nc); }
  B.offers=out; return true; }
export function cannedBrief(s:any,c:PContract):string{ const d=DUNGEONS[c.tpl]; const bn=ENEMIES[c.boss]?.name||'the boss'; const nem=nemesesOf(s).find(n=>n.boss===c.boss);
  const core={ clear:`Clear ${d.name}. Controller out, boss down.`, boss:`Put ${nem?.name||bn} down in ${d.short}.`, cull:`Thin out ${c.goal.n} of their crew in ${d.short}.`, salvage:`Bring back ${c.goal.n} pieces from ${d.short}.`, condition:`Wake the other boss in ${d.short}: ${bn}.` }[c.obj];
  const why=c.mods.includes('nemesis')?' It beat you once. Not twice.':c.mods.includes('rival')?' They already want you gone, so be quick.':c.mods.includes('face')?' Keep it clean.':c.mods.includes('chrome')?' Go loud; it suits you now.':c.mods.includes('premium')?' Best rate I have, for you.':c.mods.includes('patron')?' The house that built your parts asked for you.':'';
  return core+why; }
export function acceptPersonal(s:any,id:string,caps:Set<string>,maxActive:number,now=Date.now()):{ ok:boolean; why?:string }{ const B=boardOf(s); const c=B.offers.find(o=>o.id===id); if(!c) return { ok:false, why:'No longer offered.' };
  const v=validateContract(s,c,caps,now); if(v.length) return { ok:false, why:'This job no longer fits ('+v[0]+').' }; const cs=contractState(s);
  if(Object.keys(cs.active).length>=maxActive) return { ok:false, why:'Too many active contracts.' }; if(Object.keys(cs.active).filter(k=>B.defs[k]).length>=PC_CFG.maxActivePersonal) return { ok:false, why:`At most ${PC_CFG.maxActivePersonal} personal jobs at once.` };
  B.defs[c.id]=c; cs.active[c.id]=0; B.offers=B.offers.filter(o=>o.id!==id); return { ok:true }; }
/** Claim hook: the giver remembers you came through. */
export const onPersonalDone=(s:any,id:string,now=Date.now())=>{ const c=boardOf(s).defs[id]; if(c){ remember(s,c.giver,'contract_done',c.tpl,now); remember(s,c.giver,'helped',c.tpl,now); delete boardOf(s).defs[id]; } };
