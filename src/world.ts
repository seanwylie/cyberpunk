// World registry (docs/WORLD.md): every town/district in the megacity and its outskirts. Pure data + logic (no DOM).
// Rustline and Harrow Reach keep their hand-built layouts (level.ts / town2.ts); every other district is laid out by src/towngen.ts from the
// template here. Towns are safe hubs: any level can ride the Reach Line to any of them. Level bands are aspirational, not gates.
export type StationKind = 'transit' | 'jobs' | 'vendor' | 'repair' | 'bank' | 'locker' | 'store' | 'gate';
export interface WorldTown {
  id: string; name: string; short: string; band: [number, number]; faction: string; theme: string; blurb: string; color: string;
  /** map position on the transit screen, 0..100 */ map: [number, number]; region: 'core' | 'rim' | 'outskirts' | 'below';
  /** generated towns only */ gen?: {
    seed: number; w: number; h: number; shape: 'oval' | 'long' | 'cross' | 'terrace'; stations: StationKind[];
    /** base ground textures (file names under public/town or public/town2) */ ground: { base: string; planks: string; plaza: string; debris?: string };
    /** CSS filter used to recolour this district's prop family (baked once at load) */ recolor: string; grade: { tint: string; vig: string };
    /** light colour for lamps (r,g,b) and the slow pulse period in seconds */ lamp: string; pulse: number;
    /** perimeter prop pool: [sprite, fw, fd, scale] */ perimeter: [string, number, number, number][];
    /** hub dressing */ hub: [string, number, number, number][]; landmark: { spr: string; fw: number; fd: number; sw: number; name: string; blurb: string };
    signage: string[]; crowd: number; puddles: boolean;
  };
  /** dungeons whose gate is in this town */ dungeons: string[];
  /** fixer line when the player is under the band */ under: string;
}
const HI_PERIM: [string, number, number, number][] = [['h_bld1', 3, 3, 3.0], ['h_bld2', 3, 3, 3.0], ['h_bld3', 3, 3, 3.0], ['h_container', 4, 2, 3.7], ['h_crates', 2, 2, 2.6], ['h_barrier', 3, 1, 3.0], ['smokestack', 2, 2, 1.7], ['h_gantry', 2, 2, 2.3]];
const RL_PERIM: [string, number, number, number][] = [['bld1', 3, 3, 3.0], ['bld2', 3, 3, 3.0], ['bld3', 3, 3, 3.0], ['container', 4, 2, 3.6], ['crates', 2, 2, 2.5], ['barrier', 3, 1, 3.0], ['leanto', 3, 2, 3.0], ['gantry', 2, 2, 2.3], ['fence', 3, 1, 2.4]];
export const WORLD: WorldTown[] = [
  { id: 'rustline', name: 'Rustline Market', short: 'RUSTLINE', band: [1, 24], faction: 'Rustline Compact', theme: 'Tarp market, neutral ground', color: '#ffb02e', map: [42, 62], region: 'rim',
    blurb: 'Tarp stalls and a cramped plaza. Neutral ground where all three manufacturers sell through independents.', dungeons: [], under: '' },
  { id: 'neon_mile', name: 'Neon Mile', short: 'NEON MILE', band: [1, 18], faction: 'Kestrel Value', theme: 'Entertainment strip', color: '#ff5cc8', map: [55, 48], region: 'core',
    blurb: 'Arcades, karaoke boxes and noodle counters under a ceiling of animated billboards. Kestrel owns the leases and the lights never go off.',
    dungeons: ['warehouse', 'annex', 'scrap_gantry'], under: '',
    gen: { seed: 101, w: 84, h: 46, shape: 'long', stations: ['transit', 'jobs', 'vendor', 'store', 'locker', 'gate'], ground: { base: 'cobble', planks: 'planks', plaza: 'plaza' }, recolor: 'hue-rotate(285deg) saturate(1.35) brightness(1.05)', grade: { tint: 'rgba(40,10,46,.18)', vig: 'rgba(10,4,14,.72)' }, lamp: '255,92,200', pulse: 5.5,
      perimeter: [...RL_PERIM, ['vending', 1, 1, 1.25], ['poster_wall', 3, 1, 3.0]], hub: [['stall_noodle', 3, 3, 4.2], ['vending', 1, 1, 1.25], ['bench', 2, 1, 2.0], ['bulbs', 1, 1, 1.0]],
      landmark: { spr: 'poster_wall', fw: 3, fd: 1, sw: 4.4, name: 'The Billboard Canyon', blurb: 'Forty storeys of ads stacked like playing cards. Somewhere up there is the one that started the Kestrel jingle.' },
      signage: ['KARAOKE', 'NOODLES 24H', 'PACHINKO', 'KESTREL'], crowd: 1.3, puddles: true } },
  { id: 'the_stacks', name: 'The Stacks', short: 'STACKS', band: [6, 22], faction: 'Rustline Compact', theme: 'Container slums', color: '#c9a02a', map: [30, 74], region: 'rim',
    blurb: 'Shipping containers welded twelve high and wired together with stolen current. Every rung is someone\'s front door.',
    dungeons: ['substation_12', 'tailings_pit', 'scrap_gantry'], under: '',
    gen: { seed: 202, w: 64, h: 56, shape: 'terrace', stations: ['transit', 'jobs', 'vendor', 'repair', 'locker', 'gate'], ground: { base: 'debris', planks: 'planks', plaza: 'plaza', debris: 'cobble' }, recolor: 'sepia(.35) hue-rotate(-12deg) saturate(1.1) brightness(.92)', grade: { tint: 'rgba(36,26,8,.18)', vig: 'rgba(8,6,2,.76)' }, lamp: '255,190,90', pulse: 6.5,
      perimeter: [['container', 4, 2, 3.6], ['h_container', 4, 2, 3.7], ['container', 2, 4, 3.6], ['leanto', 3, 2, 3.0], ['scaffold', 3, 2, 3.2], ['crates', 2, 2, 2.5]], hub: [['barrel_fire', 1, 1, 1.4], ['bench', 2, 1, 2.0], ['junk', 2, 1, 2.6], ['rags1', 1, 1, 1.0]],
      landmark: { spr: 'scaffold', fw: 3, fd: 2, sw: 4.6, name: 'The Twelve-High', blurb: 'The tallest stack in the Basin. The lift has not worked in nine years; the residents run a pulley instead.' },
      signage: ['STACK 7', 'NO TRESPASS', 'WATER 2C'], crowd: 1.2, puddles: true } },
  { id: 'salt_harbor', name: 'Saltwater Harbor', short: 'HARBOR', band: [12, 28], faction: 'Rustline Compact', theme: 'Flooded harbor', color: '#38d8ff', map: [14, 52], region: 'outskirts',
    blurb: 'The old port went under when the sea wall failed. Now it is boardwalks, moored barges and a fish market on stilts.',
    dungeons: ['drained_reservoir', 'coke_ovens', 'freight_depot'], under: 'Harbor jobs run deeper than the water, merc. Look around, but keep your feet dry.',
    gen: { seed: 303, w: 72, h: 52, shape: 'cross', stations: ['transit', 'jobs', 'vendor', 'bank', 'locker', 'gate'], ground: { base: 'planks', planks: 'deck', plaza: 'plaza', debris: 'cobble' }, recolor: 'hue-rotate(160deg) saturate(.8) brightness(.95)', grade: { tint: 'rgba(8,26,40,.2)', vig: 'rgba(2,8,14,.74)' }, lamp: '120,210,255', pulse: 7,
      perimeter: [['container', 4, 2, 3.6], ['crates', 2, 2, 2.5], ['barrels', 2, 2, 2.4], ['h_gantry', 2, 2, 2.3], ['fence', 3, 1, 2.4], ['bld2', 3, 3, 3.0]], hub: [['stall_noodle', 3, 3, 4.2], ['barrels', 2, 2, 2.4], ['bench', 2, 1, 2.0], ['cables', 1, 1, 1.5]],
      landmark: { spr: 'h_gantry', fw: 2, fd: 2, sw: 4.8, name: 'The Drowned Crane', blurb: 'A container crane half under the tide, still lit by the harbor co-op so boats can find the channel.' },
      signage: ['FISH', 'BOATS', 'TIDE 3M'], crowd: 1, puddles: true } },
  { id: 'harrow', name: 'Harrow Reach', short: 'HARROW', band: [20, 50], faction: 'Harrow-Brandt', theme: 'Foundry terraces', color: '#ff6a3a', map: [70, 70], region: 'rim',
    blurb: 'The Cinderworks: a terraced foundry town built into cooled slag banks under a dead stack. Heavy Works hardware, the Line 7 Retirees\' Guild and the gates to Tier III and IV.', dungeons: [], under: 'Harrow is for crews who already lost their first set of knees. Look around, but the gate here does not care about your feelings.' },
];
export const WORLD_BY_ID: Record<string, WorldTown> = Object.fromEntries(WORLD.map(t => [t.id, t]));
export const GEN_TOWNS = WORLD.filter(t => t.gen);
/** first-visit bonus XP, scaled by how far above the player the town sits */
export const FIRST_VISIT_XP = (t: WorldTown) => 40 + t.band[0] * 6;
export const LANDMARK_XP = (t: WorldTown) => 20 + t.band[0] * 3;
