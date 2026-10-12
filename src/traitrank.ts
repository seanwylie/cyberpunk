// Client side of AI trait ranking (docs/TRAITS.md, server/trait_rank.mjs). Sends ids + playstyle shares only. The reply is applied through
// traitstate.applyRanking(), which accepts nothing outside the current candidate set. Any failure keeps the deterministic rules order.
import { traitsOf, applyRanking, lean } from './traitstate';
import { FAMILIES } from './traits';
import { PLAYER_ID, SESSION_ID } from './story_beats';
import { persist } from './state';
const inflight=new Set<string>();
export async function rankOffer(s:any,prior:any,endpoint?:string,fetcher:(u:string,i:any)=>Promise<any>=(u,i)=>fetch(u,i)):Promise<'ai'|'kept'|'skip'>{
  const T=traitsOf(s), o=T.offer; if(!o||o.src==='ai'||s.settings?.storyAi===false) return 'skip'; if(inflight.has(o.key)) return 'skip'; inflight.add(o.key);
  const url=endpoint||((import.meta as any).env?.VITE_WV_STORY_URL as string)||'api/story-beat'; const L=lean(s,prior);
  const body={ kind:'trait_rank', session:SESSION_ID, player:PLAYER_ID, tier:o.tier, candidates:o.ids, l10:o.tier===2?T.l10?.id:undefined, shares:Object.fromEntries(FAMILIES.map(f=>[f,Math.round(L.shares[f]*100)/100])) };
  try{ const r=await fetcher(url,{ method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify(body) }); const j=await r.json();
    if(T.offer!==o) return 'skip'; if(j&&j.ok&&j.src==='ai'&&applyRanking(s,j.order,j.lines)){ persist(s); return 'ai'; } return 'kept'; }
  catch{ return 'kept'; } finally{ inflight.delete(o.key); } }
