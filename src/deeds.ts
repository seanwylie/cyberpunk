// "The city remembers you" (docs/CITY_MEMORY.md): a small per-character log of the player's notable deeds.
// PURE (no DOM, no sim): written by nemesis_sim / cityclient on events, read by the news panel ("Your file"), street chatter and NPC lines.
// Deterministic canned words only: nothing here calls a model. Capped, so the save stays small.
export type DeedKind = 'nem_new' | 'nem_fled' | 'nem_up' | 'nem_kill' | 'clear';
export interface Deed { k: DeedKind; at: number; /** nemesis name / dungeon id */ n: string; /** title, trophy name or dungeon id */ x?: string; d?: string }
export const DEED_CFG = { max: 30, wire: 4, npcDays: 3 };
export const deedsOf = (s: any): Deed[] => { if (!Array.isArray(s.deeds)) s.deeds = []; return s.deeds; };
const clean = (v: any, n = 40) => typeof v === 'string' ? v.replace(/[<>{}\[\]`]/g, '').slice(0, n) : undefined;
export function addDeed(s: any, k: DeedKind, n: string, x?: string, d?: string, now = Date.now()): Deed | null {
  if (!s || !n) return null; const L = deedsOf(s); const last = L[L.length - 1];
  if (last && last.k === k && last.n === n && now - last.at < 5000) return null; // one event, one deed
  const e: Deed = { k, at: now, n: clean(n)!, ...(x ? { x: clean(x) } : {}), ...(d ? { d: clean(d, 32) } : {}) }; L.push(e); if (L.length > DEED_CFG.max) L.splice(0, L.length - DEED_CFG.max); return e; }
/** "Your file" items for the city news panel, newest first. place(id) -> readable dungeon name. */
export function wireItems(s: any, who: string, place: (id: string) => string = id => id.replace(/_/g, ' ')): { h: string; b: string; k: DeedKind }[] {
  const out: { h: string; b: string; k: DeedKind }[] = []; const W = who || 'A runner';
  for (const e of [...deedsOf(s)].reverse()) { if (out.length >= DEED_CFG.wire) break; const at = e.d ? place(e.d) : 'the Basin';
    if (e.k === 'nem_new') out.push({ k: e.k, h: `${e.n} marks ${W}`, b: `Witnesses say ${e.n} put ${W} down in ${at}${e.x ? ' and walked off wearing their ' + e.x : ''}.` });
    else if (e.k === 'nem_fled') out.push({ k: e.k, h: `${W} runs from ${e.n}`, b: `${W} backed out of ${at} with ${e.n} close behind. The street noticed.` });
    else if (e.k === 'nem_up') out.push({ k: e.k, h: `${e.n} climbs to ${e.x || 'Captain'}`, b: `${e.n} is telling every bar how ${W} went down. Again.` });
    else if (e.k === 'nem_kill') out.push({ k: e.k, h: `${W} ends ${e.n}`, b: `${e.n} is off the street for good. ${W} took a mark off the body.` });
    else if (e.k === 'clear') out.push({ k: e.k, h: `${W} clears ${place(e.n)}`, b: `Crews say ${W} walked out of ${place(e.n)} alone.` }); }
  return out; }
/** One street bark about you, or null. */
export function deedBark(s: any, who: string): string | null { const e = deedsOf(s).filter(x => x.k !== 'clear').slice(-1)[0]; if (!e) return null; const W = who || 'that runner';
  return e.k === 'nem_new' ? `Heard ${e.n} put ${W} in the dirt.` : e.k === 'nem_fled' ? `${W} ran from ${e.n}. Saw it myself.` : e.k === 'nem_up' ? `${e.n} won't shut up about ${W}.` : `${W} ended ${e.n}. Cold.`; }
const NPC_LINES: Record<Exclude<DeedKind, 'clear'>, string[]> = {
  nem_new: ['Heard {n} put you down. Word moves fast down here.', '{n} is wearing your gear around town. People are laughing.'],
  nem_fled: ['People saw you run from {n}. Fix that before it sticks.', 'You ran from {n}. Nobody forgets that kind of thing.'],
  nem_up: ['{n} is bragging in every bar. You are the story now.', '{n} got promoted off your back. Embarrassing.'],
  nem_kill: ['You ended {n}. People are saying your name now.', 'So {n} is gone. Remind me never to get on your list.'],
};
/** A line any NPC can open with when you did something the street is talking about (last DEED_CFG.npcDays days). Deterministic. */
export function deedNpcLine(s: any, npc: string, now = Date.now()): string | null { const e = deedsOf(s).filter(x => x.k !== 'clear').slice(-1)[0];
  if (!e || now - e.at > DEED_CFG.npcDays * 864e5) return null; const L = NPC_LINES[e.k as Exclude<DeedKind, 'clear'>]; let h = 0; for (const c of npc) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return L[(h + e.at) % L.length].replace('{n}', e.n); }
