// Build identity + "new version available" check. The id/time are baked at build time (vite define); /version.json is published with Cache-Control: no-cache.
declare const __BUILD_ID__: string; declare const __BUILD_TIME__: string; declare const __BUILD__: string;
export const BUILD_ID: string = typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : 'dev';
export const BUILD_TIME: string = typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : '';
export const BUILD_NUM: string = typeof __BUILD__ !== 'undefined' ? __BUILD__ : '0';
export function buildLabel(): string { return BUILD_ID + (BUILD_TIME ? ' · ' + BUILD_TIME.replace('T', ' ').replace(/\.\d+Z$/, 'Z') : ''); }
let shown = false;
/** compare the deployed /version.json (never cached) with this bundle; show a refresh banner if they differ */
export async function checkVersion(): Promise<'same' | 'newer' | 'unknown'> {
  try { const r = await fetch('version.json?t=' + Date.now(), { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } }); if (!r.ok) return 'unknown'; const j = await r.json(); if (!j || typeof j.id !== 'string') return 'unknown';
    if (j.id === BUILD_ID && String(j.build) === BUILD_NUM) return 'same'; if (BUILD_ID === 'dev') return 'unknown'; showBanner(j.id); armAutoReload(); return 'newer'; } catch { return 'unknown'; } }
/** Safe moment = in town, no modal open, tab visible. Never reloads mid-dungeon/run. */
export function safeToReload(): boolean { const g = (window as any).__game, u = (window as any).__ui; return !!g && g.mode === 'town' && !u?.modal && document.visibilityState === 'visible'; }
async function freshReload() { try { for (const k of await caches.keys()) await caches.delete(k); const rg = await navigator.serviceWorker?.getRegistrations?.(); for (const g of rg || []) await g.update().catch(() => { }); } catch { } location.reload(); }
let armed = false; let safeFor = 0;
/** new build is live: auto-reload once the player has been in a safe state (town, no menu) for 8 s straight */
function armAutoReload() { if (armed) return; armed = true; setInterval(() => { safeFor = safeToReload() ? safeFor + 1 : 0; const t = document.querySelector('#newver span'); if (t && safeFor) t.textContent = `New version: updating in ${Math.max(0, 8 - safeFor)} s…`; if (safeFor >= 8) freshReload(); }, 1000); }
function showBanner(id: string) { if (shown) return; shown = true; const d = document.createElement('div'); d.id = 'newver'; d.setAttribute('role', 'status');
  d.innerHTML = `<span>New version available (${id.replace(/[^\w.-]/g, '')}).</span> <button type="button" id="newver-go">Refresh</button> <button type="button" id="newver-x" aria-label="Dismiss">×</button>`;
  document.body.appendChild(d); d.querySelector('#newver-go')!.addEventListener('click', freshReload); d.querySelector('#newver-x')!.addEventListener('click', () => d.remove()); }
export function startVersionWatch() { console.info(`%cWarranty Void build ${buildLabel()}`, 'color:#9ad'); (window as any).__build = { id: BUILD_ID, time: BUILD_TIME, num: BUILD_NUM };
  if (!(import.meta as any).env?.PROD) return; setTimeout(checkVersion, 20000); setInterval(checkVersion, 2 * 60 * 1000); document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkVersion(); }); }
