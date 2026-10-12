// Story beat: ONE short line from the Fixer (Odalys Vane) after a run, about one or two parts you are wearing.
// Shown as a small dismissable card in the bottom-left toast area, only in town with no window open. At most one per run. Never in combat.
// The OpenAI key lives ONLY on the server proxy (server/story_beat.mjs, the Lambda, or /api/story-beat in dev). The client sends catalog ids and
// enums (no free text) and falls back to a clean authored line whenever the proxy is unreachable, slow, off, or returns something too long.
import { ITEM_BY_ID, type Mfr, type Rarity } from './config';
import type { Save } from './state';
import { persist } from './state';

export type BeatTrigger = 'return_town'|'contract_done'|'new_mfr_set';
export interface JournalEntry { t:number; trigger:BeatTrigger; town:string; text:string; src:'ai'|'authored'; model?:string; /** plain part names the line is about */ parts?:string[]; /** item ids of those parts */ partDefs?:string[]; /** dungeon id, run result text, player level */ dungeon?:string; result?:string; level?:number; /** false until the player opens the story panel */ read?:boolean }
export interface BeatMeta { seenMfr:Mfr[]; count:number }
export interface BeatReq { trigger?:BeatTrigger; /** how the run ended, shown in the story panel */ result?:string; /** dungeon id of the run that just ended */ dungeon?:string; /** run id: at most one beat per run */ run?:string; force?:boolean }
export const BEAT = { perSession:5, journalMax:40, maxChars:220, maxSentences:2, timeoutMs:12_000, cardMs:14_000, waitMs:90_000 };
export const SPEAKER = { name:'Odalys Vane', role:'Fixer' };

/** Random per-page-load session id (server-side per-session limit and repeat-avoidance). Not tied to the player. */
export const SESSION_ID=(()=>{ try{ const a=new Uint8Array(12); crypto.getRandomValues(a); return Array.from(a,x=>x.toString(16).padStart(2,'0')).join(''); }catch{ return Math.random().toString(16).slice(2).padEnd(24,'0').slice(0,24); } })();
export function journalOf(s:Save):JournalEntry[]{ const x=s as any; if(!Array.isArray(x.journal)) x.journal=[]; return x.journal; }
export function metaOf(s:Save):BeatMeta{ const x=s as any; if(!x.beatMeta) x.beatMeta={seenMfr:[],count:0}; return x.beatMeta; }

/** Plain display name: drops the short maker prefix ("HB Siege Bot Arm" -> "Siege Bot Arm") and a trailing side marker. */
export const plainName=(n:string)=>n.replace(/^[A-Z]{2,3}(?:-\d+)?\s+/,'').replace(/\s*\((?:L|R)\)$/,'').trim();
const RANK:Record<Rarity,number>={grey:0,green:1,blue:2,purple:3,orange:4};
/** The one or two non-standard parts worth mentioning (highest rarity first). Empty when only Standard Issue is worn. */
export function featuredParts(s:Save):{def:string;name:string;mfr:Mfr}[]{
  const out:{def:string;name:string;mfr:Mfr;r:number}[]=[];
  for(const uid of Object.values(s.installed)){ const it=s.items.find(i=>i.uid===uid); const d=it&&ITEM_BY_ID[it.def]; if(!it||!d||it.def.startsWith('stock_')) continue; out.push({def:it.def,name:plainName(d.name),mfr:d.mfr,r:RANK[d.rarity]*100+d.lvl}); }
  out.sort((a,b)=>b.r-a.r); const seen=new Set<string>(); return out.filter(o=>!seen.has(o.name)&&!!seen.add(o.name)).slice(0,2).map(({def,name,mfr})=>({def,name,mfr}));
}
/** Request body: catalog ids and enums ONLY, just the featured parts (the server resolves names and makers and rejects unknown ids). */
export function loadoutSummary(s:Save, req:BeatReq, variant=0){
  const out:any={ trigger:'return_town', town:s.town==='harrow'?'harrow':'rustline', level:Math.max(1,Math.min(99,s.level|0)), session:SESSION_ID, installed:featuredParts(s).map(p=>p.def), chips:[], abilities:[], cosmetics:[], rep:{HI:s.rep.HI|0,PS:s.rep.PS|0,MM:s.rep.MM|0}, variant };
  if(req.dungeon) out.dungeon=req.dungeon; return out;
}

/** Clean authored lines, one or two plain sentences, same voice and format as the AI line. {part} = the featured part. */
const CANNED:Record<Mfr,string[]>={
  HI:['That {part} looks heavy and ready for work. Bring it back in one piece next time.','Good to see the {part} still holding up. Harrow-Brandt builds them to last.','Nice work out there. The {part} has earned its keep.'],
  PS:['That {part} is clean work. Aldane parts always look good until they break.','The {part} looks sharp. Keep it clean and it should keep you alive.','Nice run. I like how the {part} fits on you.'],
  MM:['That {part} has seen a few owners, and it still works. Kestrel parts are like that.','Cheap, patched and still going. The {part} suits you.','Good run. The {part} is not pretty, but it gets the job done.'],
};
export function authoredBeat(s:Save, idx=journalOf(s).length):{text:string;parts:string[]}{
  const p=featuredParts(s); const stock=ITEM_BY_ID['stock_torso']; const m:Mfr=p[0]?.mfr||'MM'; const part=p[0]?.name||plainName(stock?.name||'gear'); const pool=CANNED[m];
  return { text:pool[idx%pool.length].replace('{part}',part), parts:p.map(x=>x.name) };
}
/** Accept an AI line only if it is short, plain and at most two sentences; otherwise the caller uses the canned line. */
export function acceptLine(t:unknown):string|null{
  if(typeof t!=='string') return null; const s=t.replace(/\s+/g,' ').trim(); if(s.length<20||s.length>BEAT.maxChars) return null;
  if(s.split(/(?<=[.!?])\s+/).filter(Boolean).length>BEAT.maxSentences) return null; return s;
}

export const unreadCount=(s:Save)=>journalOf(s).filter(e=>e.read===false).length;
export const REGEN={ minGapMs:20_000, perSession:6 };
export type Fetcher=(url:string,init:any)=>Promise<{ok:boolean;json:()=>Promise<any>}>;
export class StoryBeats {
  private fired=0; private lastRun=''; private runN=0; busy=false; fetcher:Fetcher; now:()=>number=Date.now;
  endpoint:string=((import.meta as any).env?.VITE_WV_STORY_URL as string)||'api/story-beat'; /* AWS: the story Lambda Function URL (build-time VITE_WV_STORY_URL) */
  onEntry:((e:JournalEntry)=>void)|null=null;
  constructor(private save:()=>Save, fetcher?:Fetcher){ this.fetcher=fetcher||((u,i)=>fetch(u,i) as any); }
    private regenN=0; private lastRegen=0;
  /** Rewrites one log entry with a fresh line (same endpoint, new variant). Rate-limited (20 s apart, 6 per session); falls back to the next canned line. */
  async regenerate(e:JournalEntry):Promise<{ok:boolean;why?:string}>{
    const s=this.save(); const now=this.now(); if(this.busy) return {ok:false,why:'busy'};
    if(this.regenN>=REGEN.perSession) return {ok:false,why:'Regeneration limit reached for this session.'}; if(this.lastRegen&&now-this.lastRegen<REGEN.minGapMs) return {ok:false,why:'Please wait a few seconds before regenerating.'};
    this.busy=true; this.regenN++; this.lastRegen=now;
    try { let text:string|null=null, src:'ai'|'authored'='authored', model:string|undefined;
      if(s.settings.storyAi!==false){ try { const ctl=new AbortController(); const to=setTimeout(()=>ctl.abort(),BEAT.timeoutMs);
        const r=await this.fetcher(this.endpoint,{method:'POST',signal:ctl.signal,headers:{'Content-Type':'application/json'},body:JSON.stringify(loadoutSummary(s,{dungeon:e.dungeon},1+(this.regenN%20)))}).finally(()=>clearTimeout(to));
        const j=r.ok?await r.json():null; const a=j&&j.ok?acceptLine(j.text):null; if(a&&a!==e.text){ text=a; src='ai'; model=j.model; } } catch{} }
      if(!text){ const pool=journalOf(s).length+this.regenN+1; text=authoredBeat(s,pool).text; if(text===e.text) text=authoredBeat(s,pool+1).text; }
      e.text=text; e.src=src; e.model=model; persist(s); return {ok:true};
    } finally { this.busy=false; } }
  /** Called once when a run ends (back in town). Returns the entry if one was written (async, never throws). */
  async fire(req:BeatReq={}):Promise<JournalEntry|null>{
    const s=this.save(); if(this.busy) return null;
    const run=req.run||('r'+(++this.runN)); if(!req.force){ if(run===this.lastRun||this.fired>=BEAT.perSession) return null; if(!featuredParts(s).length) return null; }
    this.busy=true; this.fired++; this.lastRun=run;
    try {
      let text:string|null=null, src:'ai'|'authored'='authored', model:string|undefined;
      if(s.settings.storyAi!==false){ try { const ctl=new AbortController(); const to=setTimeout(()=>ctl.abort(),BEAT.timeoutMs);
        const r=await this.fetcher(this.endpoint,{method:'POST',signal:ctl.signal,headers:{'Content-Type':'application/json'},body:JSON.stringify(loadoutSummary(s,req))}).finally(()=>clearTimeout(to));
        const j=r.ok?await r.json():null; const a=j&&j.ok?acceptLine(j.text):null; if(a){ text=a; src='ai'; model=j.model; } } catch{} }
      const canned=authoredBeat(s); if(!text) text=canned.text;
      const e:JournalEntry={ t:this.now(), trigger:'return_town', town:s.town==='harrow'?'harrow':'rustline', text, src, model, parts:canned.parts, partDefs:featuredParts(s).map(p=>p.def), dungeon:req.dungeon, result:req.result, level:s.level, read:false };
      const jr=journalOf(s); jr.push(e); while(jr.length>BEAT.journalMax) jr.shift(); metaOf(s).count++; persist(s); this.onEntry?.(e); return e;
    } finally { this.busy=false; }
  }
}

/** The single place a beat appears: a small card in the bottom-left toast area. Waits (up to 90 s) until you are in town with no window open and no
 *  tutorial step running. Fades after ~14 s (the fade pauses while hovered). Clicking the card opens the story panel (onOpen) and keeps the card until the panel
 *  closes (releaseStoryCard); the x dismisses without opening. Only the card itself takes clicks. Always kept in the Story log. */
let heldCard:HTMLElement|null=null;
export function releaseStoryCard(){ heldCard?.remove(); heldCard=null; }
export function showStoryCard(e:JournalEntry, canShow:()=>boolean, host:HTMLElement|null=document.getElementById('toasts'), onOpen?:(e:JournalEntry)=>void):void{
  if(!host) return; const t0=Date.now();
  const tick=()=>{ if(Date.now()-t0>BEAT.waitMs) return; if(!canShow()){ setTimeout(tick,600); return; }
    const el=document.createElement('div'); el.className='toast storycard'; el.setAttribute('role','button'); el.tabIndex=0; el.setAttribute('aria-label','Open story: '+e.text);
    const who=document.createElement('b'); who.textContent=SPEAKER.name+' · '+SPEAKER.role; const q=document.createElement('span'); q.className='sctext'; q.textContent=e.text;
    const hint=document.createElement('small'); hint.className='schint'; hint.textContent='Click to read';
    const x=document.createElement('button'); x.type='button'; x.className='scx'; x.setAttribute('aria-label','Dismiss'); x.textContent='×';
    el.append(who,q,hint,x); const kill=()=>{ if(heldCard===el) heldCard=null; el.remove(); };
    const open=()=>{ if(!onOpen) return kill(); releaseStoryCard(); heldCard=el; el.classList.add('held'); onOpen(e); };
    x.addEventListener('click',ev=>{ ev.stopPropagation(); kill(); }); el.addEventListener('click',open); el.addEventListener('keydown',ev=>{ if(ev.key==='Enter'||ev.key===' '){ ev.preventDefault(); open(); } });
    el.addEventListener('animationend',()=>{ if(!el.classList.contains('held')) kill(); }); host.appendChild(el); };
  tick();
}
