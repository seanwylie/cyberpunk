// Story panel Regenerate button vs SERVER limits (mocked endpoint): cooldown countdown on the button, server 429 rate_limited/daily_cap handling,
// "No more rewrites today" at the cap, line kept (no canned overwrite) when limited, canned fallback when the server is over budget. Player id is sent.
import { launch, sleep } from './lib.mjs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const { browser, page } = await launch({ viewport: { width: 1280, height: 720 } });
let mode = 'ok', bodies = [];
await page.route('**/api/story-beat', r => { const b = JSON.parse(r.request().postData()); bodies.push(b);
  if (mode === 'rl') return r.fulfill({ status: 429, contentType: 'application/json', body: JSON.stringify({ ok: false, reason: 'rate_limited', retryAfter: 37 }) });
  if (mode === 'cap') return r.fulfill({ status: 429, contentType: 'application/json', body: JSON.stringify({ ok: false, reason: 'daily_cap', retryAfter: 5000 }) });
  if (mode === 'budget') return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: false, reason: 'budget', canned: true }) });
  r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, text: `Line ${bodies.length}: the Siege Bot Arm still hums. Keep it clean out there.`, model: 'mock' }) }); });
await page.evaluate(() => document.getElementById('splash')?.remove());
await page.evaluate(async () => { const C = await import('/src/config.ts'), St = await import('/src/state.ts'); const g = window.__game, s = g.save; const d = C.ITEMS.find(i => i.mfr === 'HI' && !i.id.startsWith('stock_')); const it = St.mkInst(s, d.id); s.items.push(it); s.installed[d.slot] = it.uid; g.recompute(); g.mode = 'town'; });
await page.evaluate(() => window.__beats.fire({ run: 'x', dungeon: 'annex', result: 'ok' })); await sleep(200);
ok(/^[a-f0-9]{24}$/.test(bodies[0]?.player || ''), 'requests carry a persistent player id');
await page.evaluate(() => window.__ui.openStory()); await sleep(300);
const btn = () => page.evaluate(() => { const b = document.getElementById('storyregen'); return { t: b.textContent, d: b.disabled }; });
const txt = () => page.evaluate(() => document.getElementById('stext').dataset.full);
const msg = () => page.evaluate(() => document.getElementById('storymsg2').textContent);
ok((await btn()).t === 'Regenerate' && !(await btn()).d, 'button enabled initially');
await page.click('#storyregen'); await sleep(500);
let b = await btn(); ok(b.d && /^Regenerate \((59|60) s\)$/.test(b.t), `after a rewrite the button shows the cooldown (${b.t})`);
await page.evaluate(() => { window.__beats.cooldownUntil -= 10_000; }); await sleep(700); b = await btn(); ok(/\((49|50) s\)/.test(b.t), `countdown ticks (${b.t})`);
// server says rate_limited (e.g. another tab): client adopts retryAfter and keeps the line
await page.evaluate(() => { window.__beats.cooldownUntil = 0; }); await sleep(600); mode = 'rl'; let before = await txt();
await page.click('#storyregen'); await sleep(500); b = await btn();
ok(/\((36|37) s\)/.test(b.t) && b.d && (await txt()) === before && /wait 37 s/.test(await msg()), `server rate_limited -> retryAfter on the button, line kept (${b.t})`);
// server daily cap
await page.evaluate(() => { window.__beats.cooldownUntil = 0; }); await sleep(600); mode = 'cap'; before = await txt();
await page.click('#storyregen'); await sleep(500); b = await btn();
ok(b.t === 'No more rewrites today' && b.d && (await txt()) === before, 'server daily_cap -> "No more rewrites today", disabled, line kept');
// over budget -> canned line
await page.evaluate(() => { window.__beats.cappedUntil = 0; window.__beats.cooldownUntil = 0; }); await sleep(600); mode = 'budget'; before = await txt();
await page.click('#storyregen'); await sleep(500);
ok((await txt()) !== before && (await page.evaluate(() => window.__game.save.journal.at(-1).src)) === 'authored' && /New line/.test(await msg()), 'server budget breaker -> graceful canned line');
await browser.close(); console.log(fails ? `\n${fails} FAILED` : '\nALL PASS'); process.exit(fails ? 1 : 0);
