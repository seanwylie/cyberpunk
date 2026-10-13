import { partyName } from '../chars';
// Multiplayer bootstrap. Zero-config: the build carries the server URL; we connect quietly in town / on Party / on a town-player click / on an invite link.
// (or follows an invite link). Safe to import when no server exists.
import type { Game } from '../sim';
import type { Renderer } from '../render';
import { NetClient, configuredServer } from './client';
import { NetSession } from './session';
import { PartyUI } from './party_ui';
import { cityFromServer, cityGoOffline } from '../cityclient';

export function initNet(g: Game, rend: Renderer) {
  // zero-config: the server URL is baked in at build time (VITE_WV_SERVER); the player never types one. ?server= is a dev/test override only.
  const url = configuredServer(); const invite = (new URLSearchParams(location.search).get('party') || '').toUpperCase();
  if (!url) return null; // static build without a configured server: no multiplayer UI at all
  let net: NetClient | null = null; let sess: NetSession | null = null; let ui: PartyUI; let warned = false; let asked = false;
  const name = () => partyName();
  /** connect lazily and silently (Party panel, town player click, invite link, arriving in town). Safe to call repeatedly. */
  const ensure = (user = true) => {
    if (user) asked = true;
    if (net) { if (net.state === 'off' && !net.versionError) net.connect(); return net; }
    const n = new NetClient({ url, name: name(), lvl: Math.max(1, (g.save as any).level || 1) }); const s = new NetSession(g, rend, n); net = n; sess = s; ui.net = n; ui.sess = s;
    n.on('state', () => { ui.render(); ui.syncBtn(); if (n.state === 'off' && n.lastErr && asked && !warned) { warned = true; g.toast('Multiplayer is unreachable right now. Solo play is unaffected.'); } if (n.state === 'online') warned = false; });
    n.on('party', () => ui.render()); n.on('instance_start', () => ui.render()); n.on('instance_end', () => ui.render()); n.on('rtt', () => ui.rttTick()); n.on('town', () => ui.render());
    n.on('chat', (m: any) => ui.addChat(m)); n.on('sys', (m: any) => ui.addChat({ name: '·', text: m.msg, from: '' })); n.on('err', (m: any) => g.toast(m.msg || 'Party error')); n.on('mark', (m: any) => ui.addChat({ name: m.name, text: 'pinged the map (G)', from: m.from }));
    n.on('invite', (m: any) => ui.showInvite(m));
    n.on('city', (m: any) => cityFromServer(m)); n.on('state', () => { if (n.state !== 'online') cityGoOffline(); });
    n.on('welcome', () => { s.sendProfile(); if (invite && !n.party) n.joinParty(invite); });
    s.onTownMenu = (p, x, y) => ui.townMenu(p, x, y);
    n.connect(); ui.render(); return n;
  };
  ui = new PartyUI(g, url, ensure);
  // town is where grouping happens: connect quietly a moment after the player is in town (cheap: ~1 KB/s), so other players are visible and clickable
  // (dev hosts without an explicit ?server= skip this so local tests never dial a server that is not running)
  const explicit = (() => { try { return !!new URLSearchParams(location.search).get('server') || !!(import.meta as any).env?.VITE_WV_SERVER; } catch { return false; } })();
  if (explicit) { const auto = setInterval(() => { if (g.mode === 'town' && !net) { clearInterval(auto); ensure(false); } }, 2000); }
  // legendary announcement (docs/LOOT_ECONOMY.md): opt-out in Settings, one line, rate-limited; party chat in a party, town chat when solo online
  let lastAnn = 0; window.addEventListener('wv-prestige', (ev: any) => { const p = ev.detail || {}; const n = net; if (!n || n.state !== 'online' || (g.save.settings as any).announceDrops === false) return; if (Date.now() - lastAnn < 60000) return; lastAnn = Date.now();
    n.chat((p.kind === 'seasonal' ? 'found a season exclusive: ' : 'found a legendary: ') + String(p.name || '').slice(0, 60), n.party ? 'party' : 'town'); });
  (window as any).__net = { get client() { return net; }, get session() { return sess; }, ui };
  if (invite) ensure();
  return ui;
}
