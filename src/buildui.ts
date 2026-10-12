// Build inspector (locker -> "Build"): equipped augments, chips, abilities, totals, active synergies; export as code / link / JSON / text,
// and a read-only preview of a shared build code (?build=). A code from another catalog version shows a "What changed" notice (never silent).
import { SLOTS, ITEM_BY_ID, CHIPS, SLOT_LABEL, MFR, RARITY_COLOR, type Slot } from './config';
import { computeBuild } from './build';
import { ABILITY_BY_ID, describe } from './abilities/registry';
import { exportBuild, encodeBuild, decodeBuild, buildUrl, buildText, layoutOf, abName, type BuildExport } from './buildcode';
import { snapshot, diffBuild, type Change, type Snap } from './catalog_snap';
import { TRAIT_BY_ID, describeEffect } from './traits';
import { CATALOG_VERSION } from './catalog_version';
type UIx = any;
const esc=(s:string)=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]!));
export interface BdState { preview:BuildExport|null; diff:Change[]|'loading'|'unavailable'|null; msg:string; importText:string }
export const bd=(ui:UIx):BdState=>ui._bd||(ui._bd={preview:null,diff:null,msg:'',importText:''});
let curSnap:Snap|null=null; const cur=()=>curSnap||(curSnap=snapshot());
const snapCache:Record<string,Snap>={};
export async function loadSnap(cat:string, fetcher:(u:string)=>Promise<any>=u=>fetch(u).then(r=>r.ok?r.json():null)):Promise<Snap|null>{ if(cat===CATALOG_VERSION) return cur(); if(snapCache[cat]) return snapCache[cat];
  try{ const base=((import.meta as any).env?.BASE_URL as string)||'/'; const j=await fetcher(base+'catalog/v/'+cat+'.json'); if(j&&j.items){ snapCache[cat]=j; return j; } }catch{} return null; }
/** Diff for a shared build: [] when same catalog, the changes, or 'unavailable' when the old snapshot cannot be found (shown as a warning, never silent). */
export async function whatChanged(b:BuildExport, fetcher?:(u:string)=>Promise<any>):Promise<Change[]|'unavailable'>{ if(b.cat===CATALOG_VERSION) return []; const old=await loadSnap(b.cat,fetcher); if(!old) return 'unavailable'; return diffBuild(old,cur(),b.slots,b.traits||[]); }
export function synergiesOf(abs:string[]):string[]{ const out:string[]=[]; for(const x of abs) for(const y of abs){ if(x===y) continue; const a=ABILITY_BY_ID[x], b=ABILITY_BY_ID[y]; if(!a||!b) continue; for(const t of a.gives||[]) if((b.uses||[]).includes(t)) out.push(`${a.name} → ${b.name} (${t})`); } return [...new Set(out)]; }

export function buildHtml(ui:UIx):string{ const g=ui.g, s=g.save, st=bd(ui); const b:BuildExport=st.preview||exportBuild(s); const preview=!!st.preview;
  const r=computeBuild(layoutOf(b),b.lvl,preview?{HI:0,PS:0,MM:0}:s.rep,[],b.picks??(preview?null:s.abPick??null)); const S=r.stats;
  const tile=(sl:Slot)=>{ const v=b.slots[sl]; const d=v&&ITEM_BY_ID[v.d]; if(!v) return `<div class="slot tile st bdt empty" data-tip="${esc(SLOT_LABEL[sl]+': empty')}" aria-label="${esc(SLOT_LABEL[sl])} empty"><span class="bdsl">${esc(SLOT_LABEL[sl])}</span></div>`;
    if(!d) return `<div class="slot tile st bdt missing" data-tip="${esc('<b>'+esc(v.d)+'</b><br>Not in this catalog version')}" aria-label="${esc(SLOT_LABEL[sl])}: unknown augment"><span class="bdsl">?</span></div>`;
    const chips=v.c.map(c=>esc((CHIPS as any)[c]?.name||c)); const stl=Object.entries(d.stats).map(([k,x])=>`${k} ${(x as number)>0?'+':''}${x}`).join(' · ');
    const tip='<b style="color:'+RARITY_COLOR[d.rarity]+'">'+esc(d.name)+'</b><br>'+esc(SLOT_LABEL[sl])+' · '+d.rarity+' · '+esc(MFR[d.mfr].name)+' · Lv '+d.lvl+(stl?'<br>'+esc(stl):'')+(d.abilities?.length?'<br>Abilities: '+d.abilities.map(a=>esc(abName(a))).join(', '):'')+(chips.length?'<br>Chips: '+chips.join(', '):'');
    return `<div class="slot tile st bdt" data-def="${d.id}" data-slot="${sl}" tabindex="0" data-tip="${esc(tip)}" aria-label="${esc(SLOT_LABEL[sl]+': '+d.name+(chips.length?', '+chips.length+' chips':''))}"><span class="ticon"></span>${v.c.length?`<span class="bdchips" aria-hidden="true">${v.c.length}</span>`:''}</div>`; };
  const abs=r.abilities.map(a=>{ const d=ABILITY_BY_ID[a]; return `<span class="bdab" tabindex="0" data-tip="${esc('<b>'+esc(abName(a))+'</b>'+(d?'<br>'+esc(describe(d))+'<br>cd '+d.cd+'s':''))}">${esc(abName(a))}</span>`; }).join('');
  const syn=synergiesOf(r.granted); const notes=[...syn.map(x=>'Combo: '+x), ...(r.mix.mfrs.length>1?[`Mixed makers: −${Math.round(r.mix.coolingPenalty*100)}% cooling`]:r.mix.mfrs.length===1?[`Single maker set (${MFR[r.mix.mfrs[0]].name}): no mixing penalty`]:[]), ...r.conflicts.map((c:string)=>'Conflict: '+c)];
  const totals=`HP ${Math.round(S.maxHp)} · DMG ×${S.dmg.toFixed(2)} · ATK ×${S.atkSpeed.toFixed(2)} · COOL ×${S.cooling.toFixed(2)} · MOVE ×${S.move.toFixed(2)} · ARM ${S.armor.toFixed(1)} · REGEN ${S.regen.toFixed(1)}/s`;
  let notice=''; if(preview&&b.cat!==CATALOG_VERSION){ const d=st.diff;
    notice=d==='loading'||d===null?`<div class="bdnotice" role="status">Checking what changed since catalog ${esc(b.cat)}…</div>`:d==='unavailable'?`<div class="bdnotice warn" role="alert"><b>What changed</b>: this build was made with catalog ${esc(b.cat)}, which this game can't find. Stats below use today's data and may differ from the original.</div>`
      :`<div class="bdnotice${d.some(x=>x.incompatible)?' warn':''}" role="alert"><b>What changed</b> since catalog ${esc(b.cat)} (now ${CATALOG_VERSION}): ${d.length?`<ul>${d.map(x=>`<li class="${x.incompatible?'bdinc':''}" data-kind="${x.kind}">${x.incompatible?'<b>Incompatible:</b> ':''}${esc(x.text)}</li>`).join('')}</ul>`:'nothing that affects this build.'}</div>`; }
  else if(preview&&b.game!==ui.buildId) notice=`<div class="bdnotice" role="status">Made with game ${esc(b.game)}; same catalog, so augments behave the same.</div>`;
  return `<div class="col bdcol">${preview?`<div class="bdmode"><b>Shared build</b> · read-only preview, nothing is granted <button class="btn mini" data-act="bd-mine">Back to my build</button></div>`:''}
    ${b.cheat?'<div class="bdnotice warn bdcheat" role="status"><b>IDKFA cheat build</b>: made with dev cheat gear, not a real loadout.</div>':''}<div class="mut bdver">Level ${b.lvl} · game ${esc(b.game)} · catalog ${esc(b.cat)}</div>${notice}${b.traits?.length?`<div class="bdtraits"><b>Traits</b> ${b.traits.map(t=>{ const d=TRAIT_BY_ID[t]; return `<span class="trchip" tabindex="0" data-tip="${esc(d?'<b>'+esc(d.name)+'</b><br>'+d.effects.map(e=>esc(describeEffect(e))).join('<br>'):esc(t)+' (unknown trait)')}">${esc(d?d.short:t)}</span>`; }).join(' ')}</div>`:''}
    <div class="bdgrid">${SLOTS.map(tile).join('')}</div>
    <h3 class="sh">Abilities</h3><div class="bdabs">${abs||'<span class="mut">none</span>'}</div>
    <h3 class="sh">Totals</h3><div class="bdtot" data-tip="${esc(totals+'<br>Weapon: '+esc(r.weaponName))}">${esc(totals)}</div>
    <h3 class="sh">Synergies</h3><div class="bdsyn">${notes.length?notes.map(n=>`<span class="bdnote">${esc(n)}</span>`).join(''):'<span class="mut">none active</span>'}</div>
    <div class="actrow bdact"><button class="btn" data-act="bd-code" data-tip="Copy a short build code">Copy code</button><button class="btn" data-act="bd-link" data-tip="Copy a ?build= link">Copy link</button><button class="btn" data-act="bd-text" data-tip="Copy a readable summary">Copy text</button><button class="btn" data-act="bd-json" data-tip="Download JSON">JSON</button></div>
    <div class="actrow bdimp"><input id="bdin" type="text" placeholder="Paste a build code or link" aria-label="Build code or link" value="${esc(st.importText)}"><button class="btn" data-act="bd-view">View</button></div>
    <div class="mut" id="bdmsg" role="status" aria-live="polite">${esc(st.msg)}</div></div>`; }

async function copy(ui:UIx, txt:string, what:string){ const st=bd(ui); try{ await navigator.clipboard.writeText(txt); st.msg=what+' copied.'; }catch{ st.msg='Copy failed. Select and copy manually: '+txt.slice(0,80); } ui.render(); }
export async function viewCode(ui:UIx, code:string):Promise<string|null>{ const st=bd(ui); const r=decodeBuild(code); if(!r.ok){ st.msg='Not a valid build code: '+r.why; if(ui.modal==='build') ui.render(); return r.why; }
  st.preview=r.build; st.diff=r.build.cat===CATALOG_VERSION?[]:'loading'; st.msg=''; ui.open?ui.open('build'):ui.render(); const d=await whatChanged(r.build); if(st.preview===r.build){ st.diff=d; if(ui.modal==='build') ui.render(); } return null; }
export function buildClick(ui:UIx, el:HTMLElement, a:string):boolean{ const st=bd(ui), s=ui.g.save; const b=()=>st.preview||exportBuild(s);
  switch(a){ case 'bd-open': st.preview=null; st.diff=null; st.msg=''; ui.open('build'); return true; case 'bd-mine': st.preview=null; st.diff=null; st.msg=''; ui.render(); return true;
    case 'bd-code': copy(ui,encodeBuild(b()),'Build code'); return true; case 'bd-link': copy(ui,buildUrl(encodeBuild(b())),'Link'); return true; case 'bd-text': copy(ui,buildText(b()),'Summary'); return true;
    case 'bd-json': { const blob=new Blob([JSON.stringify(b(),null,1)],{type:'application/json'}); const u=URL.createObjectURL(blob); const x=document.createElement('a'); x.href=u; x.download='warranty-void-build.json'; x.click(); setTimeout(()=>URL.revokeObjectURL(u),2000); st.msg='JSON downloaded.'; ui.render(); return true; }
    case 'bd-view': { const v=(document.getElementById('bdin') as HTMLInputElement|null)?.value||''; st.importText=v; viewCode(ui,v); return true; } }
  void el; return false; }
/** Dev console helper: wvBuild.code(), .url(), .text(), .json(), .view(code), .diff(code) */
export function installBuildConsole(ui:UIx){ (window as any).wvBuild={ export:()=>exportBuild(ui.g.save), code:()=>encodeBuild(exportBuild(ui.g.save)), url:()=>buildUrl(encodeBuild(exportBuild(ui.g.save))), text:()=>buildText(exportBuild(ui.g.save)), json:()=>JSON.stringify(exportBuild(ui.g.save),null,1),
  decode:decodeBuild, view:(c:string)=>viewCode(ui,c), diff:async(c:string)=>{ const r=decodeBuild(c); return r.ok?whatChanged(r.build):r.why; }, catalog:CATALOG_VERSION }; }
