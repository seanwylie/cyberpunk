// Light generative storytelling: occasional short story beats tailored to the player's loadout.
// The OpenAI key lives ONLY on the server proxy (server/story_beat.mjs, /api/story-beat). The client sends a structured loadout summary,
// never free text, and falls back to authored templates whenever the proxy is unreachable (offline, no key, static/mobile build).
import { ITEM_BY_ID, ABILITIES, CHIPS, MFR, type Mfr } from './config';
import { COS_BY_ID, cosOf } from './content/appearance';
import type { Save } from './state';
import { persist } from './state';

export type BeatTrigger = 'contract_done'|'return_town'|'new_mfr_set';
export interface JournalEntry { t:number; trigger:BeatTrigger; town:string; text:string; src:'ai'|'authored'; model?:string }
export interface BeatMeta { seenMfr:Mfr[]; count:number }
export interface BeatReq { trigger:BeatTrigger; contract?:string; dungeon?:string; force?:boolean }
export const BEAT_LIMITS = { perSession:3, minGapMs:90_000, journalMax:40, chance:{ contract_done:.5, return_town:.3, new_mfr_set:1 } as Record<BeatTrigger,number>, timeoutMs:14_000 };

const clean=(s:string)=>s.replace(/[^A-Za-z0-9 _\-'.:+&]/g,' ').replace(/\s+/g,' ').trim().slice(0,40);
export function journalOf(s:Save):JournalEntry[]{ const x=s as any; if(!Array.isArray(x.journal)) x.journal=[]; return x.journal; }
export function metaOf(s:Save):BeatMeta{ const x=s as any; if(!x.beatMeta) x.beatMeta={seenMfr:[],count:0}; return x.beatMeta; }

/** Structured, bounded summary of what the player is wearing. Only ids, catalog names, enums and small numbers. */
export function loadoutSummary(s:Save, ab:string[], req:BeatReq, newMfr?:Mfr){
  const installed:{slot:string;name:string;mfr:Mfr;rarity:string}[]=[]; const chips=new Set<string>();
  for(const [slot,uid] of Object.entries(s.installed)){ const it=s.items.find(i=>i.uid===uid); const d=it&&ITEM_BY_ID[it.def]; if(!it||!d) continue; installed.push({slot,name:clean(d.name),mfr:d.mfr,rarity:d.rarity}); for(const c of it.chips){ const cd=CHIPS[c]; if(cd) chips.add(clean(cd.name)); } }
  const cos=cosOf(s as any); const cosmetics=Object.values(cos.equipped).map(id=>COS_BY_ID[id as string]).filter(Boolean).map(c=>clean(c.name));
  const out:any={ trigger:req.trigger, town:s.town==='harrow'?'harrow':'rustline', level:Math.max(1,Math.min(99,s.level|0)), installed:installed.slice(0,11), chips:[...chips].slice(0,8), abilities:ab.map(a=>ABILITIES[a]?.name).filter(Boolean).map(clean).slice(0,8), cosmetics:cosmetics.slice(0,8), rep:{HI:s.rep.HI|0,PS:s.rep.PS|0,MM:s.rep.MM|0} };
  if(req.contract) out.contract=clean(req.contract); if(req.dungeon) out.dungeon=clean(req.dungeon); if(newMfr) out.newMfr=newMfr; return out;
}
export function dominantMfr(s:Save):Mfr|null{ const n:Record<string,number>={HI:0,PS:0,MM:0}; for(const uid of Object.values(s.installed)){ const it=s.items.find(i=>i.uid===uid); const d=it&&ITEM_BY_ID[it.def]; if(d) n[d.mfr]++; } const top=(Object.keys(n) as Mfr[]).sort((a,b)=>n[b]-n[a])[0]; return n[top]>=4?top:null; }

const T:Record<Mfr,Record<BeatTrigger,string[]>>={
  HI:{ contract_done:['Odalys squints at your rivet-scarred arms. "Harrow-Brandt iron again. Heavy hardware leaves heavy footprints, and clients do notice."','Ledger entry: contract closed. Foreman note: "Whoever bolted that Harrow-Brandt kit on knows how to take a hit. Keep leasing, keep hauling."'],
    return_town:['The plaza smells of hot slag as you walk in. A porter mutters that Harrow-Brandt people always arrive loud and leave louder.','Terminal log: wear patterns on your Harrow-Brandt plating consistent with heavy salvage. Warranty status: void, as expected.'],
    new_mfr_set:['Marr taps your new plating. "That is a full Harrow-Brandt line now. Slow, loud, built to be repaired by someone else. Do not expect the warranty to survive."'] },
  PS:{ contract_done:['Odalys lowers her voice. "Aldane precision, clean work. The auditors will love your hardware and hate you personally."','Log: contract closed without collateral. Aldane sterile-field residue detected on your gear. Someone upstairs is taking notes.'],
    return_town:['Marr watches you cross the plaza. "Surgical-grade fittings, no wasted motion. Be careful, Aldane parts report back to Aldane."','Terminal log: ceramic wear within tolerance. Compliance score: suspiciously high. Warranty status: void.'],
    new_mfr_set:['Marr whistles at your new fittings. "Full Aldane set. Quiet, precise, and every part serialized. Somebody knows exactly where you are."'] },
  MM:{ contract_done:['Odalys snorts. "Kestrel refurb and still standing. Cheap kit, clever hands. Nobody audits a bargain bin."','Ledger entry: contract closed. Returns desk comment: "Refurbished Kestrel hardware, third owner at least. Shrinkage is within expectations."'],
    return_town:['A vendor squints at your mismatched Kestrel parts. "Value systems, huh? Half of that was returned by somebody before you."','Terminal log: reconditioned parts verified, mostly. Warranty status: void since the second owner.'],
    new_mfr_set:['Marr shakes his head, grinning. "A whole Kestrel set. Bargain-bin from head to heel. It will hold, probably."'] },
};
export function authoredBeat(s:Save, req:BeatReq, newMfr?:Mfr):string{ const m=newMfr||dominantMfr(s)||(Object.keys(MFR) as Mfr[]).sort((a,b)=>s.rep[b]-s.rep[a])[0]; const pool=T[m][req.trigger]||T[m].return_town; const n=journalOf(s).length; return pool[n%pool.length]; }

export type Fetcher=(url:string,init:any)=>Promise<{ok:boolean;json:()=>Promise<any>}>;
export class StoryBeats {
  private fired=0; private last=0; busy=false; fetcher:Fetcher; endpoint='api/story-beat'; rng:()=>number=Math.random; now:()=>number=Date.now;
  onEntry:((e:JournalEntry)=>void)|null=null;
  constructor(private save:()=>Save, private abilities:()=>string[], fetcher?:Fetcher){ this.fetcher=fetcher||((u,i)=>fetch(u,i) as any); }
  private mfrSetCheck():Mfr|null{ const s=this.save(); const d=dominantMfr(s); if(d&&!metaOf(s).seenMfr.includes(d)) return d; return null; }
  /** Called at the three story moments. Returns the entry if one was written (async, never throws). */
  async fire(req:BeatReq):Promise<JournalEntry|null>{
    const s=this.save(); if(this.busy) return null;
    let newMfr:Mfr|undefined; const nm=this.mfrSetCheck();
    if(nm){ newMfr=nm; req={...req,trigger:'new_mfr_set'}; }
    if(!req.force){ if(this.fired>=BEAT_LIMITS.perSession) return null; if(this.now()-this.last<BEAT_LIMITS.minGapMs&&this.last) return null; if(this.rng()>=BEAT_LIMITS.chance[req.trigger]) return null; }
    this.busy=true; this.fired++; this.last=this.now();
    try {
      if(nm) { const m=metaOf(s); m.seenMfr.push(nm); }
      let text:string|null=null, src:'ai'|'authored'='authored', model:string|undefined;
      if(s.settings.storyAi!==false){ try { const ctl=new AbortController(); const to=setTimeout(()=>ctl.abort(),BEAT_LIMITS.timeoutMs);
        const r=await this.fetcher(this.endpoint,{method:'POST',signal:ctl.signal,headers:{'Content-Type':'application/json'},body:JSON.stringify(loadoutSummary(s,this.abilities(),req,newMfr))}).finally(()=>clearTimeout(to));
        const j=r.ok?await r.json():null; if(j&&j.ok&&typeof j.text==='string'&&j.text.length>=20&&j.text.length<=480){ text=j.text; src='ai'; model=j.model; } } catch{} }
      if(!text) text=authoredBeat(s,req,newMfr);
      const e:JournalEntry={ t:this.now(), trigger:req.trigger, town:s.town==='harrow'?'harrow':'rustline', text, src, model };
      const jr=journalOf(s); jr.push(e); while(jr.length>BEAT_LIMITS.journalMax) jr.shift(); metaOf(s).count++; persist(s); this.onEntry?.(e); return e;
    } finally { this.busy=false; }
  }
}
