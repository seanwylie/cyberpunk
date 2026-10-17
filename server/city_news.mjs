// Living city weekly news (docs/LIVING_CITY.md). Plain ESM so the news Lambda, the hub and tests share it.
// buildFacts(): the ONLY input the writer sees, derived from the real aggregated week. AI writes words only; validateItem() rejects any line that
// names a place/faction/player or a number that is not in the facts, or claims a takeover without a flip fact. Canned writer is the fallback.
export const NEWS = { maxItems: 6, minItems: 3, maxChars: 170, chatter: 8, maxTokens: 700, timeoutMs: 15000 };
const FSHORT = { 'Rustline Compact': 'Compact', 'Kestrel Value': 'Kestrel', 'Harrow-Brandt': 'Harrow-Brandt', 'Aldane Surgical': 'Aldane', 'Quiet Shift': 'Quiet Shift', 'Recall Authority': 'Recall' };
const FACTIONS = Object.keys(FSHORT);
/** state: persisted CityState (+ names {towns:{id:name}}). week: which aggregate ('prev' = last full week, default; 'week' = this week so far). */
export function buildFacts(state, names, which = 'prev') {
  const wk = (which === 'prev' ? state.prev : state.week) || state.week || { dist: {}, flips: [], players: {} }; const towns = names?.towns || {}; const facts = [];
  let i = 0; const add = (o) => { o.id = 'f' + (++i); facts.push(o); return o; };
  for (const fl of wk.flips || []) add({ type: 'flip', d: fl.d, town: towns[fl.d] || fl.d, from: fl.from, to: fl.to });
  const rows = Object.entries(wk.dist || {}).map(([d, a]) => ({ d, a, tot: Object.values(a).reduce((x, y) => x + y, 0) })).sort((x, y) => y.tot - x.tot);
  for (const r of rows.slice(0, 5)) { const D = state.dist?.[r.d]; add({ type: 'district', d: r.d, town: towns[r.d] || r.d, holder: D ? FACTIONS[D.ctrl] : undefined, tension: D ? Math.round(D.tension) : undefined, clears: r.a.clear || 0, gateways: r.a.gateway || 0, kills: r.a.kill || 0, hacks: r.a.hack || 0, talks: (r.a.speech_ok || 0) }); }
  for (const [d, D] of Object.entries(state.dist || {})) if (D.tension >= 75 && !rows.slice(0, 5).some(r => r.d === d)) add({ type: 'hot', d, town: towns[d] || d, holder: FACTIONS[D.ctrl], tension: Math.round(D.tension) });
  const ps = Object.values(wk.players || {}).filter(p => p && p.name && (p.clears + p.gateways + (p.nems || 0)) > 0).sort((a, b) => (b.clears + 3 * b.gateways + 5 * (b.nems || 0)) - (a.clears + 3 * a.gateways + 5 * (a.nems || 0))).slice(0, 3);
  for (const p of ps) add({ type: 'player', name: p.name, clears: p.clears, gateways: p.gateways, ...(p.nems ? { nemeses: p.nems } : {}) }); // only opted-in players are ever stored with a name
  return { wk: wk.wk, facts };
}
/** entities + numbers a line may mention */
export function vocab(F) {
  const ents = new Set(), nums = new Set(); for (const f of F.facts) for (const [k, v] of Object.entries(f)) { if (k === 'id' || k === 'type' || k === 'd') continue; if (typeof v === 'number') nums.add(String(v)); else if (typeof v === 'string') { ents.add(v); if (FSHORT[v]) ents.add(FSHORT[v]); } }
  return { ents, nums };
}
const ALL_KNOWN = (names, players) => [...Object.values(names?.towns || {}), ...FACTIONS, ...Object.values(FSHORT), ...players];
const BANNED = /https?:|www\.|<|>|[`{}\[\]*_#~|]|\bAs an AI\b|\b(?:drugs?|narcotics?|cocaine|coke|heroin|meth|dealers?|junkies?|pills?|overdos\w*|stoned|high on|stims?)\b|\bprompt\b|\blanguage model\b|openai|chatgpt/i;
const STOP = new Set('The A An In On At Of And But Or For To By With From This That These Those It Its Their They We You Your Our Word Street News Basin City Rumor Rumour Meanwhile Word Crews Crew Runners Runner Week Weekend Reach Line Mercs Fixers Odalys'.split(' '));
/** true when the line only states facts: every known name it mentions is in the cited facts' vocabulary, every number is a fact number, and a takeover verb needs a flip fact. */
export function validateItem(text, F, names, allPlayers = []) {
  if (typeof text !== 'string') return false; const s = text.trim(); if (s.length < 12 || s.length > NEWS.maxChars || BANNED.test(s)) return false;
  const { ents, nums } = vocab(F); for (const n of s.match(/\d[\d,.]*/g) || []) if (!nums.has(n.replace(/[,.]$/, '').replace(/,/g, ''))) return false;
  for (const k of ALL_KNOWN(names, allPlayers)) if (k && new RegExp('\\b' + k.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&') + '\\b', 'i').test(s) && ![...ents].some(e => e.toLowerCase() === k.toLowerCase() || e.toLowerCase().includes(k.toLowerCase()))) return false;
  const words = [...ents].flatMap(e => e.split(/[\s-]+/)); for (const m of s.matchAll(/(?<![.!?]\s|^)\b([A-Z][a-z]+(?:[-'][A-Za-z]+)?)/g)) { const w = m[1]; if (!STOP.has(w) && !words.some(x => x.toLowerCase() === w.toLowerCase())) return false; }
  if (/\b(took|takes|seized|seizes|flipped|captured|lost|won|now holds|taken over|takeover)\b/i.test(s) && !F.facts.some(f => f.type === 'flip')) return false;
  return true;
}
/** Canned writer: deterministic headlines straight from the facts (also the fallback when AI is off, fails or is rejected). */
export function cannedNews(F) {
  const out = [], chatter = []; const sh = f => FSHORT[f] || f;
  for (const f of F.facts) {
    if (f.type === 'flip') { out.push({ h: `${sh(f.to)} takes ${f.town}`, b: `${f.from} lost its hold on ${f.town}. ${f.to} runs the streets now.`, d: f.d, src: [f.id] }); chatter.push({ d: f.d, line: `${sh(f.to)} runs ${f.town} now. Mind your step.` }); }
    else if (f.type === 'district') { const bits = [f.clears ? `${f.clears} clears` : '', f.hacks ? `${f.hacks} hacks` : '', f.talks ? `${f.talks} deals talked down` : ''].filter(Boolean).join(', '); if (!bits) continue;
      out.push({ h: `Busy week in ${f.town}`, b: `Crews logged ${bits}.${f.holder ? ` ${sh(f.holder)} still holds it.` : ''}`, d: f.d, src: [f.id] }); chatter.push({ d: f.d, line: f.tension >= 55 ? `${f.town} is on edge. Tension at ${f.tension}.` : `Lot of crews through ${f.town} lately.` }); }
    else if (f.type === 'hot') { out.push({ h: `${f.town} on edge`, b: `Tension hit ${f.tension}. ${sh(f.holder)} is nervous.`, d: f.d, src: [f.id] }); chatter.push({ d: f.d, line: `Heard ${f.town} is about to blow.` }); }
    else if (f.type === 'player' && f.nemeses) { out.push({ h: `${f.name} settles a score`, b: `${f.name} put down ${f.nemeses === 1 ? 'a nemesis' : f.nemeses + ' nemeses'} this week${f.clears ? ` and logged ${f.clears} clears` : ''}.`, src: [f.id] }); chatter.push({ line: `${f.name} hunts the ones that hunt them.` }); }
    else if (f.type === 'player') { out.push({ h: `${f.name} on a tear`, b: `${f.clears} clears${f.gateways ? ` and ${f.gateways} gateways` : ''} this week.`, src: [f.id] }); chatter.push({ line: `${f.name}? Saw that crew come back loaded.` }); }
  }
  if (!out.length) out.push({ h: 'Quiet week in the Basin', b: 'No turf changed hands. The fixers are bored.', src: [] });
  return { items: out.slice(0, NEWS.maxItems), chatter: chatter.slice(0, NEWS.chatter) };
}
export const SYSTEM = 'You write a short weekly street-news feed for a cyberpunk city in a game. Use ONLY the JSON facts given. Never invent places, groups, people, numbers or events. Never mention drugs. Return JSON {"items":[{"h":"headline <=40 chars","b":"body <=120 chars","src":["fact ids"]}],"chatter":[{"src":"fact id","line":"street bark <=80 chars"}]}. Max 6 items, 8 chatter lines. Gritty, terse, no emoji.';
/** Generate the feed: AI (if callAI given) with validation, filled/replaced by canned lines. Never throws. */
export async function generateNews(state, names, callAI, now = Date.now()) {
  const F = buildFacts(state, names); const canned = cannedNews(F); const players = Object.values(state.prev?.players || {}).map(p => p.name); let items = [], chatter = [], src = 'canned', why = '';
  if (callAI && F.facts.length) { try { const r = await callAI(SYSTEM, JSON.stringify({ week: F.wk, facts: F.facts })); const j = JSON.parse(String(r || '').replace(/^```(json)?|```$/g, ''));
      const sub = ids => ({ wk: F.wk, facts: F.facts.filter(f => (ids || []).includes(f.id)) });
      items = (j.items || []).slice(0, NEWS.maxItems).filter(it => it && validateItem(it.h, sub(it.src), names, players) && validateItem(it.b, sub(it.src), names, players)).map(it => ({ h: it.h, b: it.b, src: it.src, d: F.facts.find(f => f.id === it.src?.[0])?.d }));
      chatter = (j.chatter || []).slice(0, NEWS.chatter).filter(c => c && validateItem(c.line, sub([c.src]), names, players)).map(c => ({ line: c.line, d: F.facts.find(f => f.id === c.src)?.d }));
      if (items.length >= Math.min(NEWS.minItems, canned.items.length)) src = 'ai'; else { why = 'rejected'; items = []; chatter = []; } } catch (e) { why = 'error'; } }
  if (src === 'canned') { items = canned.items; chatter = canned.chatter; }
  return { ok: true, wk: F.wk, at: now, src, why, items, chatter, facts: F.facts.length };
}
