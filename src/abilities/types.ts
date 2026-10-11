// Augment ability system: data types. Pure data/types, no runtime imports, so config.ts can register the abilities.
export type Rar='grey'|'green'|'blue'|'purple'|'orange';
export type Mf='HI'|'PS'|'MM';
export type Grp='hand'|'arm'|'leg'|'foot'|'torso'|'face'|'brain';
export type Role='burst'|'aoe'|'execute'|'cc'|'mobility'|'defence'|'support'|'stealth'|'tech'|'heat'|'sustain'|'summon'|'ultimate';
export type Shape='self'|'cone'|'line'|'ground'|'lockon'|'toggle';
export type AType='attack'|'defense'|'hacking'|'mobility';
export type Scale='dmg'|'cooling'|'maxHp'|'move'|'armor'|'regen';
/** Synergy tags. Enemy states: Marked Staggered Burning Rooted Slowed Exposed Tethered. Player states: Cloaked Shielded Overheated Hasted Charged. */
export type Tag='Marked'|'Staggered'|'Burning'|'Rooted'|'Slowed'|'Exposed'|'Tethered'|'Cloaked'|'Shielded'|'Overheated'|'Hasted'|'Charged';
export type Prim =
 | {p:'damage';k:number;kb?:number}
 | {p:'cone';k:number;r:number;arc:number;kb?:number}
 | {p:'line';k:number;len:number;w:number;kb?:number}
 | {p:'circle';k:number;r:number;at?:'self'|'aim'|'target';kb?:number}
 | {p:'chain';k:number;n:number;r:number;fall?:number}
 | {p:'projectile';speed:number;r:number;pierce:number;life:number;then:Prim[]}
 | {p:'dash';len:number;inv?:number;k?:number;toTarget?:boolean}
 | {p:'teleport';len?:number}
 | {p:'pull';s:number} | {p:'push';s:number}
 | {p:'stun';t:number} | {p:'slow';m:number;t:number} | {p:'root';t:number}
 | {p:'mark';t:number} | {p:'expose';t:number} | {p:'burn';k:number;t:number} | {p:'tether';t:number}
 | {p:'control';t:number} | {p:'strip'} | {p:'lose';r:number}
 | {p:'shield';f:number;t:number} | {p:'mitigate';m:number;t:number} | {p:'reflect';f:number;t:number}
 | {p:'heal';f:number;over?:number} | {p:'cloak';t:number} | {p:'cdr';t:number;all?:boolean} | {p:'vent';n:number}
 | {p:'ventHit';n:number;cap:number} | {p:'buff';s:'dmg'|'move'|'lifesteal'|'ambush';m:number;t:number} | {p:'invuln';t:number}
 | {p:'shoot';k:number}
 | {p:'summon';kind:'turret'|'drone'|'decoy'|'bot';life:number;every:number;r:number;tick:Prim[];end?:Prim[]}
 | {p:'aura';r:number;life:number;every:number;tick:Prim[];follow?:boolean;at?:'self'|'aim'}
 | {p:'trap';r:number;life:number;then:Prim[]}
 | {p:'delayed';t:number;at:'self'|'aim'|'target';then:Prim[]};
export interface Bonus { w:Tag; m:number; eat?:boolean }
export interface AbilityData {
  id:string; name:string; flavor:string; role:Role; type:AType; mfr:Mf; rarity:Rar; slots:Grp[]; shape:Shape; heat:number; cd:number; range:number; windup:number;
  scale:Scale; steps:Prim[]; gives:Tag[]; uses:Tag[]; bonus?:Bonus[]; exec?:{hp:number;m:number}; refundOnKill?:number;
  /** toggle abilities: heat per second while on, and the passive effects while on */
  toggle?:{ heat:number; vent?:number; mitigate?:number; dmg?:number; move?:number; cool?:number };
  /** extra "story" for the doc: how chips change it (auto-derived from primitives too) */
  chipNote?:string; icon?:string;
}
