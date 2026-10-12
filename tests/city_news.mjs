// Weekly city news: facts come only from the aggregated week; AI lines naming anything not in the facts (places, factions, players, numbers,
// takeovers) are rejected; opted-out players never appear; canned fallback on no key / error / garbage; Lambda handler wiring.
import { load, mkTest } from './net_lib.mjs'; import fs from 'fs';
const { ok, done } = mkTest(); const C = await load('src/city.ts', 'cityn'); const N = await import('../server/city_news.mjs');
const H = 36e5, T0 = Date.UTC(2026, 9, 6, 12); const s = C.newCity(T0); C.notePlayer(s, 'g1', 'Vexa'); s.week.players.g2 = undefined; delete s.week.players.g2;
for (let h = 0; h < 6; h++) C.applyEvents(s, [{ k: 'clear', d: 'neon_mile', f: 'Kestrel Value', n: 30, who: 'g1' }, { k: 'hack', d: 'the_stacks', f: 'Rustline Compact', n: 4 }], T0 + h * H);
C.applyEvents(s, [{ k: 'speech', d: 'salt_harbor', f: 'Rustline Compact', ok: true, n: 2 }], T0); C.rollWeek(s, T0 + 7 * 24 * H); // that week is now "prev"
const names = { towns: { neon_mile: 'Neon Mile', the_stacks: 'The Stacks', salt_harbor: 'Saltwater Harbor', rustline: 'Rustline Market', harrow: 'Harrow Reach', aldane_spire: 'Aldane Spire' } };
const F = N.buildFacts(s, names); const flip = F.facts.find(f => f.type === 'flip'), nm = F.facts.find(f => f.type === 'district' && f.d === 'neon_mile'), pl = F.facts.find(f => f.type === 'player');
ok(flip && flip.town === 'Neon Mile' && flip.from === 'Kestrel Value', `facts include the real flip (${flip?.from} -> ${flip?.to})`);
ok(nm && nm.clears === s.prev.dist.neon_mile.clear && nm.hacks === 0, `facts carry the real aggregated counts (Neon Mile clears ${nm?.clears})`);
ok(pl && pl.name === 'Vexa' && pl.clears === 180, 'opted-in player in the facts with their real tally');
const canned = N.cannedNews(F); ok(canned.items.length >= 3 && canned.items.every(i => N.validateItem(i.h, F, names) && N.validateItem(i.b, F, names)), 'every canned line passes the fact validator');
ok(canned.items.some(i => /takes Neon Mile/.test(i.h)) && canned.items.some(i => i.b.includes(String(nm.clears))), 'canned headlines report the flip and the real numbers');
// validator: invented facts are rejected
const bad = ['Aldane seized Harrow Reach overnight.', 'Neon Mile saw 9999 clears this week.', 'Kestrel Value hired Jaxx Ortega to retake Neon Mile.', 'Moth topped the board in Neon Mile.', 'Riots spread to Glasshouse Row and Neon Mile.', 'Crews hit Neon Mile hard, mostly high on stims.'];
for (const b of bad) ok(!N.validateItem(b, F, names, ['Vexa', 'Moth']), 'rejects invented fact: ' + b);
const good = [`${flip.to.split(' ')[0] === 'Rustline' ? 'Compact' : flip.to} takes Neon Mile`, `Crews logged ${nm.clears} clears in Neon Mile.`, 'Vexa on a tear: 180 clears this week.'];
for (const g of good) ok(N.validateItem(g, F, names, ['Vexa', 'Moth']), 'accepts factual line: ' + g);
{ const s2 = C.newCity(T0); C.applyEvents(s2, [{ k: 'hack', d: 'rustline', f: 'Rustline Compact', n: 2 }], T0); C.rollWeek(s2, T0 + 7 * 24 * H); const F2 = N.buildFacts(s2, names); ok(!N.validateItem('Kestrel took Rustline Market.', F2, names), 'takeover claims need a flip fact'); }
// privacy: an opted-out player is never stored, so never in facts or text
{ const s3 = C.newCity(T0); C.notePlayer(s3, 'a', 'Moth'); C.notePlayer(s3, 'a', null); C.applyEvents(s3, [{ k: 'clear', d: 'rustline', f: 'Rustline Compact', who: 'a' }], T0); C.rollWeek(s3, T0 + 7 * 24 * H); const n3 = await N.generateNews(s3, names, null); ok(!JSON.stringify(n3).includes('Moth'), 'opted-out player never appears in the feed'); }
// AI path: valid JSON kept, invented lines dropped, garbage -> canned fallback, errors -> canned
const ai = async () => JSON.stringify({ items: [{ h: 'Neon Mile changes hands', b: `Kestrel Value lost its grip on Neon Mile.`, src: [flip.id] }, { h: 'Busy Neon Mile', b: `Crews logged ${nm.clears} clears.`, src: [nm.id] }, { h: 'Vexa runs hot', b: 'Vexa logged 180 clears.', src: [pl.id] }, { h: 'Aldane moves in', b: 'Aldane seized Harrow Reach.', src: [nm.id] }], chatter: [{ src: nm.id, line: 'Neon Mile is jumping.' }, { src: nm.id, line: 'Heard Jaxx Ortega runs it now.' }] });
const n1 = await N.generateNews(s, names, ai); ok(n1.src === 'ai' && n1.items.length === 3 && !n1.items.some(i => /Aldane/.test(i.b)), `AI lines validated: 3 kept, invented one dropped (${n1.items.map(i => i.h).join(' | ')})`);
ok(n1.chatter.length === 1 && !JSON.stringify(n1.chatter).includes('Jaxx'), 'invented chatter dropped');
const n2 = await N.generateNews(s, names, async () => 'not json'); ok(n2.src === 'canned' && n2.items.length >= 3, 'garbage AI output -> canned feed');
const n4 = await N.generateNews(s, names, async () => { throw new Error('timeout'); }); ok(n4.src === 'canned' && n4.why === 'error', 'AI error -> canned feed');
const n5 = await N.generateNews(s, names, null); ok(n5.src === 'canned' && n5.wk === s.prev.wk, 'no key -> canned feed for last week');
const n6 = await N.generateNews(C.newCity(T0), names, null); ok(n6.items.length === 1 && /Quiet week/.test(n6.items[0].h), 'empty week -> one quiet-week line, nothing invented');
// Lambda + CDK wiring
const L = fs.readFileSync('infra/lambda/city-news.mjs', 'utf8'); ok(/generateNews/.test(L) && /news#latest/.test(L) && /max_completion_tokens: NEWS.maxTokens/.test(L) && /CITY_AI === '0'/.test(L), 'news Lambda: shared writer, capped tokens, kill switch, writes news#latest');
const K = fs.readFileSync('infra/lib/city-stack.ts', 'utf8'); ok(/Schedule\.cron/.test(K) && /reservedConcurrentExecutions: 1/.test(K) && /PAY_PER_REQUEST/.test(K), 'CityStack: weekly EventBridge schedule, concurrency 1, on-demand table');
done();
