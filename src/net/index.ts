import { partyName } from '../chars';
// Multiplayer bootstrap. Offline/solo is the default: nothing connects until the player presses Connect in the Party panel
// (or follows an invite link). Safe to import when no server exists.
import type { Game } from '../sim';
import type { Renderer } from '../render';
import { NetClient, configuredServer } from './client';
import { NetSession } from './session';
import { PartyUI } from './party_ui';
import { cityFromServer, cityGoOffline } from '../cityclient';

export function initNet(g: Game, rend: Renderer) {
  const isDev = (() => { try { return !!(import.meta as any).env?.DEV || /^(localhost|127\.|192\.168\.|10\.)/.test(location.hostname); } catch { return false; } })();
  let url = configuredServer(); const invite = (new URLSearchParams(location.search).get('party') || '').toUpperCase();
  if (!url && !isDev) return null; // production static build without a configured server: no multiplayer UI at all
  let net: NetClient | null = null; let sess: NetSession | null = null; let ui: PartyUI;
  const name = () => partyName();
  const connect = (u: string) => {
    try { localStorage.setItem('wv_server', u); } catch {}
    net?.close(); if (sess?.active) sess.exit('reconnect', true);
    const n = new NetClient({ url: u, name: name(), lvl: Math.max(1, (g.save as any).level || 1) }); const s = new NetSession(g, rend, n); net = n; sess = s; ui.net = n; ui.sess = s;
    n.on('state', () => ui.render()); n.on('party', () => ui.render()); n.on('instance_start', () => ui.render()); n.on('instance_end', () => ui.render()); n.on('rtt', () => ui.rttTick()); n.on('town', () => ui.render());
    n.on('chat', (m: any) => ui.addChat(m)); n.on('sys', (m: any) => ui.addChat({ name: '·', text: m.msg, from: '' })); n.on('err', (m: any) => g.toast(m.msg || 'Party error')); n.on('mark', (m: any) => ui.addChat({ name: m.name, text: 'pinged the map (G)', from: m.from }));
    n.on('city', (m: any) => cityFromServer(m)); n.on('state', () => { if (n.state !== 'online') cityGoOffline(); });
    n.on('welcome', () => { s.sendProfile(); if (invite && !n.party) n.joinParty(invite); });
    n.connect(); ui.render();
  };
  const forget = () => { try { localStorage.removeItem('wv_server'); } catch {} net?.close(); net = null; if (sess?.active) sess.exit('disconnected', true); ui.net = null; ui.url = ''; ui.render(); };
  ui = new PartyUI(g, url, connect, forget);
  (window as any).__net = { get client() { return net; }, get session() { return sess; }, ui };
  if (url && invite) connect(url);
  return ui;
}
