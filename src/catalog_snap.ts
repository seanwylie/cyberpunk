// Compact catalog snapshot (what a build depends on) + diff between catalog versions.
// tools/gen_catalog.mjs hashes snapshot() into CATALOG_VERSION (src/catalog_version.ts) and keeps every version's snapshot in
// public/catalog/v/<version>.json, so a build code made under an older catalog can be compared with the current one ("What changed").
import { ITEMS, CHIPS, CHIP_FITS, SLOT_SOCKETS, HARD_CONFLICTS, ABILITIES, type Slot } from './config';
import { ABILITY_BY_ID, describe } from './abilities/registry';

export interface SnapItem { n:string; s:string; m:string; r:string; l:number; st:Record<string,number>; ab:string[]; w?:string }
export interface SnapChip { n:string; st:Record<string,number>; f:string[] }
export interface SnapAb { n:string; cd:number|null; e:string; g:string[]; u:string[] }
export interface Snap { items:Record<string,SnapItem>; chips:Record<string,SnapChip>; abilities:Record<string,SnapAb>; sockets:Record<string,number>; conflicts:[string,string,string][] }
const sortObj=<T>(o:Record<string,T>)=>Object.fromEntries(Object.keys(o).sort().map(k=>[k,o[k]]));
const num=(o:any)=>sortObj(Object.fromEntries(Object.entries(o||{}).map(([k,v])=>[k,Math.round((v as number)*1e4)/1e4]))) as Record<string,number>;
export function snapshot():Snap{
  const items:Record<string,SnapItem>={}; for(const d of ITEMS){ items[d.id]={ n:d.name, s:d.slot, m:d.mfr, r:d.rarity, l:d.lvl, st:num(d.stats), ab:[...(d.abilities||[])], ...(d.weapon?{w:d.weapon}:{}) }; }
  const chips:Record<string,SnapChip>={}; for(const [id,c] of Object.entries(CHIPS)) chips[id]={ n:c.name, st:num(c.stats), f:[...(CHIP_FITS[id as keyof typeof CHIP_FITS]||[])] };
  const abilities:Record<string,SnapAb>={}; for(const id of new Set([...Object.keys(ABILITIES),...Object.keys(ABILITY_BY_ID)])){ const d=ABILITY_BY_ID[id], a=(ABILITIES as any)[id]; abilities[id]={ n:d?.name||a?.name||id, cd:d?.cd??a?.cd??null, e:d?describe(d):(a?.desc||''), g:[...(d?.gives||[])], u:[...(d?.uses||[])] }; }
  return { items:sortObj(items), chips:sortObj(chips), abilities:sortObj(abilities), sockets:sortObj({...SLOT_SOCKETS}), conflicts:HARD_CONFLICTS.map(c=>[c.a,c.b,c.reason] as [string,string,string]).sort((x,y)=>(x[0]+x[1]).localeCompare(y[0]+y[1])) };
}
const GROUP:Record<string,string>={ handL:'hand',handR:'hand',armL:'arm',armR:'arm',legL:'leg',legR:'leg',footL:'foot',footR:'foot',torso:'torso',face:'face',brain:'brain' };
export interface BuildSlots { [slot:string]:{ d:string; c:string[] } }
export type ChangeKind='removed'|'renamed'|'stats'|'abilities'|'ability'|'chip_removed'|'chip_renamed'|'chip_stats'|'chip_fit'|'sockets'|'conflict'|'combo';
export interface Change { kind:ChangeKind; slot?:string; id:string; text:string; incompatible:boolean }
const fmt=(o:Record<string,number>)=>Object.entries(o).map(([k,v])=>`${k} ${v>0?'+':''}${v}`).join(', ')||'none';
/** What changed for THIS build between the catalog it was made with (old) and the current one (cur). Incompatible = the build cannot be shown as it was. */
export function diffBuild(old:Snap, cur:Snap, slots:BuildSlots):Change[]{
  const out:Change[]=[]; const add=(c:Change)=>out.push(c);
  const abSeen=new Set<string>();
  for(const [sl,v] of Object.entries(slots)){ const o=old.items[v.d], n=cur.items[v.d];
    if(!n){ add({kind:'removed',slot:sl,id:v.d,text:`${o?.n||v.d} no longer exists`,incompatible:true}); }
    else if(o){ if(o.n!==n.n) add({kind:'renamed',slot:sl,id:v.d,text:`${o.n} is now called ${n.n}`,incompatible:false});
      if(JSON.stringify(o.st)!==JSON.stringify(n.st)) add({kind:'stats',slot:sl,id:v.d,text:`${n.n} stats: ${fmt(o.st)} → ${fmt(n.st)}`,incompatible:false});
      if(JSON.stringify(o.ab)!==JSON.stringify(n.ab)) add({kind:'abilities',slot:sl,id:v.d,text:`${n.n} abilities: ${o.ab.map(a=>old.abilities[a]?.n||a).join(', ')||'none'} → ${n.ab.map(a=>cur.abilities[a]?.n||a).join(', ')||'none'}`,incompatible:false});
      for(const a of o.ab){ if(abSeen.has(a)) continue; abSeen.add(a); const oa=old.abilities[a], na=cur.abilities[a]; if(oa&&na&&(oa.cd!==na.cd||oa.e!==na.e)) add({kind:'ability',slot:sl,id:a,text:`${na.n}: ${oa.cd!==na.cd?`cooldown ${oa.cd}s → ${na.cd}s`:''}${oa.cd!==na.cd&&oa.e!==na.e?'; ':''}${oa.e!==na.e?`effect "${oa.e}" → "${na.e}"`:''}`,incompatible:false}); } }
    const cap=cur.sockets[sl]??0; if(v.c.length>cap) add({kind:'sockets',slot:sl,id:v.d,text:`${sl} now has ${cap} sockets, the build used ${v.c.length}`,incompatible:true});
    for(const c of v.c){ const oc=old.chips[c], nc=cur.chips[c];
      if(!nc){ add({kind:'chip_removed',slot:sl,id:c,text:`Chip ${oc?.n||c} no longer exists`,incompatible:true}); continue; }
      if(oc&&oc.n!==nc.n) add({kind:'chip_renamed',slot:sl,id:c,text:`Chip ${oc.n} is now called ${nc.n}`,incompatible:false});
      if(oc&&JSON.stringify(oc.st)!==JSON.stringify(nc.st)) add({kind:'chip_stats',slot:sl,id:c,text:`Chip ${nc.n}: ${fmt(oc.st)} → ${fmt(nc.st)}`,incompatible:false});
      if(!nc.f.includes(GROUP[sl])) add({kind:'chip_fit',slot:sl,id:c,text:`Chip ${nc.n} no longer fits ${sl} (fits ${nc.f.join(', ')})`,incompatible:true}); } }
  const ids=new Set(Object.values(slots).map(v=>v.d));
  for(const [a,b,why] of cur.conflicts) if(ids.has(a)&&ids.has(b)&&!old.conflicts.some(x=>x[0]===a&&x[1]===b)) add({kind:'conflict',id:a+'+'+b,text:`${cur.items[a]?.n||a} and ${cur.items[b]?.n||b} can no longer be worn together: ${why}`,incompatible:true});
  // combos: tag pairs (gives -> uses) among the build's abilities that existed before but not now
  const combos=(S:Snap)=>{ const abs=[...new Set(Object.values(slots).flatMap(v=>S.items[v.d]?.ab||[]))]; const set=new Set<string>(); for(const x of abs) for(const y of abs) if(x!==y) for(const t of S.abilities[x]?.g||[]) if(S.abilities[y]?.u.includes(t)) set.add(`${x}>${y}:${t}`); return set; };
  const oc=combos(old), nc=combos(cur); for(const k of oc) if(!nc.has(k)){ const [xy,t]=k.split(':'); const [x,y]=xy.split('>'); add({kind:'combo',id:k,text:`Combo lost: ${old.abilities[x]?.n||x} no longer sets up ${old.abilities[y]?.n||y} (${t})`,incompatible:true}); }
  return out;
}
export type { Slot };
