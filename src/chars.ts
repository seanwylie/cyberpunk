// Multiple characters (docs/CHARACTERS.md). Up to CHAR_LIMIT characters per account (browser profile), picked on load.
// Storage: roster (ROSTER_KEY) = summaries + active id + ACCOUNT-WIDE data; one save per character (CHAR_KEY(id)).
// The legacy single-save key ('arpg-proto-save-v1') always mirrors the ACTIVE character, so every existing system (tests, net, IDKFA) keeps working.
// Per character: everything in Save except the ACCOUNT fields below (level, XP, traits, equipment, inventory, bank, rep, story, journal, action log, IDKFA).
// Account-wide: cosmetic unlocks, purchased locker capacity, store receipts, settings. Persist across seasons.
export const CHAR_LIMIT=10;
export const ROSTER_KEY='wv_roster_v1';
export const LEGACY_KEY='arpg-proto-save-v1';
export const CHAR_KEY=(id:string)=>'wv_char_'+id;
export interface CharSummary { id:string; name:string; level:number; created:number; played:number; trait1?:string|null; trait2?:string|null; /** last town id (src/towns.ts) */ town?:string; /** auto-made on a first boot with no save: the selector opens straight into naming it */ fresh?:boolean }
export interface Account { settings?:any; purchases?:{ lockerBlocks:number; skins:string[] }; store?:any; cosOwned?:Record<string,number>; cosSeen?:Record<string,number>; cosOutfits?:any[]; /** account mailbox (src/mail.ts) */ mail?:any[] }
export interface Roster { v:1; active:string; chars:CharSummary[]; account:Account; nextN:number }
type KV={ get(k:string):string|null; set(k:string,v:string):void; del(k:string):void };
export const lsKV:KV={ get:k=>{ try{ return localStorage.getItem(k); }catch{ return null; } }, set:(k,v)=>{ try{ localStorage.setItem(k,v); }catch{} }, del:k=>{ try{ localStorage.removeItem(k); }catch{} } };
const newId=()=>Math.random().toString(36).slice(2,8)+Date.now().toString(36).slice(-4);
export function readRoster(kv:KV=lsKV):Roster|null{ try{ const r=JSON.parse(kv.get(ROSTER_KEY)||'null'); if(r&&r.v===1&&Array.isArray(r.chars)) return r; }catch{} return null; }
export function writeRoster(r:Roster,kv:KV=lsKV){ kv.set(ROSTER_KEY,JSON.stringify(r)); }
/** Ensure a roster exists. First run after the update: the existing single save becomes character 1 (nothing lost, the raw JSON is copied verbatim). */
export function ensureRoster(kv:KV=lsKV):Roster{ let r=readRoster(kv); if(r&&r.chars.length) { if(!r.chars.some(c=>c.id===r!.active)) r.active=r.chars[0].id; return r; }
  const id=newId(); const legacy=kv.get(LEGACY_KEY); let level=1; let acct:Account={};
  { const nm=kv.get('wv_name'); if(nm) kv.set('wv_name_'+id,nm); }
  if(legacy){ kv.set(CHAR_KEY(id),legacy); try{ const s=JSON.parse(legacy); level=s.level||1; acct=extractAccount(s); }catch{} }
  r={ v:1, active:id, chars:[{ id, name:'', level, created:Date.now(), played:Date.now(), ...(legacy?{}:{ fresh:true }) }], account:acct, nextN:2 }; writeRoster(r,kv); return r; }
export function extractAccount(s:any):Account{ return { settings:s.settings, purchases:s.purchases?{ lockerBlocks:s.purchases.lockerBlocks||0, skins:[...(s.purchases.skins||[])] }:undefined, store:s.store, cosOwned:s.cosmetics?.owned, cosSeen:s.cosmetics?.seen, cosOutfits:s.cosmetics?.outfits }; }
/** Overlay account-wide data onto a character save (load path). Purchases are merged (max / union) so nothing bought is ever lost. */
export function applyAccount(s:any,a:Account){ if(!a) return s; if(a.settings) s.settings={ ...s.settings, ...a.settings };
  if(a.purchases){ s.purchases=s.purchases||{ lockerBlocks:0, skins:[], equippedSkin:null }; s.purchases.lockerBlocks=Math.max(s.purchases.lockerBlocks||0,a.purchases.lockerBlocks||0); s.purchases.skins=[...new Set([...(s.purchases.skins||[]),...(a.purchases.skins||[])])]; }
  if(a.store) s.store=a.store;
  if(a.cosOwned||a.cosOutfits){ s.cosmetics=s.cosmetics||{ owned:{}, equipped:{}, seen:{} }; s.cosmetics.owned={ ...(s.cosmetics.owned||{}), ...(a.cosOwned||{}) }; s.cosmetics.seen={ ...(s.cosmetics.seen||{}), ...(a.cosSeen||{}) }; if(a.cosOutfits) s.cosmetics.outfits=a.cosOutfits; }
  return s; }
/** Read the active character's raw save JSON (falls back to the legacy mirror). */
export function activeRaw(kv:KV=lsKV):string|null{ const r=ensureRoster(kv); return kv.get(LEGACY_KEY)??kv.get(CHAR_KEY(r.active)); }
/** Persist path: character data to its own key + legacy mirror; account fields + summary to the roster. */
export function saveActive(json:string,s:any,kv:KV=lsKV){ const r=ensureRoster(kv); kv.set(CHAR_KEY(r.active),json); kv.set(LEGACY_KEY,json); r.account={ ...r.account, ...extractAccount(s) }; const c=r.chars.find(x=>x.id===r.active); if(c){ c.level=s.level||1; c.played=Date.now(); c.trait1=s.traits?.l10?.id??null; c.trait2=s.traits?.l20?.id??null; c.town=s.town; } writeRoster(r,kv); }
export type CharResult={ ok:true; id:string }|{ ok:false; why:string };
/** Free character creation, capped at CHAR_LIMIT. The new save is built by the caller's factory (state.newSave) so it gets the stock loadout. */
export function createChar(name:string,make:()=>any,kv:KV=lsKV):CharResult{ const r=ensureRoster(kv); if(r.chars.length>=CHAR_LIMIT) return { ok:false, why:`Character limit reached (${CHAR_LIMIT}). Delete one to make room.` };
  const nm=validName(name); if(!nm) return { ok:false, why:'Pick a name (2-16 letters, numbers, spaces).' }; const id=newId(); const s=applyAccount(make(),r.account); kv.set(CHAR_KEY(id),JSON.stringify(s,(k,v)=>k.startsWith('_')?undefined:v));
  r.chars.push({ id, name:nm, level:s.level||1, created:Date.now(), played:0 }); r.nextN++; writeRoster(r,kv); return { ok:true, id }; }
/** Switch: the caller must persist the current character first, then reload. */
export function selectChar(id:string,kv:KV=lsKV):CharResult{ const r=ensureRoster(kv); if(!r.chars.some(c=>c.id===id)) return { ok:false, why:'No such character.' }; r.active=id; const raw=kv.get(CHAR_KEY(id)); if(raw) kv.set(LEGACY_KEY,raw); else kv.del(LEGACY_KEY); writeRoster(r,kv); return { ok:true, id }; }
/** Delete (UI asks for a typed confirm). Deleting the active one switches to another; deleting the last leaves a fresh character 1. */
export function deleteChar(id:string,kv:KV=lsKV):CharResult{ const r=ensureRoster(kv); const i=r.chars.findIndex(c=>c.id===id); if(i<0) return { ok:false, why:'No such character.' }; r.chars.splice(i,1); kv.del(CHAR_KEY(id)); kv.del('wv_name_'+id);
  /* mail addressed to the deleted character goes back to its sender (if that character still exists) */ if(r.account.mail) r.account.mail=r.account.mail.filter((m:any)=>m.to!==id||(m.from!==id&&r!.chars.some(c=>c.id===m.from))).map((m:any)=>m.to===id?{ ...m, to:m.from, fromName:'Returned' }:m);
  if(!r.chars.length){ kv.del(LEGACY_KEY); kv.del(ROSTER_KEY); const r2=ensureRoster(kv); r2.account=r.account; writeRoster(r2,kv); return { ok:true, id:r2.active }; }
  if(r.active===id){ writeRoster(r,kv); return selectChar(r.chars[0].id,kv); } writeRoster(r,kv); return { ok:true, id:r.active }; }
/** Raw save of any character (transfers / selector previews). */
export function charSave(id:string,kv:KV=lsKV):any{ try{ return JSON.parse(kv.get(CHAR_KEY(id))||'null'); }catch{ return null; } }
/** Name the auto-made first character (first-time player creation). */
export function nameFresh(name:string,kv:KV=lsKV):boolean{ const r=ensureRoster(kv); const c=r.chars.find(x=>x.id===r.active); const nm=validName(name); if(!c||!nm) return false; c.name=nm; delete c.fresh; kv.set('wv_name_'+c.id,nm); writeRoster(r,kv); return true; }
/** Placeholder names ("Runner 3", empty) never reach the world: the selector asks for a real one first. */
export const isPlaceholderName=(n?:string|null)=>!n||!String(n).trim()||/^runner\s*\d*$/i.test(String(n).trim())||/^guest(-\d+)?$/i.test(String(n).trim());
/** Cleaned name or '' when invalid / placeholder. */
export function validName(n:string):string{ const t=String(n||'').replace(/[^\p{L}\p{N} _\-.']/gu,'').replace(/\s+/g,' ').trim().slice(0,16); return t.length>=2&&!isPlaceholderName(t)?t:''; }
/** Active character still needs a name (first boot, or an old "Runner N"). */
export function needsName(kv:KV=lsKV):boolean{ try{ const r=ensureRoster(kv); const c=r.chars.find(x=>x.id===r.active); return !!c&&(!!c.fresh||isPlaceholderName(c.name)); }catch{ return false; } }
const NAME_A=['Vex','Nyx','Kade','Rook','Juno','Sable','Echo','Pike','Rhee','Onyx','Talon','Zero','Kestrel','Mara','Dex','Ivo','Quill','Vanta','Cipher','Lark'];
const NAME_B=['Volt','Wire','Static','Chrome','Hex','Null','Ash','Rivet','Grid','Byte','Shard','Flux','Arc','Haze','Spark','Coil'];
export const randomName=()=>{ const a=NAME_A[Math.floor(Math.random()*NAME_A.length)], b=NAME_B[Math.floor(Math.random()*NAME_B.length)]; return Math.random()<.5?a:(a+' '+b).slice(0,16); };
/** Multiplayer identity is per character: party display name defaults to the character name; a custom party name is remembered per character. */
export const partyName=(kv:KV=lsKV)=>{ try{ const r=ensureRoster(kv); const c=[kv.get('wv_name_'+r.active),r.chars[0]?.id===r.active?kv.get('wv_name'):null,r.chars.find(c=>c.id===r.active)?.name].find(n=>!isPlaceholderName(n)); return c||''; }catch{ return ''; } };
export const setPartyName=(n:string,kv:KV=lsKV)=>{ const r=ensureRoster(kv); kv.set('wv_name_'+r.active,n); };
export const activeCharId=(kv:KV=lsKV)=>ensureRoster(kv).active;
