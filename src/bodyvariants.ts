import { ITEM_BY_ID, Mfr, Slot } from './config';
import type { Save } from './state';
import { equippedCos, COS_BODY_LAYERS, COS_BY_ID } from './content/appearance';
/**
 * Body variants: which prebaked layer set each visible body slot uses, derived from the installed hardware.
 *  - stock (Standard Issue) hardware keeps the base scavenger-mechanic look
 *  - any non-stock item swaps that slot's layer to its manufacturer's body part (Heavy Industrial / Precision Surgical / Mass Market)
 * Parts are per slot, so mixed-brand builds give mixed-brand bodies. All variants are rendered on the same rig and animation set,
 * so layers composite cleanly; sheets live in public/sprites/v/<variant>/ and are only fetched when something non-stock is equipped.
 */
/** 'base'|'heavy'|'surgical'|'market', premium bodies ('arcforge'|'bloom'|'ronin'|'founder'), optionally '@<chroma>' (src/content/skinlines.ts CHROMA_FILTER). */
export type Variant='base'|'heavy'|'surgical'|'market'|(string&{});
/** Visible layers (no layer for the 'brain' slot). Same names as the sprite atlas layers. */
export const BODY_SLOTS=['face','torso','armL','handL','armR','handR','legL','footL','legR','footR'] as const;
export type BodySlot=typeof BODY_SLOTS[number];
export type Body=Record<BodySlot,Variant>;
export const MFR_VARIANT:Record<Mfr,Variant>={ HI:'heavy', PS:'surgical', MM:'market' };
export const baseBody=():Body=>Object.fromEntries(BODY_SLOTS.map(s=>[s,'base'])) as Body;
/** Variant for one installed item def id ('stock_*' => base). */
export function variantOfDef(def:string|undefined):Variant{ if(!def||def.startsWith('stock_')) return 'base'; const it=ITEM_BY_ID[def]; return it?MFR_VARIANT[it.mfr]:'base'; }
/** ?body=heavy|surgical|market forces a full body; ?body=mix a mixed-brand demo body (art/test hook) */
export function forcedBody(search:string=typeof location!=='undefined'?location.search:''):Body|null{
  const m=/[?&]body=([a-z]+)/.exec(search); if(!m) return null; const v=m[1];
  if((['heavy','surgical','market'] as string[]).includes(v)) return Object.fromEntries(BODY_SLOTS.map(s=>[s,v])) as Body;
  if(v==='mix') return { face:'surgical', torso:'heavy', armL:'heavy', handL:'heavy', armR:'surgical', handR:'surgical', legL:'market', footL:'market', legR:'base', footR:'base' };
  return null;
}
export function bodyOf(save:Save, forced:Body|null=forcedBody()):Body{
  if(forced) return forced; const b=baseBody();
  for(const s of BODY_SLOTS){ const u=save.installed[s as Slot]; const inst=u?save.items.find(i=>i.uid===u):undefined; b[s]=variantOfDef(inst?.def); }
  return applyCosmeticVariants(b,save);
}

/** Appearance-only body parts: an equipped cosmetic with a `variant` swaps that slot's prebaked layers (real art) without changing hardware or stats.
 *  `extra` previews an unequipped cosmetic def id in the wardrobe. */
export function applyCosmeticVariants(b:Body,save:Pick<Save,'cosmetics'>,extra?:string[]):Body{
  const out={...b}; const eq=equippedCos(save); const full=eq.find(d=>d.body); if(full) for(const l of BODY_SLOTS) (out as any)[l]=full.body; // premium full-body skin first, per-slot variants on top
  for(const d of eq){ const L=COS_BODY_LAYERS[d.slot]; if(d.variant&&L) for(const l of L) (out as any)[l]=d.variant; }
  if(extra) for(const id of extra){ const d0=COS_BY_ID[id] as any; if(d0?.body) for(const l of BODY_SLOTS) (out as any)[l]=d0.body; }
  if(extra) for(const id of extra){ const d=COS_BY_ID[id] as any; const L=d&&COS_BODY_LAYERS[d.slot as keyof typeof COS_BODY_LAYERS]; if(d?.variant&&L) for(const l of L) (out as any)[l]=d.variant; }
  return out;
}
