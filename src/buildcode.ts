// Build export / import. Every export carries the game build id AND the catalog version (content hash, src/catalog_version.ts),
// so a shared build can be compared against the catalog it was made with (src/catalog_snap.ts diffBuild). Import is read-only preview.
//   code:  WVB1.<base64url(JSON)>   JSON = { v:1, game, cat, lvl, slots:{slot:{d,c[]}}, picks? }
import { SLOTS, ITEM_BY_ID, CHIPS, SLOT_LABEL, MFR, ABILITIES, type Slot } from './config';
import { computeBuild, installedLayout, type Layout } from './build';
import { BUILD_ID } from './version';
import { CATALOG_VERSION } from './catalog_version';
import { ABILITY_BY_ID } from './abilities/registry';
import type { Save } from './state';
import type { BuildSlots } from './catalog_snap';
import { TRAIT_BY_ID, describeEffect } from './traits';
import { isExclusive, badgeOf, provenance } from './retire';
import { COS_BY_ID } from './content/appearance';
import { publicTrophies } from './nemesis';

export const BUILD_CODE_PREFIX='WVB1.'; export const BUILD_CODE_MAX=3000;
export interface BuildExport { v:1; game:string; cat:string; lvl:number; slots:BuildSlots; picks?:(string|null)[]; /** confirmed trait ids [L10, L20?] (docs/TRAITS.md) */ traits?:string[]; /** made while the IDKFA dev cheat was on */ cheat?:true; /** exclusives owned, with provenance (cosmetic, docs/MONETIZATION.md) */ ex?:{ id:string; at:number; badge:string }[]; /** nemesis provenance trophies (docs/NEMESIS.md), public */ trophies?:{n:string;l:string;t:number}[] }
const b64e=(s:string)=>{ const b=btoa(Array.from(new TextEncoder().encode(s),c=>String.fromCharCode(c)).join('')); return b.replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); };
const b64d=(s:string)=>{ let t=s.replace(/-/g,'+').replace(/_/g,'/'); while(t.length%4) t+='='; return new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(atob(t),c=>c.charCodeAt(0))); };

export function exportBuild(s:Save):BuildExport{
  const slots:BuildSlots={}; for(const sl of SLOTS){ const u=s.installed[sl]; const it=u?s.items.find(i=>i.uid===u):undefined; if(it) slots[sl]={ d:it.def, c:[...it.chips] }; }
  const picks=s.abPick; const tr=[(s as any).traits?.l10?.id,(s as any).traits?.l20?.id].filter((x:any)=>typeof x==='string'); return { v:1, game:BUILD_ID, cat:CATALOG_VERSION, lvl:s.level|0, slots, ...(Array.isArray(picks)?{picks:picks.slice(0,3)}:{}), ...(tr.length?{traits:tr}:{}), ...((s as any).idkfa?.on?{cheat:true as const}:{}), ...exOf(s), ...(()=>{ const t=publicTrophies(s).slice(-3).map(x=>({n:x.name,l:x.line,t:x.at})); return t.length?{trophies:t}:{}; })() };
}
function exOf(s:Save){ const own=(s as any).cosmetics?.owned||{}; const ex=Object.keys(own).filter(isExclusive).sort((a,b)=>own[a]-own[b]).slice(0,8).map(id=>({ id, at:Number(own[id])||0, badge:badgeOf(id) })); return ex.length?{ex}:{}; }
export const encodeBuild=(b:BuildExport)=>BUILD_CODE_PREFIX+b64e(JSON.stringify(b));
const ID=/^[A-Za-z0-9_-]{1,64}$/;
/** Strict validation. Unknown item/chip ids are ALLOWED (they may come from another catalog version) but must be well-formed; diffBuild reports them. */
export function decodeBuild(input:string):{ok:true;build:BuildExport}|{ok:false;why:string}{
  if(typeof input!=='string') return {ok:false,why:'not a string'}; let code=input.trim();
  const m=/[?&]build=([^&#\s]+)/.exec(code); if(m) code=decodeURIComponent(m[1]);
  if(code.length>BUILD_CODE_MAX) return {ok:false,why:'code too long'}; if(!code.startsWith(BUILD_CODE_PREFIX)) return {ok:false,why:'not a Warranty Void build code (expected WVB1.)'};
  const body=code.slice(BUILD_CODE_PREFIX.length); if(!/^[A-Za-z0-9_-]+$/.test(body)) return {ok:false,why:'invalid characters'};
  let j:any; try{ j=JSON.parse(b64d(body)); }catch{ return {ok:false,why:'corrupt code'}; }
  if(!j||typeof j!=='object'||Array.isArray(j)) return {ok:false,why:'corrupt code'}; if(j.v!==1) return {ok:false,why:'unsupported build code version '+j.v};
  if(typeof j.game!=='string'||j.game.length>64) return {ok:false,why:'missing game version'}; if(typeof j.cat!=='string'||!/^[a-f0-9]{6,64}$/.test(j.cat)) return {ok:false,why:'missing catalog version'};
  if(!Number.isInteger(j.lvl)||j.lvl<1||j.lvl>99) return {ok:false,why:'bad level'};
  if(!j.slots||typeof j.slots!=='object'||Array.isArray(j.slots)) return {ok:false,why:'bad slots'};
  const slots:BuildSlots={}; for(const [sl,v] of Object.entries<any>(j.slots)){ if(!(SLOTS as string[]).includes(sl)) return {ok:false,why:'unknown slot '+String(sl).slice(0,20)};
    if(!v||typeof v.d!=='string'||!ID.test(v.d)||!Array.isArray(v.c)||v.c.length>8||!v.c.every((c:any)=>typeof c==='string'&&ID.test(c))) return {ok:false,why:'bad entry in '+sl}; slots[sl]={d:v.d,c:[...v.c]}; }
  let picks:(string|null)[]|undefined; if(j.picks!=null){ if(!Array.isArray(j.picks)||j.picks.length>3||!j.picks.every((p:any)=>p===null||(typeof p==='string'&&ID.test(p)))) return {ok:false,why:'bad ability picks'}; picks=j.picks; }
  if(j.cheat!=null&&j.cheat!==true) return {ok:false,why:'bad cheat flag'};
  let traits:string[]|undefined; if(j.traits!=null){ if(!Array.isArray(j.traits)||j.traits.length>2||!j.traits.every((p:any)=>typeof p==='string'&&ID.test(p))) return {ok:false,why:'bad traits'}; traits=[...j.traits]; }
  let trophies:{n:string;l:string;t:number}[]|undefined; if(j.trophies!=null){ if(!Array.isArray(j.trophies)||j.trophies.length>3||!j.trophies.every((x:any)=>x&&typeof x.n==='string'&&x.n.length<=40&&typeof x.l==='string'&&x.l.length<=90&&Number.isFinite(x.t)&&!/[<>]/.test(x.n+x.l))) return {ok:false,why:'bad trophies'}; trophies=j.trophies.map((x:any)=>({n:x.n,l:x.l,t:x.t})); }
  let ex:BuildExport['ex']; if(j.ex!=null){ if(!Array.isArray(j.ex)||j.ex.length>8||!j.ex.every((e:any)=>e&&typeof e.id==='string'&&ID.test(e.id)&&Number.isFinite(e.at)&&typeof e.badge==='string'&&e.badge.length<16)) return {ok:false,why:'bad exclusives'}; ex=j.ex.map((e:any)=>({id:e.id,at:+e.at,badge:e.badge})); }
  return {ok:true,build:{v:1,game:j.game,cat:j.cat,lvl:j.lvl,slots,...(picks?{picks}:{}),...(traits?{traits}:{}),...(j.cheat?{cheat:true as const}:{}),...(ex?{ex}:{}),...(trophies?{trophies}:{})}};
}
export function buildUrl(code:string, base=(typeof location!=='undefined'?location.origin+location.pathname:'https://play.seanwylie.ca/')){ return base+'?build='+encodeURIComponent(code); }
/** Layout for computeBuild from an export: only ids that exist in THIS catalog; chips that no longer fit are dropped (diffBuild reports both). */
export function layoutOf(b:BuildExport):Layout{ const L:Layout={}; for(const [sl,v] of Object.entries(b.slots)){ if(!ITEM_BY_ID[v.d]) continue; L[sl as Slot]={uid:'p'+sl,def:v.d,chips:v.c.filter(c=>(CHIPS as any)[c]) as any}; } return L; }
export const abName=(a:string)=>ABILITY_BY_ID[a]?.name||(ABILITIES as any)[a]?.name||a;
/** Readable text/markdown summary (Copy). */
export function buildText(b:BuildExport):string{
  const r=computeBuild(layoutOf(b),b.lvl,{HI:0,PS:0,MM:0} as any,[],b.picks||null); const st=r.stats;
  const lines=[`# Warranty Void build (Lv ${b.lvl})${b.cheat?' [IDKFA CHEAT]':''}`,`Game ${b.game} · catalog ${b.cat}`,'',...SLOTS.filter(sl=>b.slots[sl]).map(sl=>{ const v=b.slots[sl]!, d=ITEM_BY_ID[v.d]; return `- ${SLOT_LABEL[sl]}: ${d?d.name+' ('+d.rarity+', '+MFR[d.mfr].name+')':v.d+' (unknown in this catalog)'}${v.c.length?' · chips: '+v.c.map(c=>(CHIPS as any)[c]?.name||c).join(', '):''}`; }),'',
    `Abilities: ${r.abilities.map(abName).join(', ')||'none'}`,...(b.traits?.length?[`Traits: ${b.traits.map(t=>TRAIT_BY_ID[t]?TRAIT_BY_ID[t].name+' ('+TRAIT_BY_ID[t].effects.map(describeEffect).join('; ')+')':t+' (unknown in this catalog)').join(', ')}`]:[]),`HP ${Math.round(st.maxHp)} · DMG x${st.dmg.toFixed(2)} · ATK x${st.atkSpeed.toFixed(2)} · COOL x${st.cooling.toFixed(2)} · MOVE x${st.move.toFixed(2)} · ARM ${st.armor.toFixed(1)}`,
    `Weapon: ${r.weaponName}`,...(b.trophies?.length?['Trophies: '+b.trophies.map(t=>t.n+' ('+t.l+')').join('; ')]:[]),...(b.ex?.length?['Exclusives: '+b.ex.map(e=>(COS_BY_ID[e.id]?.name||e.id)+' ['+(e.badge||'Exclusive')+'] '+provenance(e.id,e.at)).join('; ')]:[]),r.mix.mfrs.length>1?`Mixed makers: -${Math.round(r.mix.coolingPenalty*100)}% cooling`:'',r.conflicts.length?'Conflicts: '+r.conflicts.join('; '):'' ];
  return lines.filter((l,i)=>l!==''||i<4).join('\n').trim()+'\n';
}
export function exportJson(s:Save){ return JSON.stringify(exportBuild(s),null,1); }
