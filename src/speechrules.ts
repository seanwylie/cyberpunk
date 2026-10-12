// Speech outcome rules (docs/NPC_MEMORY.md). The AI classifies the player's free-text line into a bounded intent (enum + strength 0-3)
// and writes the NPC's reply. THIS module decides what happens: a tested formula over humanity, traits, speech tier, NPC resistance and memory.
// Dialogue choices go through the same formula (fixed strength), so free text is never the only way through.
import { humanityOf, memSpeechMod, hostile, remember, type Intent, type MemKind } from './npcmem';
import { traitsOf } from './traitstate';
import { TRAIT_BY_ID } from './traits';

export const INTENTS:Intent[]=['persuade','intimidate','bribe','deceive','empathize'];
export const INTENT_LABEL:Record<Intent,string>={ persuade:'Persuade', intimidate:'Intimidate', bribe:'Bribe', deceive:'Bluff', empathize:'Empathize' };
export const INTENT_TIP:Record<Intent,string>={ persuade:'Reason with them. Better with high humanity.', intimidate:'Threaten. Better with heavy chrome.', bribe:'Pay credits. Costs more at higher strength.', deceive:'Lie. Works once; they remember.', empathize:'Meet them where they are. Best with high humanity.' };
export const SPEECH_CFG={
  base:{ persuade:.42, intimidate:.40, bribe:.70, deceive:.38, empathize:.40 } as Record<Intent,number>,
  perStrength:.07, perTier:.07, resist:.09, hostile:-.12, min:.05, max:.92,
  /** free text can't out-scale the build: strength above (1 + tier) is clamped */ freeTextExtra:1,
  /** dialogue choices use this strength */ choiceStrength:1,
  bribeCost:[60,120,220,400] as number[], traitMax:.10 };
/** Trait families that help an intent (bounded; Face-style traits from the speech module plug in through 'social'). */
const TRAIT_HELP:Record<Intent,string[]>={ persuade:['social','tech'], intimidate:['brute','gun'], bribe:['social'], deceive:['ghost','hack','social'], empathize:['social'] };
export interface SpeechCtx { humanity:number; tier:0|1|2|3; traitFams:string[]; level:number; credits:number; resist:0|1|2|3; memMod:number; hostile:boolean }
export function ctxFor(s:any,npc:string,opts:{ tier?:number; resist?:number }={}):SpeechCtx{ const T=traitsOf(s); const fams=[T.l10,T.l20].flatMap(p=>p&&TRAIT_BY_ID[p.id]?(TRAIT_BY_ID[p.id] as any).fams:[]);
  return { humanity:humanityOf(s), tier:Math.max(0,Math.min(3,opts.tier??0)|0) as any, traitFams:fams, level:s.level||1, credits:s.credits||0, resist:Math.max(0,Math.min(3,opts.resist??1)|0) as any, memMod:0, hostile:hostile(s,npc) }; }
export const bribeCost=(c:SpeechCtx,strength:number)=>Math.round(SPEECH_CFG.bribeCost[Math.min(3,Math.floor(c.level/10))]*(1+.25*strength)*(1+c.resist*.25));
const humTerm=(i:Intent,h:number)=>i==='persuade'?(h-50)/250:i==='empathize'?(h-50)/200:i==='intimidate'?(50-h)/220:i==='deceive'?(h-50)/600:0;
export const clampStrength=(strength:number,tier:number,free:boolean)=>{ const s=Math.max(0,Math.min(3,Math.round(Number(strength)||0))); return free?Math.min(s,tier+SPEECH_CFG.freeTextExtra):s; };
/** Success chance in [min, max]. Pure. */
export function chance(intent:Intent,strength:number,c:SpeechCtx):number{ const C=SPEECH_CFG; if(!INTENTS.includes(intent)) return 0;
  if(intent==='bribe'&&c.credits<bribeCost(c,strength)) return 0;
  const tb=Math.min(C.traitMax,c.traitFams.filter(f=>TRAIT_HELP[intent].includes(f)).length*.05);
  const v=C.base[intent]+strength*C.perStrength+c.tier*C.perTier+humTerm(intent,c.humanity)+tb+c.memMod-c.resist*C.resist+(c.hostile?C.hostile:0);
  return Math.round(Math.max(C.min,Math.min(C.max,v))*100)/100; }
/** Validate a scored intent from the server (or anywhere). Returns null for anything outside the enum/range. */
export function validIntent(x:any):{ intent:Intent; strength:0|1|2|3 }|null{ if(!x||typeof x!=='object') return null; if(!INTENTS.includes(x.intent)) return null; const n=x.strength; if(!Number.isInteger(n)||n<0||n>3) return null; return { intent:x.intent, strength:n }; }
export interface Outcome { ok:boolean; intent:Intent; strength:number; chance:number; roll:number; cost:number; mem:MemKind }
const OK_MEM:Record<Intent,MemKind>={ persuade:'talked_down', intimidate:'intimidated', bribe:'bribed', deceive:'deceived', empathize:'empathized' };
/** Resolve one attempt. roll in [0,1) from the game RNG. Records the memory, takes bribe credits. Validates everything again. */
export function resolve(s:any,npc:string,scored:unknown,free:boolean,roll:number,opts:{ tier?:number; resist?:number }={}):Outcome|null{ const v=validIntent(scored); if(!v) return null; if(!(roll>=0&&roll<1)) return null;
  const c=ctxFor(s,npc,opts); c.memMod=memSpeechMod(s,npc,v.intent); const st=clampStrength(v.strength,c.tier,free); const p=chance(v.intent,st,c); const ok=roll<p;
  let cost=0; if(v.intent==='bribe'&&ok){ cost=bribeCost(c,st); s.credits=Math.max(0,(s.credits||0)-cost); }
  const mem:MemKind=ok?OK_MEM[v.intent]:'speech_failed'; remember(s,npc,mem,v.intent);
  const a=(s.speechStats??={ n:0, ok:0, by:{} }); a.n++; if(ok) a.ok++; a.by[v.intent]=(a.by[v.intent]||0)+1;
  return { ok, intent:v.intent, strength:st, chance:p, roll, cost, mem }; }
