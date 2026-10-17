// Living city UI (lazy-loaded by main.ts). Town faction banner (always), City news panel + street chatter (feature flags `news`, `chatter`).
// Perf: no per-frame work. The banner updates on town change / city change; chatter is one setTimeout chain; news is fetched only when opened.
import { cityEffects, cityFlag, onCity, CITY_C, cityInit } from './cityclient';
import { CITYUI } from './cityui_stub';
import { FACTION_SHORT } from './city';
import { WORLD_BY_ID } from './world';
// @ts-ignore plain ESM shared with the server + news Lambda
import { generateNews } from '../server/city_news.mjs';
import { esc } from './esc';
import { wireItems, deedBark } from './deeds';
import { activeNems, scarText } from './nemesis';
import { ownerName } from './nemesis_sim';
import { DUNGEONS } from './content/dungeons';
const place = (id: string) => (DUNGEONS as any)[id]?.name || id.replace(/_/g, ' ');
/** "Your file": the player's own deeds as street news, always local + deterministic (docs/CITY_MEMORY.md) */
function fileHtml(g: any): string { const it = wireItems(g.save, ownerName(g), place); const hunt = activeNems(g.save).sort((a, b) => b.rank - a.rank)[0];
  const hn = hunt ? `<div class="cnitem cnhunt"><b>Hunted by ${esc(hunt.name)}</b><div>${esc(hunt.title)}, rank ${hunt.rank}. Killed you ${hunt.kills} time${hunt.kills === 1 ? '' : 's'}.${hunt.scars?.length ? ' Scars: ' + esc(scarText(hunt)) + '.' : ''}</div></div>` : '';
  if (!it.length && !hn) return ''; return `<div class="cnfile"><div class="cnfilehead" data-tip="What the street says about you. Built from what you actually did.">Your file</div>${hn}${it.map(x => `<div class="cnitem cndeed" data-k="${x.k}"><b>${esc(x.h)}</b><div>${esc(x.b)}</div></div>`).join('')}</div>`; }
type UIx = any;
export const NEWS: { feed: any | null; at: number; loading: boolean; err: string } = { feed: null, at: 0, loading: false, err: '' };
const httpBase = () => { const n = (globalThis as any).__net?.client; const u = n?.state === 'online' ? String(n.o?.url || '') : ''; return u ? u.replace(/^ws/, 'http').replace(/\/+$/, '') : ''; };
/** news: server cache (Lambda-written weekly feed) when online, else a canned feed written locally from the offline city's real numbers */
export async function loadNews(force = false): Promise<any> {
  if (NEWS.feed && !force && Date.now() - NEWS.at < 10 * 60e3) return NEWS.feed; if (NEWS.loading) return NEWS.feed; NEWS.loading = true;
  try { const b = httpBase(); if (b) { const r = await fetch(b + '/city/news', { cache: 'no-store' }); if (r.ok) { const j = await r.json(); if (j?.items) { NEWS.feed = { ...j, from: 'server' }; NEWS.at = Date.now(); return NEWS.feed; } } }
  } catch { NEWS.err = 'offline'; } finally { NEWS.loading = false; }
  cityInit(); const s: any = CITY_C.s; const names = { towns: Object.fromEntries(Object.keys(s.dist).map(id => [id, WORLD_BY_ID[id]?.name || id])) };
  NEWS.feed = { ...(await generateNews({ ...s, prev: s.week }, names, null)), from: 'local' }; NEWS.at = Date.now(); return NEWS.feed;
}
function newsHtml(ui: UIx): string {
  if (!cityFlag('news')) return '<div class="mut">City news is switched off.</div>';
  const town = ui.g.townId || 'rustline'; const e = cityEffects(town); const f = NEWS.feed;
  if (!f) { void loadNews().then(() => { if (ui.modal === 'news') ui.render(); }); }
  const ev = e.events.map(x => `<span class="tag lock cnev" data-tip="${esc(x.tip)}">${esc(x.label)}</span>`).join('');
  const bo = e.bounties.map(b => `<span class="tag ok cnbo" data-tip="${esc('Clear ' + b.dungeon.replace(/_/g, ' ') + ' for ' + b.reward + 'c (once a day)')}">${esc(b.label)} · ${b.reward}c</span>`).join('');
  const items = f ? f.items.map((it: any) => `<div class="cnitem"><b>${esc(it.h)}</b><div>${esc(it.b)}</div></div>`).join('') : '<div class="mut">Loading…</div>';
  return `<div class="cnwrap"><div class="cnhead" style="--fc:${e.color}"><b>${esc(FACTION_SHORT[e.ctrl] || e.ctrl)}</b> holds ${esc(WORLD_BY_ID[town]?.name || town)}<span class="tag" data-tip="Higher tension: pricier vendors, more guards, bounties">Tension ${e.tension}</span><span class="tag" data-tip="Vendor price change from the city">Prices ${e.priceMul >= 1 ? '+' : ''}${Math.round((e.priceMul - 1) * 100)}%</span></div>
    ${ev || bo ? `<div class="wmrow">${ev}${bo}</div>` : ''}${fileHtml(ui.g)}<div class="cnlist">${items}</div><div class="mut cnsrc">${f ? (f.from === 'server' ? 'Week of ' + esc(f.wk) : 'Offline: local city') : ''}</div></div>`;
}
// ---- town banner (controlling faction + active event): one fixed node
let banner: HTMLElement | null = null;
function syncBanner(g: any) {
  if (!banner) { banner = document.createElement('button'); banner.id = 'citybanner'; (banner as HTMLButtonElement).type = 'button'; banner.className = 'citybanner'; banner.addEventListener('click', () => { if (cityFlag('news')) (globalThis as any).__ui?.open('news'); }); document.body.appendChild(banner); }
  if (g.mode !== 'town') { banner.style.display = 'none'; return; } const e = cityEffects(g.townId || 'rustline'); const ev = e.events[0];
  banner.style.display = ''; banner.style.setProperty('--fc', e.color); banner.dataset.mood = e.mood;
  const hunt = activeNems(g.save).sort((a, b) => b.rank - a.rank)[0];
  const txt = `${FACTION_SHORT[e.ctrl] || e.ctrl}${ev ? ' · ' + (ev.kind === 'lockdown' ? 'Lockdown' : ev.kind === 'night_market' ? 'Night market' : 'Turf war') : ''}${hunt ? ' · Hunted' : ''}`; if (banner.textContent !== txt) banner.textContent = txt;
  banner.dataset.tip = `${e.ctrl} holds this district. Tension ${e.tension}.${ev ? ' ' + ev.label + '.' : ''}${hunt ? ` ${hunt.name} is hunting you.` : ''}${cityFlag('news') ? ' Click for city news.' : ''}`; banner.setAttribute('aria-label', banner.dataset.tip);
}
// ---- street chatter: one bark every ~30 s in town, from the news feed (real events) or the rules (faction/tension)
let barkT: any = 0;
function bark(g: any) {
  clearTimeout(barkT); barkT = setTimeout(() => bark(g), 28000 + Math.random() * 12000); if (!cityFlag('chatter') || g.mode !== 'town' || document.hidden || (globalThis as any).__ui?.modal) return;
  const town = g.townId || 'rustline'; const e = cityEffects(town); const f = NEWS.feed; const pool: string[] = [];
  if (f) for (const c of f.chatter || []) if (!c.d || c.d === town) pool.push(c.line);
  const sh = FACTION_SHORT[e.ctrl] || e.ctrl; pool.push(e.mood === 'hot' ? `${sh} has guards on every corner.` : e.mood === 'tense' ? `Feels tight around here. ${sh} is twitchy.` : `${sh} keeps the peace. For now.`); for (const ev of e.events) pool.push(`You hear? ${ev.label}.`); const db = deedBark(g.save, ownerName(g)); if (db) pool.push(db, db); // your own deeds are the likeliest bark
  const line = pool[(Math.random() * pool.length) | 0]; const host = document.getElementById('toasts'); if (!host || !line) return;
  const el = document.createElement('div'); el.className = 'toast cbark'; el.setAttribute('role', 'status'); el.textContent = '“' + line + '”'; host.appendChild(el); setTimeout(() => el.remove(), 5200);
  if (!f) void loadNews();
}
export function initCityUi(g: any, ui: UIx) {
  CITYUI.html = newsHtml; CITYUI.click = (u, _el, a) => { if (a === 'cn-refresh') { void loadNews(true).then(() => u.render()); return true; } return false; };
  const sync = () => syncBanner(g); sync(); onCity(() => { sync(); if (ui.modal === 'news') ui.render(); }); setInterval(sync, 2000); // cheap: compares text
  barkT = setTimeout(() => bark(g), 15000);
  (globalThis as any).__city = { CITY_C, cityEffects, loadNews, NEWS, bark: () => bark(g) };
}
