// Locker / codex UI helpers for the augment abilities: ability slot assignment (Q/E/R), rich hover details, and the Abilities codex.
import { ABILITIES, ABILITY_TYPE_COLOR, ABILITY_TYPE_LABEL, ITEMS, MFR, RARITY_COLOR, RARITY_RANK, STARTER_ABILITIES, ABILITY_TYPE } from '../config';
import type { BuildResult } from '../build';
import type { Save } from '../state';
import { ABILITY_BY_ID, ABILITY_DATA, ROLE_LABEL } from './registry';
import { ABILITY_ACQ, chipsFor } from './hw';
import { CHIPS } from '../config';
import { esc } from '../esc';
const KEYS=['Q','E','R'];
export const abIcon=(id:string)=>'abilities/'+id+'.webp';
/** Inline type-coloured glyph used if an ability icon file is missing (every ability also ships a generated medallion). */
export function abFallbackIcon(id:string):string{ const t=ABILITY_TYPE[id]||'attack'; const c=ABILITY_TYPE_COLOR[t]; const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="29" fill="#201d1a" stroke="${c}" stroke-width="4"/><text x="32" y="42" font-size="28" text-anchor="middle" fill="${c}" font-family="monospace">${esc((ABILITIES[id]?.name||'?')[0])}</text></svg>`; return 'data:image/svg+xml;utf8,'+encodeURIComponent(svg); }
export const imgTag=(id:string,cls='')=>`<img class="${cls}" src="${abIcon(id)}" alt="" onerror="this.onerror=null;this.src='${abFallbackIcon(id).replace(/'/g,'%27')}'">`;
const rarityOf=(id:string):string=>ABILITIES[id]?.rarity||ITEMS.filter(i=>i.abilities?.includes(id)).sort((a,b)=>RARITY_RANK[a.rarity]-RARITY_RANK[b.rarity])[0]?.rarity||'grey';
/** Full hover text for one ability. */
export function abTip(id:string,withChips=true):string{ const d=ABILITIES[id]; if(!d) return ''; const x=ABILITY_BY_ID[id]; const rar=rarityOf(id);
  let h=`<b style="color:${RARITY_COLOR[rar as keyof typeof RARITY_COLOR]}">${esc(d.name)}</b> <i style="color:${ABILITY_TYPE_COLOR[d.type]}">${ABILITY_TYPE_LABEL[d.type]}</i> <span class="mut">${rar}</span><br>${esc(d.desc)}<br><span class="mut">Heat ${d.heat} · Cooldown ${d.cd}s${d.range?' · Range '+d.range:''}</span>`;
  if(x){ h+=`<br><span class="mut">${esc(ROLE_LABEL[x.role])} · ${esc(MFR[x.mfr].short)} · aim: ${x.shape} · scales with ${x.scale}</span>`;
    if(x.gives.length) h+=`<br>Applies: ${x.gives.join(', ')}`; if(x.uses.length) h+=`<br>Combo with: ${x.uses.join(', ')}`; if(x.toggle) h+='<br>Toggle: press again to switch off.';
    if(withChips){ const c=chipsFor(x).filter(k=>!['speed','fineedge','coolant','quench'].includes(k)).map(k=>CHIPS[k as keyof typeof CHIPS]?.name).filter(Boolean); if(c.length) h+=`<br><span class="mut">Chips that change it: ${esc(c.join(', '))}</span>`; }
    h+=`<br><i class="mut">${esc(x.flavor)}</i>`; }
  return h; }
export const abChipX=(id:string)=>{ const d=ABILITIES[id]; if(!d) return ''; return `<span class="abchip" data-tip="${esc(abTip(id))}" style="--tc:${ABILITY_TYPE_COLOR[d.type]}">${imgTag(id)}${esc(d.name)}</span>`; };
/** The Q/E/R assignment strip with cycle buttons, plus the granted-but-unbound list. */
export function abSlotsHtml(b:BuildResult):string{
  const slots=[0,1,2].map(i=>{ const id=b.abilities[i]; const d=id?ABILITIES[id]:null; const can=b.granted.length>1;
    return `<div class="abslot" ${d?`data-tip="${esc(abTip(id))}"`:''}><span class="abkey">${KEYS[i]}</span>${d?imgTag(id,'abslotimg'):'<span class="abslotimg empty"></span>'}<span class="abslotname">${d?esc(d.name):'<i class="mut">empty</i>'}</span>${can?`<button class="btn mini" data-act="abcycle" data-i="${i}" data-d="-1" title="Previous ability" aria-label="Previous ability for ${KEYS[i]}">◀</button><button class="btn mini" data-act="abcycle" data-i="${i}" data-d="1" title="Next ability" aria-label="Next ability for ${KEYS[i]}">▶</button>`:''}</div>`; }).join('');
  const rest=b.extraAbilities.length?`<div class="abrest"><span class="mut">Also granted (not bound):</span> ${b.extraAbilities.map(abChipX).join(' ')}</div>`:'';
  return `<div class="abslots"><div class="abhead"><b>Ability slots</b> <span class="mut">${b.granted.length} granted · Shift+Q/E/R swaps in play · <button class="btn mini" data-act="codex">Abilities codex</button> <button class="btn mini" data-act="bd-open" data-tip="Inspect, share or export this build">Build</button> <button class="btn mini" data-act="ll-open" data-tip="Your epic, legendary and seasonal finds, plus Prism Shards">Loot log</button></span></div><div class="abslotrow">${slots}</div>${rest}</div>`; }
/** Cycle which granted ability is on button i in a build; returns the new picks array. */
export function cyclePicks(b:BuildResult,i:number,dir:number):(string|null)[]|null{ const cur:(string|null)[]=[0,1,2].map(k=>b.abilities[k]||null); const free=b.granted.filter(a=>!cur.includes(a)||a===cur[i]); if(free.length<2) return null; const nx=free[(Math.max(0,free.indexOf(cur[i] as string))+dir+free.length)%free.length]; cur[i]=nx; return cur; }
export function codexRows(s:Save){ const known=s.codex||{}; const ids=[...new Set([...STARTER_ABILITIES,...Object.keys(ABILITIES)])];
  return ids.map(id=>({ id, def:ABILITIES[id], rarity:rarityOf(id), found:known[id]!==undefined, ext:!!ABILITY_BY_ID[id] })).sort((a,b)=>RARITY_RANK[a.rarity as keyof typeof RARITY_RANK]-RARITY_RANK[b.rarity as keyof typeof RARITY_RANK]||a.def.name.localeCompare(b.def.name)); }
export function codexHtml(s:Save):string{ const rows=codexRows(s); const n=rows.filter(r=>r.found).length;
  const hint=(r:{id:string;rarity:string})=>{ const rk=ABILITY_ACQ.rankGate[r.rarity as keyof typeof ABILITY_ACQ.rankGate]; const src=r.rarity==='orange'?'Bosses only':r.rarity==='purple'?'Elites and bosses':r.rarity==='blue'?'Elites, bosses, vendor':'Anywhere, vendor'; return `${src}${rk?` · needs manufacturer reputation rank ${rk}`:''}`; };
  const card=(r:ReturnType<typeof codexRows>[number])=>{ const col=RARITY_COLOR[r.rarity as keyof typeof RARITY_COLOR]; const x=ABILITY_BY_ID[r.id];
    return r.found?`<div class="cdx found" style="border-color:${col}" data-tip="${esc(abTip(r.id))}">${imgTag(r.id,'cdxi')}<div><b style="color:${col}">${esc(r.def.name)}</b><span class="mut">${r.rarity} · ${esc(x?ROLE_LABEL[x.role]:ABILITY_TYPE_LABEL[r.def.type])}${x?' · '+esc(MFR[x.mfr].short):''}</span></div></div>`
      :`<div class="cdx lost" style="border-color:${col}55" data-tip="${esc('<b>Undiscovered '+r.rarity+' ability</b><br>'+hint(r))}"><span class="cdxi q">?</span><div><b class="mut">???</b><span class="mut">${r.rarity} · ${esc(hint(r))}</span></div></div>`; };
  return `<div class="col wide"><h3>Abilities codex: ${n} / ${rows.length} discovered</h3><div class="mut">Common abilities come from grey and green hardware and show up early; rare ones (purple, orange) drop from elites and bosses and need reputation.</div><div class="cdxgrid">${rows.map(card).join('')}</div><button class="btn" data-act="codexclose">Back to locker</button></div>`; }
