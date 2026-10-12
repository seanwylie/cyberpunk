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
    dungeons: ['warehouse', 'annex', 'scrap_gantry', 'gw_pharmacy_vault'], under: '',
    gen: { seed: 101, w: 84, h: 46, shape: 'long', stations: ['transit', 'jobs', 'vendor', 'store', 'locker', 'gate'], ground: { base: 'cobble', planks: 'planks', plaza: 'plaza' }, recolor: 'hue-rotate(285deg) saturate(1.35) brightness(1.05)', grade: { tint: 'rgba(40,10,46,.18)', vig: 'rgba(10,4,14,.72)' }, lamp: '255,92,200', pulse: 5.5,
      perimeter: [...RL_PERIM, ['vending', 1, 1, 1.25], ['poster_wall', 3, 1, 3.0]], hub: [['stall_noodle', 3, 3, 4.2], ['vending', 1, 1, 1.25], ['bench', 2, 1, 2.0], ['bulbs', 1, 1, 1.0]],
      landmark: { spr: 'poster_wall', fw: 3, fd: 1, sw: 4.4, name: 'The Billboard Canyon', blurb: 'Forty storeys of ads stacked like playing cards. Somewhere up there is the one that started the Kestrel jingle.' },
      signage: ['KARAOKE', 'NOODLES 24H', 'PACHINKO', 'KESTREL'], crowd: 1.3, puddles: true } },
  { id: 'the_stacks', name: 'The Stacks', short: 'STACKS', band: [6, 22], faction: 'Rustline Compact', theme: 'Container slums', color: '#c9a02a', map: [30, 74], region: 'rim',
    blurb: 'Shipping containers welded twelve high and wired together with stolen current. Every rung is someone\'s front door.',
    dungeons: ['substation_12', 'tailings_pit', 'scrap_gantry', 'gw_coke_ovens'], under: '',
    gen: { seed: 202, w: 64, h: 56, shape: 'terrace', stations: ['transit', 'jobs', 'vendor', 'repair', 'locker', 'gate'], ground: { base: 'debris', planks: 'planks', plaza: 'plaza', debris: 'cobble' }, recolor: 'sepia(.35) hue-rotate(-12deg) saturate(1.1) brightness(.92)', grade: { tint: 'rgba(36,26,8,.18)', vig: 'rgba(8,6,2,.76)' }, lamp: '255,190,90', pulse: 6.5,
      perimeter: [['container', 4, 2, 3.6], ['h_container', 4, 2, 3.7], ['container', 2, 4, 3.6], ['leanto', 3, 2, 3.0], ['scaffold', 3, 2, 3.2], ['crates', 2, 2, 2.5]], hub: [['barrel_fire', 1, 1, 1.4], ['bench', 2, 1, 2.0], ['junk', 2, 1, 2.6], ['rags1', 1, 1, 1.0]],
      landmark: { spr: 'scaffold', fw: 3, fd: 2, sw: 4.6, name: 'The Twelve-High', blurb: 'The tallest stack in the Basin. The lift has not worked in nine years; the residents run a pulley instead.' },
      signage: ['STACK 7', 'NO TRESPASS', 'WATER 2C'], crowd: 1.2, puddles: true } },
  { id: 'salt_harbor', name: 'Saltwater Harbor', short: 'HARBOR', band: [14, 30], faction: 'Rustline Compact', theme: 'Flooded harbor', color: '#38d8ff', map: [14, 52], region: 'outskirts',
    blurb: 'The old port went under when the sea wall failed. Now it is boardwalks, moored barges and a fish market on stilts.',
    dungeons: ['drained_reservoir', 'coke_ovens', 'freight_depot', 'gw_tailings_pit'], under: 'Harbor jobs run deeper than the water, merc. Look around, but keep your feet dry.',
    gen: { seed: 303, w: 72, h: 52, shape: 'cross', stations: ['transit', 'jobs', 'vendor', 'bank', 'locker', 'gate'], ground: { base: 'planks', planks: 'deck', plaza: 'plaza', debris: 'cobble' }, recolor: 'hue-rotate(160deg) saturate(.8) brightness(.95)', grade: { tint: 'rgba(8,26,40,.2)', vig: 'rgba(2,8,14,.74)' }, lamp: '120,210,255', pulse: 7,
      perimeter: [['container', 4, 2, 3.6], ['crates', 2, 2, 2.5], ['barrels', 2, 2, 2.4], ['h_gantry', 2, 2, 2.3], ['fence', 3, 1, 2.4], ['bld2', 3, 3, 3.0]], hub: [['stall_noodle', 3, 3, 4.2], ['barrels', 2, 2, 2.4], ['bench', 2, 1, 2.0], ['cables', 1, 1, 1.5]],
      landmark: { spr: 'h_gantry', fw: 2, fd: 2, sw: 4.8, name: 'The Drowned Crane', blurb: 'A container crane half under the tide, still lit by the harbor co-op so boats can find the channel.' },
      signage: ['FISH', 'BOATS', 'TIDE 3M'], crowd: 1, puddles: true } },
  { id: 'dust_yard', name: 'Dustline Salvage', short: 'DUSTLINE', band: [16, 32], faction: 'Harrow-Brandt', theme: 'Desert salvage yard', color: '#e0782a', map: [86, 80], region: 'outskirts',
    blurb: 'Past the last checkpoint the city gives way to sand and wrecks. Salvage crews strip dead haulers under a white sun.',
    dungeons: ['bell_foundry', 'tailings_pit', 'breaker_yard'], under: 'Out here the wrecks bite back. Trade, look, then ride home before you wander past the flags.',
    gen: { seed: 404, w: 80, h: 48, shape: 'oval', stations: ['transit', 'jobs', 'vendor', 'repair', 'gate'], ground: { base: 'slag', planks: 'deck', plaza: 'plaza', debris: 'debris' }, recolor: 'sepia(.55) saturate(1.3) hue-rotate(-8deg) brightness(1.08)', grade: { tint: 'rgba(60,36,10,.14)', vig: 'rgba(18,10,2,.7)' }, lamp: '255,170,80', pulse: 8,
      perimeter: [['junk', 2, 1, 2.8], ['h_junk', 2, 1, 2.8], ['h_container', 4, 2, 3.7], ['h_barrier', 3, 1, 3.0], ['h_crates', 2, 2, 2.6], ['slag_cart', 2, 1, 1.9]], hub: [['h_steam_drums', 2, 2, 2.5], ['h_bench', 2, 1, 2.0], ['h_junk', 2, 1, 2.8], ['h_barrels', 2, 2, 2.4]],
      landmark: { spr: 'ladle_crane', fw: 2, fd: 2, sw: 4.8, name: 'The Hauler Graveyard', blurb: 'Three hundred autonomous haulers parked by a recall order that nobody ever reversed.' },
      signage: ['SALVAGE', 'WATER', 'NO FLY'], crowd: .8, puddles: false } },
  { id: 'harrow', name: 'Harrow Reach', short: 'HARROW', band: [20, 50], faction: 'Harrow-Brandt', theme: 'Foundry terraces', color: '#ff6a3a', map: [70, 70], region: 'rim',
    blurb: 'The Cinderworks: a terraced foundry town built into cooled slag banks under a dead stack. Heavy Works hardware, the Line 7 Retirees\' Guild and the gates to Tier III and IV.', dungeons: [], under: 'Harrow is for crews who already lost their first set of knees. Look around, but the gate here does not care about your feelings.' },
  { id: 'under_bazaar', name: 'The Underbazaar', short: 'BAZAAR', band: [20, 34], faction: 'Quiet Shift', theme: 'Underground market', color: '#46e08a', map: [48, 86], region: 'below',
    blurb: 'A night market in the old metro concourse. Lanterns, cable spaghetti and traders who never ask where the parts came from.',
    dungeons: ['pharmacy_vault', 'outlet_mall', 'night_tunnels', 'gw_audit_tower'], under: 'Bazaar rules: look all you like, touch what you can afford. The tunnels past the gate are not for tourists.',
    gen: { seed: 505, w: 70, h: 50, shape: 'cross', stations: ['transit', 'jobs', 'vendor', 'store', 'bank', 'locker', 'gate'], ground: { base: 'grate', planks: 'planks', plaza: 'plaza', debris: 'debris' }, recolor: 'hue-rotate(95deg) saturate(1.1) brightness(.88)', grade: { tint: 'rgba(6,30,18,.2)', vig: 'rgba(2,8,4,.8)' }, lamp: '120,255,170', pulse: 6,
      perimeter: [['bld1', 3, 3, 3.0], ['bld3', 3, 3, 3.0], ['h_lockers', 1, 2, 1.8], ['crates', 2, 2, 2.5], ['h_cables', 1, 1, 1.5], ['h_bld2', 3, 3, 3.0]], hub: [['stall_junk', 3, 3, 4.0], ['np_lantern_l', 1, 1, 1.0], ['swag2', 1, 1, 1.0], ['stall_goods', 3, 3, 4.1]],
      landmark: { spr: 'tram_platform', fw: 5, fd: 2, sw: 5.6, name: 'Platform Zero', blurb: 'The metro stop that never opened. Its tiled mural still shows a city that was never built.' },
      signage: ['NO CAMERAS', 'CASH ONLY', 'PLATFORM 0'], crowd: 1.4, puddles: true } },
  { id: 'aldane_spire', name: 'Aldane Spire', short: 'SPIRE', band: [26, 40], faction: 'Aldane Surgical', theme: 'Corporate arcology', color: '#f2ecc4', map: [62, 26], region: 'core',
    blurb: 'A white arcology on a clean-air podium. The lower concourse is open to the public, the upper floors are by appointment only.',
    dungeons: ['clinic', 'cold_archive', 'audit_tower', 'aesthetic_ward', 'anechoic_lab', 'gw_liquidation_floor'], under: 'Aldane patients only past the second checkpoint, and you do not look insured. Enjoy the lobby.',
    gen: { seed: 606, w: 66, h: 54, shape: 'oval', stations: ['transit', 'jobs', 'vendor', 'store', 'bank', 'repair', 'gate'], ground: { base: 'cobble', planks: 'deck', plaza: 'plaza', debris: 'grate' }, recolor: 'grayscale(.6) brightness(1.35) contrast(.9)', grade: { tint: 'rgba(30,40,46,.12)', vig: 'rgba(8,10,12,.62)' }, lamp: '220,240,255', pulse: 9,
      perimeter: [['h_bld1', 3, 3, 3.0], ['h_bld3', 3, 3, 3.0], ['h_slab', 3, 1, 2.6], ['barrier', 3, 1, 3.0], ['h_lamp', 1, 1, 1.0]], hub: [['vending', 1, 1, 1.25], ['h_bench', 2, 1, 2.0], ['h_slab', 3, 1, 2.6]],
      landmark: { spr: 'furnace_tower', fw: 3, fd: 3, sw: 5.2, name: 'The Clean Air Column', blurb: 'A forty-storey filter stack. Aldane says the air on the podium is the cleanest in the Basin; it charges for it, too.' },
      signage: ['ALDANE', 'APPOINTMENTS', 'QUIET ZONE'], crowd: .9, puddles: false } },
  { id: 'signal_heights', name: 'Signal Heights', short: 'HEIGHTS', band: [28, 44], faction: 'Rustline Compact', theme: 'Antenna rooftops', color: '#a58bff', map: [24, 30], region: 'rim',
    blurb: 'Rooftop shanties strung between relay masts. Pirate radio, dish farms and the best view of the Spire you will ever get for free.',
    dungeons: ['radio_mast', 'breaker_yard', 'night_tunnels'], under: 'The Heights crews hear everything. Right now they are hearing that you are a few levels short. Look, listen, leave.',
    gen: { seed: 707, w: 62, h: 58, shape: 'terrace', stations: ['transit', 'jobs', 'vendor', 'locker', 'repair', 'gate'], ground: { base: 'deck', planks: 'planks', plaza: 'plaza', debris: 'grate' }, recolor: 'hue-rotate(220deg) saturate(.9) brightness(.95)', grade: { tint: 'rgba(20,14,44,.2)', vig: 'rgba(6,4,14,.74)' }, lamp: '180,150,255', pulse: 7.5,
      perimeter: [['gantry', 2, 2, 2.3], ['h_gantry', 2, 2, 2.3], ['scaffold', 3, 2, 3.2], ['cables', 1, 1, 1.5], ['bld2', 3, 3, 3.0], ['fence', 3, 1, 2.4]], hub: [['cables', 1, 1, 1.5], ['bench', 2, 1, 2.0], ['bulbs', 1, 1, 1.0], ['barrel_fire', 1, 1, 1.4]],
      landmark: { spr: 'h_gantry', fw: 2, fd: 2, sw: 5.0, name: 'Mast Nine', blurb: 'The relay mast that carries half the Basin\'s pirate stations. Its aircraft light pulses once every six seconds.' },
      signage: ['ON AIR', '88.1', 'DISHES'], crowd: 1, puddles: false } },
  { id: 'kestrel_plaza', name: 'Kestrel Plaza', short: 'KESTREL', band: [30, 46], faction: 'Kestrel Value', theme: 'Corp HQ plaza', color: '#ffd84a', map: [78, 36], region: 'core',
    blurb: 'The Kestrel Value head office and its fountain plaza. Every bench is sponsored and every pigeon is tagged.',
    dungeons: ['liquidation_floor', 'parcel_tower', 'warranty_vault', 'freight_depot', 'gw_recall_yard'], under: 'Kestrel security has a list, and your level puts you on it. Window shopping is still free.',
    gen: { seed: 808, w: 70, h: 50, shape: 'oval', stations: ['transit', 'jobs', 'vendor', 'store', 'bank', 'locker', 'gate'], ground: { base: 'cobble', planks: 'cobble', plaza: 'plaza', debris: 'deck' }, recolor: 'hue-rotate(20deg) saturate(1.5) brightness(1.15)', grade: { tint: 'rgba(40,34,6,.12)', vig: 'rgba(12,10,2,.66)' }, lamp: '255,216,74', pulse: 8,
      perimeter: [['h_bld2', 3, 3, 3.0], ['bld1', 3, 3, 3.0], ['barrier', 3, 1, 3.0], ['h_slab', 3, 1, 2.6], ['vending', 1, 1, 1.25]], hub: [['h_bench', 2, 1, 2.0], ['vending', 1, 1, 1.25], ['banner_pole', 1, 1, 2.6], ['bulbs', 1, 1, 1.0]],
      landmark: { spr: 'h_gate_arch', fw: 3, fd: 1, sw: 5.6, name: 'The Value Arch', blurb: 'A gold-leaf arch over the HQ steps, paid for by a one-cent levy on every receipt for ten years.' },
      signage: ['KESTREL VALUE', 'SALE', 'NO LOITERING'], crowd: 1.1, puddles: false } },
  { id: 'tether_base', name: 'Tether Base', short: 'TETHER', band: [38, 50], faction: 'Recall Authority', theme: 'Orbital elevator base', color: '#7af0ff', map: [90, 18], region: 'outskirts',
    blurb: 'The anchor of the orbital elevator, ringed by customs sheds. The Recall Authority checks every crate going up, and keeps the ones it likes.',
    dungeons: ['recall_yard', 'warranty_vault'], under: 'Recall agents eat crews like you before breakfast. See the Tether, buy a postcard, take the tram home.',
    gen: { seed: 909, w: 74, h: 54, shape: 'cross', stations: ['transit', 'jobs', 'vendor', 'bank', 'repair', 'locker', 'gate'], ground: { base: 'grate', planks: 'deck', plaza: 'plaza', debris: 'slag' }, recolor: 'hue-rotate(175deg) saturate(1.2) brightness(1.1)', grade: { tint: 'rgba(6,30,40,.14)', vig: 'rgba(2,8,12,.7)' }, lamp: '122,240,255', pulse: 9.5,
      perimeter: [['h_container', 4, 2, 3.7], ['h_barrier', 3, 1, 3.0], ['h_barrier_corner', 2, 2, 3.2], ['h_gantry', 2, 2, 2.3], ['smokestack', 2, 2, 1.7], ['h_bld3', 3, 3, 3.0]], hub: [['h_slab', 3, 1, 2.6], ['h_bench', 2, 1, 2.0], ['h_lamp', 1, 1, 1.0]],
      landmark: { spr: 'smokestack', fw: 2, fd: 2, sw: 5.6, name: 'The Tether', blurb: 'A ribbon of carbon climbing out of sight. On a clear night you can see the climber cars crawling toward orbit.' },
      signage: ['CUSTOMS', 'RECALL AUTH', 'LIFT 1'], crowd: .9, puddles: false } },
];
export const WORLD_BY_ID: Record<string, WorldTown> = Object.fromEntries(WORLD.map(t => [t.id, t]));
export const GEN_TOWNS = WORLD.filter(t => t.gen);
/** first-visit bonus XP, scaled by how far above the player the town sits */
export const FIRST_VISIT_XP = (t: WorldTown) => 40 + t.band[0] * 6;
export const LANDMARK_XP = (t: WorldTown) => 20 + t.band[0] * 3;
/** Town graph + epic gateway dungeons (docs/WORLD.md). Starter towns are open; every other town is reached over one link whose gateway dungeon
 *  (hosted at the source town's gate, tuned to the destination's entry level) must be cleared once by that character. Party members each record
 *  the clear on their own save (rewards are individual), so everyone in the party unlocks it. */
export const STARTER_TOWNS = ['rustline', 'neon_mile', 'the_stacks'];
export interface Gateway { to: string; from: string; dungeon: string; title: string; arrival: string; }
export const GATEWAYS: Gateway[] = [
  { to: 'salt_harbor', from: 'the_stacks', dungeon: 'gw_coke_ovens', title: 'Through the Slag Ovens', arrival: 'The ovens open onto the old sea wall. Below, the harbor lights float on black water.' },
  { to: 'dust_yard', from: 'salt_harbor', dungeon: 'gw_tailings_pit', title: 'Tailings Crossing', arrival: 'Past the last tailings dam the pit gives way to open sand. Salvage fires flicker on the horizon.' },
  { to: 'harrow', from: 'rustline', dungeon: 'gw_bell_foundry', title: 'The Bell Road', arrival: 'The bell tolls behind you. Ahead, Harrow Reach glows on its slag terraces under the dead stack.' },
  { to: 'under_bazaar', from: 'neon_mile', dungeon: 'gw_pharmacy_vault', title: 'Down the Vault Stairs', arrival: 'The vault\'s service stair drops into the metro concourse. Lanterns, a thousand stalls, nobody looks up.' },
  { to: 'aldane_spire', from: 'under_bazaar', dungeon: 'gw_audit_tower', title: 'Audit Ascent', arrival: 'The auditors\' lift climbs out of the tower and opens on the Spire podium. The air tastes filtered.' },
  { to: 'signal_heights', from: 'harrow', dungeon: 'gw_radio_mast', title: 'Climb the Mast', arrival: 'At the top of the mast the Heights spread out: dishes, shanties and the Spire far across the haze.' },
  { to: 'kestrel_plaza', from: 'aldane_spire', dungeon: 'gw_liquidation_floor', title: 'Final Markdown', arrival: 'The liquidation floor\'s loading doors roll up onto Kestrel Plaza and its gold arch.' },
  { to: 'tether_base', from: 'kestrel_plaza', dungeon: 'gw_recall_yard', title: 'Recall Run', arrival: 'Beyond the yard fence the Tether rises out of sight, climber cars crawling toward orbit.' },
];
export const GATEWAY_TO: Record<string, Gateway> = Object.fromEntries(GATEWAYS.map(g => [g.to, g]));
export const GATEWAY_BY_DUNGEON: Record<string, Gateway> = Object.fromEntries(GATEWAYS.map(g => [g.dungeon, g]));
