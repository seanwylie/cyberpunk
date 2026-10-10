// Data-only move tables derived from batch1_bosses.ts (no sim/config imports so config.ts and sim.ts can both use them).
import { BOSSES, BOSS_BY_ID } from './batch1_bosses';
import type { MoveSpec, MoveKind } from './batch1_bosses';
export interface AtkLike { w:number; rec:number; cd:number; min:number; max:number; lock?:boolean; ranged?:boolean }
interface KD { w:number; rec:number; cd:number; min:number; max:number; lock?:boolean; ranged?:boolean; dmg:number }
export const KIND_DEFAULTS:Record<MoveKind,KD>={
  marks:{w:1.3,rec:.9,cd:7,min:0,max:16,ranged:true,dmg:12}, ring:{w:1.2,rec:1.0,cd:10,min:0,max:16,dmg:11}, spokes:{w:1.2,rec:1.8,cd:11,min:0,max:18,ranged:true,dmg:10},
  cross:{w:1.4,rec:1.0,cd:10,min:0,max:16,dmg:12}, lanes:{w:1.2,rec:1.0,cd:9,min:0,max:18,ranged:true,dmg:11}, spiral:{w:1.2,rec:1.6,cd:12,min:0,max:16,dmg:10},
  rain:{w:.9,rec:.8,cd:7,min:0,max:18,ranged:true,dmg:11}, fan:{w:.9,rec:.8,cd:4,min:3,max:14,lock:true,ranged:true,dmg:12}, nova:{w:1.1,rec:.9,cd:8,min:0,max:16,dmg:12}, adds:{w:.9,rec:.8,cd:22,min:0,max:40,dmg:0},
};
export interface MoveDef { boss:string; spec:MoveSpec; id:string }
/** attack id -> move (e.g. "voss.0"). */
export const MOVES:Record<string,MoveDef>={};
export const MOVE_ATK:Record<string,AtkLike>={};
export const MOVE_DMG:Record<string,number>={};
for(const b of BOSSES) b.moves.forEach((m,i)=>{ const id=b.id+'.'+i; const d=KIND_DEFAULTS[m.k]; MOVES[id]={boss:b.id,spec:m,id};
  MOVE_ATK[id]={w:m.w??d.w,rec:m.rec??d.rec,cd:m.cd??d.cd,min:m.min??d.min,max:m.max??d.max,lock:d.lock,ranged:d.ranged}; MOVE_DMG[id]=m.dmg??d.dmg; });
export const moveIdsOf=(boss:string)=>BOSS_BY_ID[boss]?.moves.map((_,i)=>boss+'.'+i)||[];

