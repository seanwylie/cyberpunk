// Premium skin lines, extra cosmetic slots (emote / recall / weapon / pet), season pass rewards, founder + earn-only exclusives,
// and the RETIREMENT REGISTRY. Pure data (no DOM). Appended to COSMETICS by src/content/appearance.ts.
// Cosmetic only: no row here has (or can have) a stats field. See docs/MONETIZATION.md.
import type { Rarity } from '../config';

/** Store tier ladder (classic premium-store style). rarity = the colour the tier reads as in game. */
export type SkinTier = 'standard' | 'epic' | 'legendary' | 'ultimate';
export const TIER: Record<SkinTier, { label: string; rarity: Rarity; cents: number; tip: string }> = {
  standard:  { label: 'Standard',  rarity: 'blue',   cents: 499,  tip: 'Recolour and material pass on an existing body.' },
  epic:      { label: 'Epic',      rarity: 'purple', cents: 999,  tip: 'New body silhouette or tint plus painted accents and an idle flourish.' },
  legendary: { label: 'Legendary', rarity: 'orange', cents: 1799, tip: 'New Blender-rendered body, integrated emissives, custom recall, ability flourish and sounds.' },
  ultimate:  { label: 'Ultimate',  rarity: 'orange', cents: 2499, tip: 'Legendary plus a crest, custom emote, pet drone and weapon skin in one.' },
};
export const CHROMA_CENTS = 299;

export interface LineDef { id: string; name: string; theme: string; pal: [string, string, string]; blurb: string; reward: string; }
/** pal = [primary, secondary, emissive]. reward = cosmetic id granted once when every skin in the line is owned. */
export const LINES: LineDef[] = [
  { id: 'arcforge', name: 'Arc-Forge Saint',     theme: 'Gold and blue crystalline order',            pal: ['#efe6cf', '#d7a63e', '#5ac8ff'], blurb: 'Aldane commissioned saints of polished enamel and cut crystal to walk the Spire.', reward: 'col_arcforge_halo' },
  { id: 'bloom',   name: 'Chrome Bloom',      theme: 'Pink and violet biotech shimmer',            pal: ['#e9dcf0', '#b98ad8', '#ff5ccf'], blurb: 'Grown, not built: chrome petals that open under neon.', reward: 'col_bloom_petals' },
  { id: 'ronin',   name: 'Neon Ronin',        theme: 'Black lacquer, red cord, cyan edge',         pal: ['#1b1b20', '#a5302c', '#3ff0ff'], blurb: 'Masterless operators who sold their contracts and kept the blade.', reward: 'col_ronin_banner' },
  { id: 'undercity', name: 'Undercity Alchemist', theme: 'Industrial alchemy, brass and green fog', pal: ['#3b4a3a', '#b08a3e', '#7dff8a'], blurb: 'Pipefitters of the lower Basin who turn slag and steam into light.', reward: 'col_undercity_lantern' },
  { id: 'void',    name: 'Void Warranty',     theme: 'Corrupted glitch premium',                   pal: ['#15121c', '#5b3a8f', '#c06bff'], blurb: 'Items whose warranty expired somewhere it should not have.', reward: 'col_void_sigil' },
  { id: 'founder', name: 'Founder',           theme: 'Blackened brass, oxblood, amber filament',   pal: ['#3a2f26', '#b88a46', '#ffb04a'], blurb: 'Launch-window line. Sold for one window only, then retired for good.', reward: 'col_founder_plate' },
];
export const LINE_BY_ID: Record<string, LineDef> = Object.fromEntries(LINES.map(l => [l.id, l]));

/** Blender bodies shipped in public/sprites/v/<name>/ (tools/sprites/variants_premium.py). */
/** Chroma = compose-time CSS filter applied to a body's layers (cached per signature, zero per-frame cost). */
export const CHROMA_FILTER: Record<string, string> = {
  ruby: 'hue-rotate(160deg) saturate(1.15)', obsidian: 'saturate(.35) brightness(.72) contrast(1.15)', jade: 'hue-rotate(-70deg) saturate(1.1)',
  frost: 'hue-rotate(-150deg) saturate(.8) brightness(1.08)', gold: 'hue-rotate(40deg) saturate(1.3) brightness(1.05)', ember: 'hue-rotate(25deg) saturate(1.4)',
  violet: 'hue-rotate(80deg) saturate(1.2)', ash: 'saturate(.15) brightness(1.05)', teal: 'hue-rotate(-110deg) saturate(1.1)', rose: 'hue-rotate(120deg) saturate(1.2)',
};

/** Dated release window. Once `until` passes the item is RETIRED forever (never sold, re-listed or granted again). */
export interface Window { from: string; until: string; kind: 'launch' | 'event' | 'season' | 'founder'; }

export type PmSrc =
  | { k: 'shop'; tier: SkinTier; line: string; cents: number; window?: Window }   // direct purchase in the sim store
  | { k: 'chroma'; of: string; cents: number; window?: Window }                  // colour variant, requires the base skin
  | { k: 'pass'; season: string; level: number; track: 'free' | 'premium'; window: Window }
  | { k: 'collection'; line: string }                                            // reward for owning a full line
  | { k: 'starter' }                                                             // first-purchase starter pack only
  | { k: 'exclusive'; key: string; how: string; window: Window }
  | { k: 'bundled'; with: string };                                             // included with a Legendary/Ultimate skin, never sold alone                // earn-only, one-time achievement or event

export interface PmRow {
  id: string; name: string; slot: string; rarity: Rarity; style: string; c: string; c2?: string; desc: string; lore: string; src: PmSrc;
  /** full-body sprite set (Blender) for skin rows, optionally with @chroma */ body?: string; line?: string; tier?: SkinTier;
}

const W_FOUNDER: Window = { from: '2026-10-01', until: '2026-11-01', kind: 'founder' };
const W_LAUNCHWEEK: Window = { from: '2026-10-05', until: '2026-10-19', kind: 'launch' };
const W_ALPHA: Window = { from: '2026-08-01', until: '2026-09-30', kind: 'event' };
export const SEASON = { id: 's1', name: 'Season 1: Neon Saints', window: { from: '2026-10-01', until: '2026-12-31', kind: 'season' } as Window, levels: 30, xpPerLevel: 1000, premiumCents: 999 };

const shop = (tier: SkinTier, line: string, window?: Window): PmSrc => ({ k: 'shop', tier, line, cents: TIER[tier].cents, ...(window ? { window } : {}) });
const chroma = (of: string, window?: Window): PmSrc => ({ k: 'chroma', of, cents: CHROMA_CENTS, ...(window ? { window } : {}) });
const sk = (id: string, name: string, line: string, tier: SkinTier, style: string, body: string | undefined, desc: string, lore: string, window?: Window): PmRow => {
  const L = LINE_BY_ID[line]; return { id, name, slot: 'skin', rarity: TIER[tier].rarity, style, c: L.pal[2], c2: L.pal[1], desc, lore, src: shop(tier, line, window), body, line, tier };
};
const ch = (base: PmRow, key: string, name: string): PmRow => ({ ...base, id: base.id + '__' + key, name: base.name + ': ' + name, desc: name + ' chroma of ' + base.name + '.', src: chroma(base.id, (base.src as any).window), body: (base.body || 'base') + '@' + key });

// ---- skins: 1 Legendary/Ultimate (Blender body) + 2-3 Epics per line, chromas on the top skin
const HEX_U = sk('pm_arcforge_saint', 'Arc-Forge Saint', 'arcforge', 'ultimate', 'line_hex', 'arcforge', 'Ivory enamel, brushed gold and a floating crystal halo. Crystal pauldrons hum when you cast.', 'The Spire canonised exactly one runner. The paperwork is still pending.');
const BLM_L = sk('pm_bloom_empress', 'Chrome Bloom Empress', 'bloom', 'legendary', 'line_bloom', 'bloom', 'Pearl chrome over orchid biotech, petal fins that open on every ability.', 'She was grown in a vat of light and never learned to be quiet.');
const RON_L = sk('pm_neon_ronin', 'Neon Ronin', 'ronin', 'legendary', 'line_ronin', 'ronin', 'Lacquered plate, a wide kasa with a neon brim and a scabbard across the back.', 'No master, no contract, one blade that remembers every warranty it voided.');
const FND_L = sk('pm_founder_mark', 'Founder\'s Mark', 'founder', 'legendary', 'line_founder', 'founder', 'Blackened brass, an oxblood mantle and a single amber filament pin.', 'Struck for the first crews through the gate. Never struck again.', W_FOUNDER);
export const PM_ROWS: PmRow[] = [
  HEX_U, ch(HEX_U, 'ruby', 'Ruby'), ch(HEX_U, 'obsidian', 'Obsidian'), ch(HEX_U, 'jade', 'Jade'),
  sk('pm_arcforge_warden', 'Arc-Forge Warden', 'arcforge', 'epic', 'line_hex', 'surgical@gold', 'Gilded surgical plate with a glowing hex core.', 'Spire honour guard. Ceremonial, mostly.'),
  sk('pm_arcforge_lancer', 'Arc-Forge Lancer', 'arcforge', 'epic', 'line_hex', 'market@frost', 'Frost-blue lancer kit with crystal cuffs.', 'Lancers carry the light up the Spire stairs.'),
  BLM_L, ch(BLM_L, 'violet', 'Nightshade'), ch(BLM_L, 'jade', 'Verdant'), ch(BLM_L, 'frost', 'Glasswing'),
  sk('pm_bloom_courier', 'Bloom Courier', 'bloom', 'epic', 'line_bloom', 'market@rose', 'Rose-chrome courier shell with petal vents.', 'Delivers anywhere petals can drift.'),
  sk('pm_bloom_medic', 'Orchid Medic', 'bloom', 'epic', 'line_bloom', 'surgical@rose', 'Clinic whites dyed orchid, with a soft pink inlay.', 'Ward 9 never forgot her.'),
  RON_L, ch(RON_L, 'gold', 'Shogun Gold'), ch(RON_L, 'frost', 'White Lotus'), ch(RON_L, 'ash', 'Ash'),
  sk('pm_ronin_initiate', 'Ronin Initiate', 'ronin', 'epic', 'line_ronin', 'heavy@obsidian', 'Black lacquer heavy frame with a red cord.', 'Everyone starts by sweeping the dojo.'),
  sk('pm_street_ronin', 'Street Ronin', 'ronin', 'epic', 'line_ronin', 'market@teal', 'Teal-wrapped street kit with a neon edge.', 'Neon Mile is the only dojo left.'),
  sk('pm_undercity_pipefitter', 'Undercity Pipefitter', 'undercity', 'epic', 'line_under', 'heavy@jade', 'Brass and verdigris plate, green lantern glow.', 'Fixes the pipes nobody else will crawl into.'),
  sk('pm_undercity_alchemist', 'Undercity Alchemist', 'undercity', 'epic', 'line_under', 'surgical@jade', 'Brass goggles, apron and a glass flask of green fog.', 'Turns slag into light. Turns light into rent.'),
  sk('pm_void_auditor', 'Void Auditor', 'void', 'epic', 'line_void', 'surgical@violet', 'Corrupted audit whites with a glitching seam.', 'Audited the void. The void filed a complaint.'),
  sk('pm_void_breach', 'Void Breach', 'void', 'epic', 'line_void', 'heavy@violet', 'Heavy frame fractured with violet glitch light.', 'Some warranties should not be voided.'),
  sk('pm_arcforge_standard', 'Arc-Forge Recruit', 'arcforge', 'standard', 'line_hex', 'base@gold', 'Gold-tinted recruit kit.', 'Everyone wants to be a saint.'),
  FND_L, ch(FND_L, 'ember', 'Ember'),
  // ---- extra slots
  { id: 'emote_wave', name: 'Shift Change Wave', slot: 'emote', rarity: 'blue', style: 'wave', c: '#9fd8ff', desc: 'A tired two-finger wave.', lore: 'End of shift, every shift.', src: { k: 'starter' } },
  { id: 'emote_bow', name: 'Ronin Bow', slot: 'emote', rarity: 'purple', style: 'bow', c: '#3ff0ff', desc: 'A slow bow with a neon blade salute.', lore: 'Respect, then violence.', src: shop('standard', 'ronin'), line: 'ronin', tier: 'standard' },
  { id: 'emote_hexsign', name: 'Hex Benediction', slot: 'emote', rarity: 'purple', style: 'hexsign', c: '#5ac8ff', desc: 'Traces a glowing hex sigil in the air.', lore: 'Blessed by procurement.', src: shop('standard', 'arcforge'), line: 'arcforge', tier: 'standard' },
  { id: 'emote_salute', name: 'Pass Salute', slot: 'emote', rarity: 'green', style: 'wave', c: '#e8c46a', desc: 'Crisp salute.', lore: 'Season 1 free track.', src: { k: 'pass', season: 's1', level: 5, track: 'free', window: SEASON.window } },
  { id: 'recall_arcforge', name: 'Arc-Forge Ascension', slot: 'recall', rarity: 'orange', style: 'arcforge', c: '#5ac8ff', c2: '#d7a63e', desc: 'Crystal lattice rises and folds you into light.', lore: 'Included with Arc-Forge Saint.', src: { k: 'bundled', with: 'pm_arcforge_saint' } },
  { id: 'recall_bloom', name: 'Petal Fold', slot: 'recall', rarity: 'orange', style: 'bloom', c: '#ff5ccf', c2: '#b98ad8', desc: 'Chrome petals close around you and open somewhere else.', lore: 'Included with Chrome Bloom Empress.', src: { k: 'bundled', with: 'pm_bloom_empress' } },
  { id: 'recall_ronin', name: 'Iaido Step', slot: 'recall', rarity: 'orange', style: 'ronin', c: '#3ff0ff', c2: '#a5302c', desc: 'Sheathe, one clean cut of light, gone.', lore: 'Included with Neon Ronin.', src: { k: 'bundled', with: 'pm_neon_ronin' } },
  { id: 'recall_founder', name: 'Founder\'s Bell', slot: 'recall', rarity: 'orange', style: 'founder', c: '#ffb04a', c2: '#b88a46', desc: 'A brass bell tolls once and the floor turns to amber.', lore: 'Launch window only.', src: { k: 'bundled', with: 'pm_founder_mark' } },
  { id: 'recall_glitch', name: 'Void Unwarranty', slot: 'recall', rarity: 'purple', style: 'void', c: '#c06bff', desc: 'You are briefly declared out of warranty.', lore: 'Season 1 premium track.', src: { k: 'pass', season: 's1', level: 20, track: 'premium', window: SEASON.window } },
  { id: 'weapon_hexblade', name: 'Arc-Forge Reliquary Blade', slot: 'weapon', rarity: 'purple', style: 'hexblade', c: '#5ac8ff', c2: '#d7a63e', desc: 'Gilded edge with a crystal core. Appearance only.', lore: 'Ceremonial. Sharp anyway.', src: shop('standard', 'arcforge'), line: 'arcforge', tier: 'standard' },
  { id: 'weapon_neon_katana', name: 'Neon Katana', slot: 'weapon', rarity: 'purple', style: 'katana', c: '#3ff0ff', c2: '#a5302c', desc: 'A lacquered blade with a cyan edge. Appearance only.', lore: 'Made from a scrapped tram rail.', src: shop('standard', 'ronin'), line: 'ronin', tier: 'standard' },
  { id: 'weapon_bloom_thorn', name: 'Bloom Thorn', slot: 'weapon', rarity: 'purple', style: 'thorn', c: '#ff5ccf', c2: '#e9dcf0', desc: 'A grown-chrome thorn blade. Appearance only.', lore: 'Pruned, not forged.', src: { k: 'pass', season: 's1', level: 25, track: 'premium', window: SEASON.window } },
  { id: 'pet_drone_scout', name: 'Scout Drone', slot: 'pet', rarity: 'blue', style: 'scout', c: '#9fd8ff', desc: 'A palm-sized hover drone that follows you around.', lore: 'Does nothing useful. Loves you anyway.', src: { k: 'starter' } },
  { id: 'pet_drone_hex', name: 'Hex Seraph', slot: 'pet', rarity: 'orange', style: 'hex', c: '#5ac8ff', c2: '#d7a63e', desc: 'A gilded drone with a crystal heart.', lore: 'Included with Arc-Forge Saint.', src: { k: 'bundled', with: 'pm_arcforge_saint' } },
  { id: 'pet_drone_moth', name: 'Chrome Moth', slot: 'pet', rarity: 'purple', style: 'moth', c: '#ff5ccf', c2: '#e9dcf0', desc: 'A chrome moth that glows when you stand still.', lore: 'Season 1 premium track.', src: { k: 'pass', season: 's1', level: 30, track: 'premium', window: SEASON.window } },
  { id: 'pass_s1_visor', name: 'Saint\'s Visor', slot: 'head', rarity: 'blue', style: 'visor', c: '#5ac8ff', c2: '#fff', desc: 'Pale blue visor from Season 1.', lore: 'Season 1 free track.', src: { k: 'pass', season: 's1', level: 10, track: 'free', window: SEASON.window } },
  { id: 'pass_s1_trail', name: 'Neon Saints Trail', slot: 'trail', rarity: 'purple', style: 'sparks', c: '#5ac8ff', desc: 'Pale blue sparks.', lore: 'Season 1 premium track.', src: { k: 'pass', season: 's1', level: 10, track: 'premium', window: SEASON.window } },
  { id: 'pass_s1_aura', name: 'Saint\'s Glow', slot: 'aura', rarity: 'purple', style: 'glow', c: '#5ac8ff', desc: 'Soft blue floor glow.', lore: 'Season 1 premium track.', src: { k: 'pass', season: 's1', level: 15, track: 'premium', window: SEASON.window } },
  // ---- collection rewards (own every skin in the line)
  { id: 'col_arcforge_halo', name: 'Saint\'s Halo', slot: 'head', rarity: 'purple', style: 'halo', c: '#d7a63e', desc: 'Collection reward: Arc-Forge Saint line.', lore: 'Complete the line.', src: { k: 'collection', line: 'arcforge' } },
  { id: 'col_bloom_petals', name: 'Petal Drift', slot: 'aura', rarity: 'purple', style: 'haze', c: '#ff5ccf', desc: 'Collection reward: Chrome Bloom line.', lore: 'Complete the line.', src: { k: 'collection', line: 'bloom' } },
  { id: 'col_ronin_banner', name: 'Ronin Banner', slot: 'back', rarity: 'purple', style: 'banner', c: '#a5302c', c2: '#3ff0ff', desc: 'Collection reward: Neon Ronin line.', lore: 'Complete the line.', src: { k: 'collection', line: 'ronin' } },
  { id: 'col_undercity_lantern', name: 'Undercity Lantern', slot: 'aura', rarity: 'purple', style: 'mist', c: '#7dff8a', desc: 'Collection reward: Undercity Alchemist line.', lore: 'Complete the line.', src: { k: 'collection', line: 'undercity' } },
  { id: 'col_void_sigil', name: 'Void Sigil', slot: 'tattoo', rarity: 'purple', style: 'stamp', c: '#c06bff', desc: 'Collection reward: Void Warranty line.', lore: 'Complete the line.', src: { k: 'collection', line: 'void' } },
  { id: 'col_founder_plate', name: 'Founder\'s Plate', slot: 'back', rarity: 'orange', style: 'disc', c: '#ffb04a', c2: '#b88a46', desc: 'Collection reward: Founder line.', lore: 'Own the full launch line.', src: { k: 'collection', line: 'founder' } },
  // ---- earn-only exclusives (never sold)
  { id: 'ex_launch_week_halo', name: 'Launch Week Halo', slot: 'aura', rarity: 'orange', style: 'ring', c: '#ffb04a', desc: 'Earned by clearing any dungeon during launch week.', lore: 'You were there the week the gates opened.', src: { k: 'exclusive', key: 'launch_week_clear', how: 'Clear any dungeon during launch week', window: W_LAUNCHWEEK } },
  { id: 'ex_world_first_gateway', name: 'Gateway Breaker Crest', slot: 'head', rarity: 'orange', style: 'crown', c: '#ffd36a', c2: '#5a3a14', desc: 'Earned by being among the first crews to clear a gateway dungeon.', lore: 'First through the gate. The gate remembers.', src: { k: 'exclusive', key: 'world_first_gateway', how: 'Clear a gateway dungeon during the launch window', window: W_FOUNDER } },
  { id: 'ex_alpha_visor', name: 'Alpha Tester Visor', slot: 'eyes', rarity: 'purple', style: 'slit', c: '#7affc0', desc: 'Earned by playing the closed alpha.', lore: 'You saw it when it was held together with tape.', src: { k: 'exclusive', key: 'alpha_tester', how: 'Play the closed alpha', window: W_ALPHA } },
];
/** What a Legendary/Ultimate purchase also grants (never sold alone). */
export const INCLUDES: Record<string, string[]> = {};
for (const r of PM_ROWS) if (r.src.k === 'bundled') (INCLUDES[r.src.with] ??= []).push(r.id);
