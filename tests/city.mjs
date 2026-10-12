// Living city rules (docs/LIVING_CITY.md): event aggregation, bounded influence, faction flip rules (margin + min hold + hysteresis),
// tension decay, effects (prices/guards/signage/bounties/world events), compact wire size, offline local simulation (no server).
import { load, mkTest } from './net_lib.mjs';
const { ok, done } = mkTest(); const C = await load('src/city.ts', 'city'); const CC = await load('src/cityclient.ts', 'cityclient'); const { DUNGEONS } = await load('src/content/dungeons.ts', 'dgn');
const H = 36e5, T0 = Date.UTC(2026, 9, 6, 12); // a Tuesday (no weekend event)
let s = C.newCity(T0); const sum = d => s.dist[d].inf.reduce((a, b) => a + b, 0);
ok(C.DISTRICTS.length === 11 && C.DISTRICTS.every(d => Math.abs(sum(d) - 100) < 1e-6), 'every district starts with influence summing to 100');
ok(C.FACTIONS[s.dist.neon_mile.ctrl] === 'Kestrel Value' && C.FACTIONS[s.dist.aldane_spire.ctrl] === 'Aldane Surgical', 'districts start held by their home faction (world.ts)');
// aggregation: events against Kestrel in Neon Mile move influence to the strongest challenger, capped per hour
const before = s.dist.neon_mile.inf[1]; C.applyEvents(s, [{ k: 'clear', d: 'neon_mile', f: 'Kestrel Value', n: 3 }], T0); const after = s.dist.neon_mile.inf[1];
ok(after < before && Math.abs(sum('neon_mile') - 100) < 1e-6, `clears against Kestrel lower its Neon Mile influence (${before.toFixed(1)} -> ${after.toFixed(1)}), total stays 100`);
ok(s.week.dist.neon_mile.clear === 3, 'weekly aggregate counts the clears');
C.applyEvents(s, [{ k: 'clear', d: 'neon_mile', f: 'Kestrel Value', n: 500 }], T0); ok(s.dist.neon_mile.moved <= C.CITY.hourCap + 1e-9, `per-district hourly cap holds (${s.dist.neon_mile.moved.toFixed(1)} <= ${C.CITY.hourCap})`);
ok(C.applyEvents(s, [{ k: 'clear', d: 'nowhere', f: 'Kestrel Value' }, { k: 'clear', d: 'neon_mile', f: 'Nobody' }, { k: 'nuke', d: 'neon_mile', f: 'Kestrel Value' }], T0).length === 0, 'unknown district/faction/kind are ignored');
const w0 = s.dist.harrow.inf.slice(); C.applyEvents(s, [{ k: 'clear', d: 'harrow', f: 'Harrow-Brandt', n: 5, w: 0 }], T0); ok(s.dist.harrow.inf.every((x, i) => Math.abs(x - w0[i]) < 1e-9), 'weight 0 events move nothing');
// flip rules
s = C.newCity(T0); const fl = []; let t = T0; for (let h = 0; h < 30 && s.dist.neon_mile.ctrl === 1; h++, t += H) C.applyEvents(s, [{ k: 'clear', d: 'neon_mile', f: 'Kestrel Value', n: 50 }], t);
const D = s.dist.neon_mile; ok(D.ctrl !== 1 && s.week.flips.length === 1 && s.week.flips[0].from === 'Kestrel Value', `sustained pressure flips Neon Mile from Kestrel to ${C.FACTIONS[D.ctrl]} after ${Math.round((t - T0) / H)} h`);
ok((t - T0) / H >= 3, 'a flip needs several hours of sustained events (hourly cap), not one burst');
ok(D.tension >= C.CITY.flipTension, 'a flip leaves the district tense');
const ctrl = D.ctrl; C.applyEvents(s, [{ k: 'clear', d: 'neon_mile', f: C.FACTIONS[ctrl], n: 50 }], t + H); C.applyEvents(s, [{ k: 'clear', d: 'neon_mile', f: C.FACTIONS[ctrl], n: 50 }], t + 2 * H);
ok(s.dist.neon_mile.ctrl === ctrl, `min hold: the new holder keeps it for ${C.CITY.minHoldH} h even under pressure`);
{ const s2 = C.newCity(T0); const d2 = s2.dist.salt_harbor; d2.inf = [40, 33, 9, 9, 5, 4]; ok(!C.flipCheck(s2, 'salt_harbor', T0), 'hysteresis: a challenger within the flip margin does not flip'); d2.inf = [30, 39, 9, 9, 9, 4]; ok(C.flipCheck(s2, 'salt_harbor', T0) && C.FACTIONS[d2.ctrl] === 'Kestrel Value', 'a challenger past the margin flips the district'); }
// speech with a faction raises it; failed speech only adds tension
{ const s3 = C.newCity(T0); const b = s3.dist.the_stacks.inf[2]; C.applyEvents(s3, [{ k: 'speech', d: 'the_stacks', f: 'Harrow-Brandt', ok: true, n: 4 }], T0); ok(s3.dist.the_stacks.inf[2] > b, 'successful talks raise that faction locally');
  const i0 = s3.dist.the_stacks.inf.slice(), t0 = s3.dist.the_stacks.tension; C.applyEvents(s3, [{ k: 'speech', d: 'the_stacks', f: 'Harrow-Brandt', ok: false }], T0); ok(s3.dist.the_stacks.inf.every((x, i) => Math.abs(x - i0[i]) < 1e-9) && s3.dist.the_stacks.tension > t0, 'failed talks move no influence, raise tension'); }
// decay
{ const s4 = C.newCity(T0); s4.dist.rustline.tension = 90; s4.at = T0; C.decay(s4, T0 + 10 * H); ok(Math.abs(s4.dist.rustline.tension - (90 - 40)) < 1e-6, 'tension relaxes 4/h toward base'); C.decay(s4, T0 + 100 * H); ok(s4.dist.rustline.tension === C.CITY.tensionBase, 'and settles at base'); }
// week roll
{ const s5 = C.newCity(T0); C.applyEvents(s5, [{ k: 'hack', d: 'rustline', f: 'Rustline Compact' }], T0); C.applyEvents(s5, [{ k: 'hack', d: 'rustline', f: 'Rustline Compact' }], T0 + 7 * 24 * H); ok(s5.prev?.dist.rustline.hack === 1 && s5.week.dist.rustline.hack === 1, 'week aggregate rolls on Monday; last week kept for the news'); }
// effects
{ const s6 = C.newCity(T0); const calm = C.effectsFor(s6, 'neon_mile', T0, DUNGEONS); s6.dist.neon_mile.tension = 85; const hot = C.effectsFor(s6, 'neon_mile', T0, DUNGEONS);
  ok(calm.priceMul === 1 && hot.priceMul > calm.priceMul && hot.priceMul <= 1.35, `prices follow tension (${calm.priceMul} -> ${hot.priceMul}), bounded`);
  ok(hot.guards > calm.guards && hot.guards <= 8, `guards follow tension (${calm.guards} -> ${hot.guards}), bounded`);
  ok(calm.bounties.length === 0 && hot.bounties.length > 0 && hot.bounties.every(b => b.reward > 0 && C.factionOfDungeon(DUNGEONS[b.dungeon]) === 'Kestrel Value'), 'bounties appear when tense, on dungeons of the holding faction');
  ok(hot.events.some(e => e.kind === 'lockdown' && /Kestrel lockdown in Neon Mile/.test(e.label)), 'corp-held district at high tension: "Kestrel lockdown in Neon Mile"');
  ok(calm.signs.includes('KESTREL') && calm.color === C.FACTION_COLOR['Kestrel Value'], 'decoration: faction signage + colour');
  s6.dist.neon_mile.ctrl = 0; const street = C.effectsFor(s6, 'neon_mile', T0, DUNGEONS); ok(street.signs.includes('COMPACT') && street.events.some(e => e.kind === 'turf_war'), 'street-held district: Compact signage, turf war instead of lockdown');
  const fri = Date.UTC(2026, 9, 9, 12); const wk = C.worldEvents(C.newCity(fri), fri); ok(wk.length === 1 && /this weekend/.test(wk[0].label) && wk[0].until > fri, `weekend world event scheduled: "${wk[0]?.label}"`); }
// wire format: tiny + lossless enough
{ const s7 = C.newCity(T0); const w = C.toWire(s7); const bytes = JSON.stringify({ t: 'city', ...w }).length; ok(bytes < 700, `full city snapshot is ${bytes} bytes (< 700)`);
  const diff = JSON.stringify({ t: 'city', ...C.toWire(s7, ['rustline']), p: 1 }).length; ok(diff < 120, `one-district diff is ${diff} bytes (< 120)`);
  s7.dist.harrow.ctrl = 3; s7.dist.harrow.tension = 66; const r = C.fromWire(JSON.parse(JSON.stringify(C.toWire(s7)))); ok(r.dist.harrow.ctrl === 3 && r.dist.harrow.tension === 66, 'wire round-trips control + tension'); }
// offline local sim: works with no server, the city drifts on its own (deterministic), events from play apply locally
{ const a = C.newCity(T0), b = C.newCity(T0); CC.ambient(a, T0 + 48 * H); CC.ambient(b, T0 + 48 * H); ok(JSON.stringify(a.dist) === JSON.stringify(b.dist), 'offline ambient drift is deterministic');
  ok(Object.values(a.week.dist).reduce((n, x) => n + Object.values(x).reduce((p, q) => p + q, 0), 0) > 20, 'offline: the rest of the city keeps living (ambient events per hour)');
  CC.cityInit(T0); const g = { inst: { dungeon: 'warehouse', kills: { a: 5 } }, save: { instance: { id: 'x', dungeon: 'warehouse' }, credits: 0 }, toast() {} }; const k0 = CC.CITY_C.s.week.dist.neon_mile?.clear || 0;
  CC.cityEvent(g, 'mode', 'run'); CC.cityEvent(g, 'traitcheck', 'clear'); ok((CC.CITY_C.s.week.dist.neon_mile?.clear || 0) === k0 + 1 && CC.CITY_C.src === 'local', 'offline: a solo clear updates the local city');
  CC.cityEvent(g, 'althack', 'turret'); CC.cityEvent(g, 'altspeech_res', { ok: true }); ok(CC.CITY_C.s.week.dist.neon_mile.hack >= 1 && CC.CITY_C.s.week.dist.neon_mile.speech_ok >= 1, 'offline: hacks and talks feed the local city');
  CC.CITY_C.s.dist.neon_mile.tension = 90; const e = CC.cityEffects('neon_mile'); const bd = e.bounties[0]?.dungeon; const g2 = { save: { credits: 10 }, toast() {} }; const paid = CC.payBounty(g2, bd, 'neon_mile'); ok(paid > 0 && g2.save.credits === 10 + paid && CC.payBounty(g2, bd, 'neon_mile') === 0, `bounty pays ${paid}c once a day`);
  CC.cityFromServer({ ...C.toWire(C.newCity(T0)), v: 42 }); ok(CC.CITY_C.src === 'server' && CC.cityVersion() === 42, 'server snapshot replaces the local sim while online'); CC.cityGoOffline(); ok(CC.CITY_C.src === 'local', 'losing the server falls back to the local sim'); }
done();
