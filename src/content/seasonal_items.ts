// Season-exclusive hardware (src/seasons.ts). Orange tier: prestige on par with boss oranges, power inside the existing orange band
// (never above it), so retiring them removes no power the curve depends on. Earned in play only, never sold.
import type { ItemDef, Mfr, Rarity, Slot, Stats } from '../config';
const H=(id:string,name:string,slot:Slot,mfr:Mfr,rarity:Rarity,lvl:number,stats:Partial<Stats>,x:Partial<ItemDef>={}):ItemDef=>({id,name,slot,mfr,rarity,lvl,stats,...x});
export const SEASONAL_ITEMS:ItemDef[]=[
  H('s1_bloom_veil','Static Bloom Veil','torso','PS','orange',24,{maxHp:36,cooling:.25,regen:.5},{abilities:['cloak','pulse'],caps:['cloak'],blurb:'Season 1. A weave that drinks the signal storm and blooms in violet static.'}),
  H('s1_prism_lancer','Prism Lancer Arm','armR','HI','orange',24,{dmg:.22,armor:4},{abilities:['bladeburst','sweep'],caps:['force'],blurb:'Season 1. Splits the storm into a lance of cold light.'}),
  H('s1_quiet_halo','Quiet Halo','face','MM','orange',24,{armor:3,maxHp:24,cooling:.15},{abilities:['brace','reposition'],blurb:'Season 1. A ring of stilled static. The noise stops when you wear it.'}),
];
