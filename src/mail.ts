// Character-to-character item transfer (docs/CHARACTERS.md). There was no mail system, so this is a minimal ACCOUNT MAILBOX:
// - only unequipped locker items owned by the sending character; never IDKFA cheat gear; never traits (traits are not items and cannot be sent)
// - chips are not sent: they go back to the sender's locker stock (chips are a per-character resource)
// - the receiver claims into their locker; claiming needs the item's level requirement and free locker space (level rule)
// Mail lives in the roster's account block, so it survives switching characters.
import { ensureRoster, writeRoster, readRoster } from './chars';
import { ITEM_BY_ID, STARTING } from './config';
import { mkInst, capacityUsed, type Save } from './state';
export const MAIL_MAX=50;
export interface Mail { id:string; to:string; from:string; fromName:string; def:string; at:number }
const mailOf=(r:any):Mail[]=>(r.account.mail=r.account.mail||[]);
export const inbox=(id?:string)=>{ const r=ensureRoster(); const who=id||r.active; return mailOf(r).filter(m=>m.to===who); };
export const lockerCapOf=(s:Save)=>s.lockerCap+s.purchases.lockerBlocks*STARTING.lockerPerPurchase;
const isCheat=(s:Save,uid:string,def:string)=>def.startsWith('idkfa_')||def.startsWith('sig_')||!!(s as any).idkfa?.granted?.includes(uid);
export type MailResult={ ok:true }|{ ok:false; why:string };
export function canSend(s:Save,uid:string):MailResult{ const it=s.items.find(i=>i.uid===uid); if(!it) return { ok:false, why:'Only items can be sent. Traits stay with their character.' };
  if(Object.values(s.installed).includes(uid)) return { ok:false, why:'Unequip it first.' }; if(isCheat(s,uid,it.def)) return { ok:false, why:'Cheat gear cannot be sent.' }; if(!ITEM_BY_ID[it.def]) return { ok:false, why:'Unknown item.' }; return { ok:true }; }
/** Caller persists the sender save afterwards (persist() rewrites the roster summary, so the mail must be written first: this function does). */
export function sendItem(s:Save,uid:string,to:string):MailResult{ const r=ensureRoster(); if(to===r.active) return { ok:false, why:'Pick another character.' }; const tc=r.chars.find(c=>c.id===to); if(!tc) return { ok:false, why:'No such character.' };
  const c=canSend(s,uid); if(!c.ok) return c; if(mailOf(r).length>=MAIL_MAX) return { ok:false, why:'Mailbox full.' };
  const it=s.items.find(i=>i.uid===uid)!; for(const ch of it.chips) s.lockerChips[ch]=(s.lockerChips[ch]||0)+1; s.items=s.items.filter(i=>i!==it);
  const me=r.chars.find(x=>x.id===r.active)!; mailOf(r).push({ id:'m'+Date.now().toString(36)+Math.random().toString(36).slice(2,6), to, from:r.active, fromName:me.name, def:it.def, at:Date.now() }); writeRoster(r); return { ok:true }; }
export function canClaim(s:Save,m:Mail):MailResult{ const d=ITEM_BY_ID[m.def]; if(!d) return { ok:false, why:'This item no longer exists.' }; if(s.level<d.lvl) return { ok:false, why:`Needs level ${d.lvl}.` }; if(capacityUsed(s)>=lockerCapOf(s)) return { ok:false, why:'Locker full.' }; return { ok:true }; }
export function claimMail(s:Save,id:string):MailResult{ const r=readRoster()||ensureRoster(); const m=mailOf(r).find(x=>x.id===id&&x.to===r.active); if(!m) return { ok:false, why:'Not in your mailbox.' };
  const c=canClaim(s,m); if(!c.ok) return c; s.items.push(mkInst(s,m.def)); r.account.mail=mailOf(r).filter(x=>x!==m); writeRoster(r); return { ok:true }; }
