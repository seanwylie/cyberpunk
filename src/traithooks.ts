// Glue between the sim and trait state that needs the live build (kept out of traitstate.ts so that stays pure save logic).
import { abilityFamilies, FAMILIES } from './traits';
import type { Sig } from './traitstate';
/** Weak prior for sparse history: the families of the abilities the CURRENT equipment grants. Equipment alone never decides (weight TRAIT_CFG.priorWeight). */
export function traitPrior(g:any):Sig{ const o:Sig={}; for(const id of (g?.build?.granted||[]) as string[]){ const f=abilityFamilies(id); for(const k of FAMILIES) if(f[k]) o[k]=(o[k]||0)+f[k]!; } return o; }
