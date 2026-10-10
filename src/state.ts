import { chipFits, Slot, ChipId, SLOTS, STARTING, PROGRESSION, ITEM_BY_ID, Mfr, INSTANCE_RETENTION_HOURS } from './config';
import type { StoryState } from './story';

export interface Inst { uid:string; def:string; chips:ChipId[]; }
export interface Settings { gore:'off'|'standard'|'bloody'; joystickFixed:boolean; damageNumbers:boolean; reducedFx:boolean; uiSize:'S'|'M'|'L'|'XL'; minimap?:boolean; recHidden?:boolean; recNudge?:boolean; hintsSeen?:Record<string,number>; lootLabels:'off'|'near'|'all'; lootMin:import('./config').Rarity; devFreeReset?:boolean; volume:number; musicVol?:number; sfxVol?:number; music:boolean; llm:{ enabled:boolean; url:string; key:string; model:string } }
export interface Carried { items:Inst[]; chips:Partial<Record<ChipId,number>>; stims:number; credits:number; }
export interface EnemyState { id:number; type:string; x:number; y:number; hp:number; maxHp:number; alert:boolean; dead:boolean; home:{x:number;y:number}; group:number; faction:'enemy'|'ally'; ctrlT:number; stunT:number; name?:string; /** boss phase index (content batch 1) */ phase?:number; /** spawned by a boss (tether node / add): cleaned up with the boss */ bossAdd?:boolean; pylon?:boolean; /** batch-2 elite affixes (src/content/mobs.ts) */ affix?:string[]; eliteDone?:boolean; /** id of the summoner that spawned this minion */ minionOf?:number; }
export interface Drop { id:number; x:number; y:number; kind:'item'|'chip'|'stim'|'credits'; inst?:Inst; chip?:ChipId; amount:number; marker?:boolean; born?:number; }
export const LAYOUT_V=2;
export interface Flags { gate1:boolean; lock2:boolean; passageSeen:boolean; controller:boolean; armory:boolean; cond:null|'A'|'B'; bossKey:string|null; bossRevealed:boolean; bossSpawned:boolean; bossDead:boolean; completed:boolean; rewardsGranted:boolean; alarm:boolean; salvageForeman:boolean; }
export interface InstanceState {
  id:string; dungeon?:string; createdAt:number; expiresAt:number; seed:number; /** layout generator version: older instances are discarded */ layoutV?:number; enemies:EnemyState[]; drops:Drop[]; carried:Carried; flags:Flags;
  checkpoint:{ id:number; x:number; y:number }; px:number; py:number; hp:number; broken:Slot[]; protectedSlots:Slot[]; repairAdded:number; nextId:number; xpEarned:number; warned:boolean; kills:Record<string,number>; claimed:string[]; elapsed:number; reached?:number[]; shots?:{fired:number;hits:number};
}
export interface Save {
  version:number; level:number; xp:number; credits:number; repairBill:number; rep:Record<Mfr,number>;
  items:Inst[]; installed:Partial<Record<Slot,string>>; lockerChips:Partial<Record<ChipId,number>>; stims:number; lockerCap:number;
  settings:Settings; purchases:{ lockerBlocks:number; skins:string[]; equippedSkin:string|null }; lastClearDay:string|null;
  instance:InstanceState|null; story:StoryState|null; uidN:number; stats:{ runs:number; clears:number; kills:number };
  /** Set by the idkfa dev cheat; leaderboards/MMO must ignore flagged saves. */ cheated?:boolean; cheatLog?:string[];
  /** Dungeons cleared at least once (content batch 1 unlock path). */ cleared?:Record<string,number>;
  /** Per-dungeon daily lockout days (annex keeps using lastClearDay for backward compatibility). */ lockouts?:Record<string,string>;
  /** Contracts: active progress by id, once-only completions, daily completion day by id. */ contracts?:{ active:Record<string,number>; done:string[]; doneDay:Record<string,string> };
}
const KEY = 'arpg-proto-save-v1';
export const todayStr = (t=Date.now())=>{ const d=new Date(t); return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate(); };

export function newSave():Save {
  const s:Save = { version:1, level:PROGRESSION.startLevel, xp:0, credits:STARTING.credits, repairBill:0, rep:{HI:0,PS:0,MM:0},
    items:[], installed:{}, lockerChips:{...STARTING.chips}, stims:2, lockerCap:STARTING.lockerSlots,
    settings:{ gore:'standard', joystickFixed:false, damageNumbers:false, reducedFx:false, uiSize:'M', minimap:true, lootLabels:'near', lootMin:'grey', volume:.6, musicVol:1, sfxVol:1, music:true, llm:{enabled:false,url:'',key:'',model:''} },
    purchases:{ lockerBlocks:0, skins:[], equippedSkin:null }, lastClearDay:null, instance:null, story:null, uidN:1, stats:{runs:0,clears:0,kills:0}, lockouts:{}, contracts:{active:{},done:[],doneDay:{}} };
  for (const sl of SLOTS) { const it = mkInst(s,'stock_'+sl); s.items.push(it); s.installed[sl]=it.uid; }
  return s;
}
export function mkInst(s:{uidN:number}, def:string):Inst { if(!ITEM_BY_ID[def]) throw new Error('unknown item '+def); return { uid:'u'+(s.uidN++), def, chips:[] }; }
export function load():Save {
  try { const raw = localStorage.getItem(KEY); if (raw) { const s = JSON.parse(raw) as Save; if (s.version===1) { s.settings = { ...newSave().settings, ...s.settings }; s.lockouts=s.lockouts||{}; s.contracts=s.contracts||{active:{},done:[],doneDay:{}}; const moved=sanitizeChips(s); (s as any)._chipMigrated=moved; return s; } } } catch (e) { console.warn('load failed', e); }
  return newSave();
}
/** Migration/enforcement: unsocket chips that do not fit their body part and return them to the locker stock. Returns number moved. */
export function sanitizeChips(s:Save):number{ let n=0; const slotOf:Record<string,Slot>={}; for(const sl of SLOTS){ const u=s.installed[sl]; if(u) slotOf[u]=sl; }
  for(const it of s.items){ const def=ITEM_BY_ID[it.def]; if(!def) continue; const sl=slotOf[it.uid]||def.slot; const keep:ChipId[]=[]; for(const c of it.chips){ if(chipFits(c,sl)) keep.push(c); else { s.lockerChips[c]=(s.lockerChips[c]||0)+1; n++; } } it.chips=keep; }
  return n; }
export function persist(s:Save) { try { localStorage.setItem(KEY, JSON.stringify(s, (k,v)=>k.startsWith('_')?undefined:v)); } catch(e){ console.warn('save failed',e); } }
export function wipe() { localStorage.removeItem(KEY); }
export function capacityUsed(s:Save){ return s.items.filter(i=>!Object.values(s.installed).includes(i.uid)).length + Object.values(s.lockerChips).filter(v=>v&&v>0).length; }
export function lockerItems(s:Save){ const inst = new Set(Object.values(s.installed)); return s.items.filter(i=>!inst.has(i.uid)); }
export const retentionMs = INSTANCE_RETENTION_HOURS*3600*1000;

export function lockDay(s:Save,id:string):string|null{ return id==='annex'?s.lastClearDay:(s.lockouts?.[id]??null); }
export function setLockDay(s:Save,id:string,d:string|null){ if(id==='annex') s.lastClearDay=d; else { s.lockouts=s.lockouts||{}; if(d) s.lockouts[id]=d; else delete s.lockouts[id]; } }
export function contractState(s:Save){ if(!s.contracts) s.contracts={active:{},done:[],doneDay:{}}; return s.contracts; }
