// Party button (top-right tray) + compact party panel (progressive disclosure: closed by default; code / invite / members / chat inside).
import type { NetClient } from './client';
import type { NetSession } from './session';
import { DUNGEONS } from '../content/dungeons';
import { partyHpMul, partyDmgMul } from './shared';
import type { Game } from '../sim';

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const CSS = `
#btn-party .dot{ position:absolute; right:1px; bottom:1px; width:9px; height:9px; border-radius:50%; background:#6b6d70; box-shadow:0 0 0 1.5px #111; } #btn-party.on .dot{ background:#7bd389 } #btn-party.party .dot{ background:#e8c46a }
#partypanel{ position:fixed; z-index:40; right:8px; top:calc(max(36px,calc(30px*var(--fs,1))) + 22px); width:min(300px,calc(100vw - 16px)); max-height:calc(100vh - 120px); overflow:auto; padding:8px 10px; border-radius:8px; background:rgba(16,17,18,.94); border:1px solid #5a5d60; color:#e6e0cf; font:600 max(var(--fmin,12px),12px)/1.3 "Roboto Condensed",sans-serif; box-shadow:0 6px 24px rgba(0,0,0,.6); display:none; }
#partypanel.open{ display:block } #partypanel h4{ margin:0 0 4px; font-size:max(var(--fmin,12px),13px); letter-spacing:.06em; text-transform:uppercase; color:#c9bfa0; display:flex; justify-content:space-between; align-items:center }
#partypanel .row{ display:flex; gap:6px; align-items:center; margin:4px 0; } #partypanel .mut{ color:#9a9788; font-weight:500 }
#partypanel input,#partypanel select{ flex:1; min-width:0; background:#0e0f10; color:#e6e0cf; border:1px solid #55585a; border-radius:4px; padding:3px 6px; font:inherit }
#partypanel button{ background:#2a2c2e; color:#e6e0cf; border:1px solid #6a6d70; border-radius:4px; padding:3px 8px; font:inherit; cursor:pointer } #partypanel button:hover{ border-color:#e8dfb8 } #partypanel button:disabled{ opacity:.45; cursor:default } #partypanel button.go{ border-color:#7d8a52; color:#d6e8a8 }
#partypanel .code{ font:700 max(var(--fmin,12px),20px)/1 "Roboto Condensed",monospace; letter-spacing:.18em; color:#e8c46a }
#partypanel .mem{ display:flex; gap:6px; align-items:center; padding:2px 0; border-bottom:1px solid rgba(255,255,255,.06) } #partypanel .mem .nm{ flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis } #partypanel .ok{ color:#7bd389 } #partypanel .wait{ color:#8a8c8a }
#partypanel .chatlog{ max-height:84px; overflow:auto; margin:4px 0; padding:3px 5px; background:#0e0f10; border-radius:4px; font-weight:500 } #partypanel .chatlog b{ color:#c9bfa0 }
#netchat{ position:fixed; left:10px; bottom:96px; z-index:30; pointer-events:none; font:600 max(var(--fmin,12px),12px)/1.3 "Roboto Condensed",sans-serif; color:#e6e0cf; text-shadow:0 1px 2px #000; display:flex; flex-direction:column; gap:2px; max-width:min(340px,60vw) } #netchat div{ background:rgba(10,10,11,.55); padding:1px 6px; border-radius:4px; transition:opacity 1s }
#netdown{ position:fixed; left:50%; top:22%; transform:translateX(-50%); z-index:30; display:none; padding:6px 14px; border-radius:6px; background:rgba(60,14,10,.85); border:1px solid #e5604a; color:#ffd2c9; font:700 max(var(--fmin,12px),15px)/1.2 "Roboto Condensed",sans-serif; pointer-events:none }
`;
export class PartyUI {
  panel: HTMLElement; btn: HTMLButtonElement; log: { name: string; text: string; me: boolean }[] = []; open = false; chatEl: HTMLElement; downEl: HTMLElement; private last = '';
  net: NetClient | null = null; sess: NetSession | null = null;
  constructor(public g: Game, public url: string, public connect: (url: string) => void, public forget: () => void) {
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    const tray = document.getElementById('topright')!; this.btn = document.createElement('button'); this.btn.id = 'btn-party'; this.btn.className = 'tbtn'; this.btn.type = 'button'; this.btn.setAttribute('aria-label', 'Party (multiplayer)');
    this.btn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.4"/><path d="M3 19c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5M15 14c2.7-.4 5.5 1 6 4.5"/></svg><i class="dot"></i><span class="tt">Party<kbd>P</kbd></span>';
    tray.insertBefore(this.btn, document.getElementById('btn-map')); this.btn.addEventListener('click', e => { e.preventDefault(); this.toggle(); });
    this.panel = document.createElement('div'); this.panel.id = 'partypanel'; this.panel.setAttribute('role', 'dialog'); this.panel.setAttribute('aria-label', 'Party'); document.body.appendChild(this.panel);
    this.chatEl = document.createElement('div'); this.chatEl.id = 'netchat'; document.body.appendChild(this.chatEl); this.downEl = document.createElement('div'); this.downEl.id = 'netdown'; document.body.appendChild(this.downEl);
    window.addEventListener('keydown', e => { const t = e.target as HTMLElement; if (t?.matches?.('input,textarea,select')) { if (e.key === 'Escape') { this.toggle(false); t.blur(); } return; } if (e.code === 'KeyP') this.toggle(); else if (e.code === 'Enter' && this.net?.state === 'online') { this.toggle(true); (this.panel.querySelector('#pp-chat') as HTMLInputElement | null)?.focus(); } });
    this.panel.addEventListener('keydown', e => e.stopPropagation()); this.panel.addEventListener('keyup', e => e.stopPropagation()); this.panel.addEventListener('click', e => this.onClick(e));
    setInterval(() => this.tick(), 500); this.render();
  }
  toggle(v?: boolean) { this.open = v ?? !this.open; this.panel.classList.toggle('open', this.open); if (this.open) this.render(); }
  addChat(m: { name: string; text: string; from: string }) { this.log.push({ name: m.name, text: m.text, me: m.from === this.net?.id }); if (this.log.length > 40) this.log.shift(); const d = document.createElement('div'); d.innerHTML = `<b>${esc(m.name)}</b> ${esc(m.text)}`; this.chatEl.appendChild(d); while (this.chatEl.children.length > 4) this.chatEl.firstChild!.remove(); setTimeout(() => { d.style.opacity = '0'; setTimeout(() => d.remove(), 1000); }, 9000); if (this.open) this.render(); }
  rttTick() { const el = this.panel.querySelector('#pp-rtt'); if (el) el.textContent = this.net!.rtt + ' ms'; }
  private tick() { const n = this.net; const inst = !!this.sess?.active; const you = inst ? this.sess!.ic!.you : null; this.downEl.style.display = you?.down ? 'block' : 'none'; if (you?.down) this.downEl.textContent = 'DOWNED: a teammate can revive you (hold F)'; if (!this.open) this.syncBtn(); else { const key = JSON.stringify([n?.state, n?.party, inst, n?.townPop, n?.shard]); if (key !== this.last) this.render(); } }
  private syncBtn() { const n = this.net; this.btn.classList.toggle('on', n?.state === 'online'); this.btn.classList.toggle('party', !!n?.party); }
  private inviteLink() { const u = new URL(location.href); u.search = ''; u.searchParams.set('server', this.url); u.searchParams.set('party', this.net!.party!.code); return u.toString(); }
  private onClick(e: Event) {
    const t = (e.target as HTMLElement).closest('[data-a]') as HTMLElement | null; if (!t) return; const a = t.dataset.a!; const $ = (id: string) => (this.panel.querySelector('#' + id) as HTMLInputElement | null)?.value || ''; const n = this.net;
    if (a === 'connect') { const u = $('pp-url').trim(); if (u) { try { localStorage.setItem('wv_name', $('pp-name').trim()); } catch {} this.url = u; this.connect(u); } return; }
    if (a === 'forget') { this.forget(); return; } if (!n) return;
    if (a === 'create') { this.saveName(); n.createParty(); } else if (a === 'join') { this.saveName(); n.joinParty($('pp-code')); } else if (a === 'leave') { n.leaveParty(); if (this.sess?.active) this.sess.exit('left party', true); }
    else if (a === 'ready') n.setReady(!(n.party?.members.find(m => m.id === n.id)?.ready)); else if (a === 'start') n.start(); else if (a === 'kick') n.kick(t.dataset.id!);
    else if (a === 'copy') { navigator.clipboard?.writeText(this.inviteLink()).catch(() => {}); this.g.toast('Invite link copied.'); }
    else if (a === 'chat') { const v = $('pp-chat').trim(); if (v) { n.chat(v); (this.panel.querySelector('#pp-chat') as HTMLInputElement).value = ''; } }
    else if (a === 'leaveinst') { this.sess?.exit('left', true); n.send({ t: 'leave_instance' }); }
  }
  private saveName() { const nm = (this.panel.querySelector('#pp-name') as HTMLInputElement)?.value.trim(); if (nm) { try { localStorage.setItem('wv_name', nm); } catch {} this.net!.profile(nm, Math.max(1, (this.g.save as any).level || 1), this.sess?.look()); } }
  render() {
    this.syncBtn(); const n = this.net; const p = this.panel; if (!this.open) return; const keep = { chat: (p.querySelector('#pp-chat') as HTMLInputElement | null)?.value, name: (p.querySelector('#pp-name') as HTMLInputElement | null)?.value, url: (p.querySelector('#pp-url') as HTMLInputElement | null)?.value, code: (p.querySelector('#pp-code') as HTMLInputElement | null)?.value }; const focus = document.activeElement?.id;
    const name = keep.name ?? (localStorage.getItem('wv_name') || 'Guest-' + Math.floor(1000 + Math.random() * 9000)); let h = '';
    if (!n || n.state !== 'online') {
      h = `<h4>Multiplayer <span class="mut">offline</span></h4><div class="mut">Solo play is unaffected. Connect to a server to play in a party (2-4) and see other players in town.</div>
      <div class="row"><input id="pp-name" maxlength="16" value="${esc(name)}" aria-label="Display name"></div><div class="row"><input id="pp-url" value="${esc(keep.url ?? this.url ?? '')}" placeholder="ws://localhost:8787" aria-label="Server URL"><button data-a="connect" class="go">${n?.state === 'connecting' ? 'Connecting…' : 'Connect'}</button></div>${n?.lastErr ? `<div class="mut">${esc(n.lastErr)}</div>` : ''}${this.url ? '<div class="row"><button data-a="forget">Forget server</button></div>' : ''}`;
    } else {
      const pt = n.party, inst = !!this.sess?.active; h = `<h4>Party <span class="mut"><span id="pp-rtt">${n.rtt} ms</span> · ${inst ? 'in dungeon' : (n.townPop || 1) + ' in town'}</span></h4>`;
      if (!pt) h += `<div class="row"><input id="pp-name" maxlength="16" value="${esc(name)}" aria-label="Display name"></div><div class="row"><button data-a="create" class="go">Create party</button></div><div class="row"><input id="pp-code" maxlength="8" placeholder="Code" value="${esc(keep.code || '')}" aria-label="Party code"><button data-a="join">Join</button></div>`;
      else {
        const me = pt.members.find(m => m.id === n.id); const lead = !!me?.leader; const cnt = pt.members.length;
        h += `<div class="row"><span class="code" id="pp-code-show">${esc(pt.code)}</span><button data-a="copy" title="Copy invite link">Invite link</button></div>`;
        h += pt.members.map(m => `<div class="mem"><span>${m.leader ? '♛' : ''}</span><span class="nm">${esc(m.name)} <span class="mut">Lv${m.lvl}</span></span><span class="${m.ready ? 'ok' : 'wait'}">${m.ready ? '✓ ready' : '…'}</span>${lead && !m.leader && !pt.inInstance ? `<button data-a="kick" data-id="${esc(m.id)}" title="Remove">×</button>` : ''}</div>`).join('');
        if (!inst && !pt.inInstance) { h += lead ? `<div class="row"><select id="pp-dun" aria-label="Dungeon">${Object.values(DUNGEONS).map(d => `<option value="${d.id}" ${pt.dungeon === d.id ? 'selected' : ''}>${esc(d.name)}</option>`).join('')}</select></div><div class="mut">Enemies: HP ×${partyHpMul(cnt).toFixed(2)}, damage ×${partyDmgMul(cnt).toFixed(2)} for ${cnt}. Loot is personal.</div><div class="row"><button data-a="start" class="go">Start dungeon</button></div>` : `<div class="mut">${pt.dungeon ? 'Leader picked: ' + esc(DUNGEONS[pt.dungeon]?.name || pt.dungeon) : 'Waiting for the leader to pick a dungeon.'}</div><div class="row"><button data-a="ready" class="${me?.ready ? '' : 'go'}">${me?.ready ? 'Not ready' : 'Ready'}</button></div>`; }
        else h += `<div class="row"><button data-a="leaveinst">Leave dungeon</button></div><div class="mut">Hold F near a downed teammate to revive · G pings the map</div>`;
        h += `<div class="row"><button data-a="leave">Leave party</button></div>`;
        h += `<div class="chatlog" id="pp-log">${this.log.slice(-8).map(c => `<div><b>${esc(c.name)}</b> ${esc(c.text)}</div>`).join('') || '<span class="mut">No messages</span>'}</div><div class="row"><input id="pp-chat" maxlength="140" placeholder="Chat (Enter)" aria-label="Chat"><button data-a="chat">Send</button></div>`;
      }
    }
    p.innerHTML = h; this.last = JSON.stringify([n?.state, n?.party, !!this.sess?.active, n?.townPop, n?.shard]);
    const dun = p.querySelector('#pp-dun') as HTMLSelectElement | null; if (dun) { dun.onchange = () => n?.setDungeon(dun.value); if (!n!.party!.dungeon) n!.setDungeon(dun.value); }
    const chat = p.querySelector('#pp-chat') as HTMLInputElement | null; if (chat) { chat.value = keep.chat || ''; chat.onkeydown = ev => { ev.stopPropagation(); if (ev.key === 'Enter') { const v = chat.value.trim(); if (v) { n!.chat(v); chat.value = ''; } } if (ev.key === 'Escape') { this.toggle(false); chat.blur(); } }; }
    const log = p.querySelector('#pp-log'); if (log) log.scrollTop = log.scrollHeight; if (focus && focus !== 'pp-chat') (p.querySelector('#' + focus) as HTMLElement | null)?.focus();
  }
}
