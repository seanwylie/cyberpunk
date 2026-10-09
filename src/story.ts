// Adaptive story: game-owned facts -> bounded LLM proposal (behind an interface) -> validation -> persisted development.
// Runs OUTSIDE combat (called from town after a run). Failure/invalid output keeps the previous accepted story.
export type EventKind = 'kill_mfr'|'boss_defeated'|'condition_used'|'route_used'|'run_cleared'|'town_choice';
export interface StoryEvent { id:number; kind:EventKind; key:string; n:number; t:number; }
export interface Edge { from:string; to:string; roles:string[]; w:number; }
export interface Proposal { arc:string; facts_used:number[]; clue:{ condition:'A'|'B'|null; text:string; source:'terminal'|'armory_marking'|'announcement' }; town:{ contact:string; text:string; options:{id:string;label:string;boosts:string}[] }; edges:{from:string;to:string;role:string;delta:number}[]; }
export interface StoryState { events:StoryEvent[]; edges:Edge[]; arc:string; clues:{ A:string|null; B:string|null; general:string|null }; town:{ contact:string; text:string; options:{id:string;label:string;boosts:string}[] }|null; log:{ t:number; provider:string; ok:boolean; note:string; ms:number }[]; nextEvent:number; lastProposalEvent:number; boosts:Record<string,number>; }

export const APPROVED = {
  contacts:['odalys_vane','tech_marr','handler_cole'], nodes:['player','HI','PS','MM','odalys_vane','tech_marr','handler_cole'],
  roles:['contractor','saboteur','trader','target','scavenger'], arcs:['audit_pressure','reclaim_push','quiet_trade'], conditions:['A','B'],
  facts:{ HI:'Harrow-Brandt Heavy Works runs the Reclamation Annex salvage lines.', PS:'Aldane Surgical supplies the Annex security audit hardware.', MM:'Kestrel Value Systems staffs the Annex floor with refurbished contractors.',
    odalys_vane:'Odalys Vane is a fixer who sells Annex contracts.', tech_marr:'Marr is a technician who reads replacement-part markings.', handler_cole:'Cole is a corporate handler tracking missing controllers.' },
};
export function newStory():StoryState { return { events:[], edges:[{from:'player',to:'odalys_vane',roles:['contractor'],w:1}], arc:'quiet_trade', clues:{A:null,B:null,general:null}, town:null, log:[], nextEvent:1, lastProposalEvent:0, boosts:{} }; }
export function record(s:StoryState, kind:EventKind, key:string, n=1) {
  const e=s.events.find(e=>e.kind===kind&&e.key===key&&e.id>s.lastProposalEvent); if(e){e.n+=n;return;}
  s.events.push({id:s.nextEvent++,kind,key,n,t:Date.now()}); if(s.events.length>200) s.events.splice(0,50);
}
export interface BoundedContext { facts:string[]; events:StoryEvent[]; edges:Edge[]; allowed:{ contacts:string[]; nodes:string[]; roles:string[]; arcs:string[]; conditions:string[]; sources:string[] }; currentArc:string; }
export function buildContext(s:StoryState):BoundedContext {
  return { facts:Object.values(APPROVED.facts), events:s.events.filter(e=>e.id>s.lastProposalEvent), edges:s.edges, allowed:{ contacts:APPROVED.contacts, nodes:APPROVED.nodes, roles:APPROVED.roles, arcs:APPROVED.arcs, conditions:APPROVED.conditions, sources:['terminal','armory_marking','announcement'] }, currentArc:s.arc };
}
export interface StoryProvider { name:string; propose(ctx:BoundedContext):Promise<unknown>; }

export class MockProvider implements StoryProvider {
  name='mock';
  async propose(ctx:BoundedContext):Promise<Proposal> {
    const ev=ctx.events; const total=(k:string,key?:string)=>ev.filter(e=>e.kind===k&&(!key||e.key===key)).reduce((a,e)=>a+e.n,0);
    const hack=total('route_used','hack'), force=total('route_used','force'), cloak=total('route_used','cloak');
    const hi=total('kill_mfr','HI'), ps=total('kill_mfr','PS'), mm=total('kill_mfr','MM');
    const used=ev.map(e=>e.id).slice(-6);
    let arc='quiet_trade', cond:'A'|'B'|null=null, src:Proposal['clue']['source']='announcement', text:string;
    if (hack>=force && hack>0 || ps>hi && ps>0) { arc='audit_pressure'; cond='A'; src='terminal';
      text='Terminal records show Aldane auditors flagged the Annex controller shortage. A security audit command entered at the Annex terminal wakes a Neural Warden. Marr says the hacking brains are the only way to issue it.'; }
    else if (force>0 || hi>=ps && hi>0) { arc='reclaim_push'; cond='B'; src='armory_marking';
      text='Replacement-part markings on the sealed armory match Harrow-Brandt reclaim stock. Pulling the command fuse with force hardware brings the Reclamation Enforcer out of storage, according to Marr.'; }
    else text='Cole has been asking where the missing controllers go. Announcements on the Annex floor mention routine audits and reclaim sweeps. Nothing is confirmed yet.';
    return { arc, facts_used:used, clue:{ condition:cond, text, source:src },
      town:{ contact:'odalys_vane', text: cloak>0?'Odalys Vane notices you left the Annex quietly. "Quiet contractors get better offers. Which line do you want to lean on?"':'Odalys Vane has two Annex leads. "Pick the one you want me to push harder."',
        options:[{id:'audit',label:'Push the security-audit lead',boosts:'audit_pressure'},{id:'reclaim',label:'Push the reclaim-stock lead',boosts:'reclaim_push'}] },
      edges:[ {from:'player',to: ps>=mm&&ps>=hi?'PS':hi>=mm?'HI':'MM', role:'contractor', delta:1}, {from:'player',to:'handler_cole',role:'target',delta: hack+force>0?1:0} ] };
  }
}
export class HttpProvider implements StoryProvider {
  name='http-openai-compatible';
  constructor(private url:string, private key:string, private model:string){}
  async propose(ctx:BoundedContext):Promise<unknown> {
    const sys='You are a narrative proposal generator for a game. Respond ONLY with JSON matching: {arc, facts_used:number[], clue:{condition:"A"|"B"|null,text,source}, town:{contact,text,options:[{id,label,boosts}]}, edges:[{from,to,role,delta}]}. Use only identifiers from "allowed". Do not invent mechanics, items, odds, or rewards. Keep text under 400 chars.';
    const ctl=new AbortController(); const t=setTimeout(()=>ctl.abort(),20000);
    try { const r=await fetch(this.url,{method:'POST',signal:ctl.signal,headers:{'Content-Type':'application/json','Authorization':'Bearer '+this.key},body:JSON.stringify({model:this.model,response_format:{type:'json_object'},messages:[{role:'system',content:sys},{role:'user',content:JSON.stringify(ctx)}]})});
      if(!r.ok) throw new Error('HTTP '+r.status); const j=await r.json(); return JSON.parse(j.choices[0].message.content); } finally { clearTimeout(t); }
  }
}
const BAD = /guarantee|always drop|100%|drop rate|unlock|free item|grants? you|you receive/i;
export function validate(p:any, ctx:BoundedContext):{ ok:true; p:Proposal }|{ ok:false; why:string } {
  try {
    if(!p||typeof p!=='object') return {ok:false,why:'not an object'};
    if(!APPROVED.arcs.includes(p.arc)) return {ok:false,why:'unknown arc '+p.arc};
    if(!Array.isArray(p.facts_used)||p.facts_used.some((i:any)=>!ctx.events.some(e=>e.id===i))&&p.facts_used.length) return {ok:false,why:'facts_used references unknown event'};
    const c=p.clue; if(!c||typeof c.text!=='string'||c.text.length>420||c.text.length<10) return {ok:false,why:'bad clue text'};
    if(c.condition!==null&&!APPROVED.conditions.includes(c.condition)) return {ok:false,why:'unknown condition'};
    if(!ctx.allowed.sources.includes(c.source)) return {ok:false,why:'unknown clue source'};
    if(BAD.test(c.text)||BAD.test(p.town?.text||'')) return {ok:false,why:'text promises mechanics/rewards'};
    const t=p.town; if(!t||!APPROVED.contacts.includes(t.contact)||typeof t.text!=='string'||t.text.length>420) return {ok:false,why:'bad town block'};
    if(!Array.isArray(t.options)||t.options.length<1||t.options.length>3||t.options.some((o:any)=>!APPROVED.arcs.includes(o.boosts)||typeof o.label!=='string')) return {ok:false,why:'bad options'};
    if(!Array.isArray(p.edges)||p.edges.length>4||p.edges.some((e:any)=>!APPROVED.nodes.includes(e.from)||!APPROVED.nodes.includes(e.to)||!APPROVED.roles.includes(e.role)||typeof e.delta!=='number'||Math.abs(e.delta)>2)) return {ok:false,why:'bad edges'};
    return {ok:true,p:p as Proposal};
  } catch(e:any){ return {ok:false,why:'validator error '+e.message}; }
}
/** Request a development. Never throws; on failure retains previous accepted story. Returns note for the UI. */
export async function runStoryStep(s:StoryState, provider:StoryProvider, fallback:StoryProvider=new MockProvider()):Promise<string> {
  const ctx=buildContext(s); if(!ctx.events.length) return 'No new events to build on.';
  const t0=performance.now(); let raw:unknown; let used=provider.name;
  try { raw=await provider.propose(ctx); } catch(e:any){ s.log.push({t:Date.now(),provider:provider.name,ok:false,note:'provider failed: '+e.message,ms:Math.round(performance.now()-t0)}); if(provider===fallback||provider.name==='mock') return 'Story generation unavailable; keeping previous story.'; try{ raw=await fallback.propose(ctx); used='mock(fallback)'; }catch{ return 'Story generation unavailable.'; } }
  const v=validate(raw,ctx); const ms=Math.round(performance.now()-t0);
  if(!v.ok){ s.log.push({t:Date.now(),provider:used,ok:false,note:'rejected: '+v.why,ms}); return 'Proposal rejected ('+v.why+'); previous story retained.'; }
  const p=v.p; s.arc=p.arc; if(p.clue.condition==='A') s.clues.A=p.clue.text; else if(p.clue.condition==='B') s.clues.B=p.clue.text; else s.clues.general=p.clue.text;
  s.town=p.town; for(const e of p.edges){ let ed=s.edges.find(x=>x.from===e.from&&x.to===e.to); if(!ed){ed={from:e.from,to:e.to,roles:[],w:0};s.edges.push(ed);} if(!ed.roles.includes(e.role)) ed.roles.push(e.role); ed.w+=e.delta; }
  s.lastProposalEvent=s.nextEvent-1; s.log.push({t:Date.now(),provider:used,ok:true,note:'accepted arc '+p.arc,ms}); if(s.log.length>30) s.log.shift();
  return 'Story development accepted ('+used+'): '+p.arc;
}
export function makeProvider(cfg:{enabled:boolean;url:string;key:string;model:string}):StoryProvider { return cfg.enabled&&cfg.url&&cfg.key ? new HttpProvider(cfg.url,cfg.key,cfg.model||'gpt') : new MockProvider(); }
