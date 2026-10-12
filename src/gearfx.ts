// Which installed hardware is purple/orange (for the scaled-down gear FX in src/cosfx.ts). Cached per save.installed signature.
import { ITEM_BY_ID } from './config';
import type { Save } from './state';
import type { GearFx } from './cosfx';
let sig = '', cache: GearFx[] = [];
export function gearFxOf(s: Pick<Save, 'installed' | 'items'>): GearFx[] {
  const k = JSON.stringify(s.installed); if (k === sig) return cache; sig = k; cache = [];
  for (const [slot, uid] of Object.entries(s.installed)) { const it = uid ? s.items.find(i => i.uid === uid) : undefined; const d = it ? ITEM_BY_ID[it.def] : undefined; if (d && (d.rarity === 'orange' || d.rarity === 'purple')) cache.push({ slot, r: d.rarity }); }
  return cache; }
