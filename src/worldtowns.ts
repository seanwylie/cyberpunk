// One place that maps a town id to its level builder, stations and art config (hand-built Rustline/Harrow, generated districts).
import { buildTown } from './level';
import { buildHarrow, harrowCfg } from './town2';
import { buildGenTown, genStations, genCfg } from './towngen';
import { TOWN_STATIONS, type Station } from './stations';
import { WORLD_BY_ID } from './world';
import type { Level } from './level';
import type { TownCfg } from './town';
export const isGenTown = (id: string) => !!WORLD_BY_ID[id]?.gen;
export function stationsOf(id: string): Station[] { if (isGenTown(id)) return (TOWN_STATIONS[id] ??= genStations(id)); return TOWN_STATIONS[id] || TOWN_STATIONS.rustline; }
/** fresh level per entry for hand-built towns (they are cheap and mutable state lives on them); generated layouts are cached */
export function buildTownLevel(id: string): Level { if (id === 'harrow') return buildHarrow(); if (isGenTown(id)) { stationsOf(id); return buildGenTown(id); } return buildTown(); }
/** art base dir + cfg for a town (undefined => Rustline defaults) */
export function artOf(id: string): { base: string; cfg?: TownCfg } { if (id === 'harrow') return { base: './town2/', cfg: harrowCfg() }; if (isGenTown(id)) return { base: './town/', cfg: genCfg(id) }; return { base: './town/' }; }
