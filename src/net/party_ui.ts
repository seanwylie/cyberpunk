import { partyName, setPartyName } from '../chars';
// Party button (top-right tray) + compact party panel (progressive disclosure: closed by default; code / invite / members / chat inside).
import type { NetClient } from './client';
import type { NetSession } from './session';
import { DUNGEONS } from '../content/dungeons';
import { partyHpMul } from './shared';
import type { Game } from '../sim';

import { esc } from '../esc';
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
#pmenu{ position:fixed; z-index:45; display:none; min-width:120px; padding:4px; border-radius:6px; background:rgba(16,17,18,.96); border:1px solid #6a6d70; font:600 max(var(--fmin,12px),13px)/1.2 "Roboto Condensed",sans-serif; color:#e6e0cf; box-shadow:0 4px 16px rgba(0,0,0,.6) }
#pmenu .hd{ padding:2px 6px 4px; color:#c9bfa0 } #pmenu button{ display:block; width:100%; text-align:left; background:none; color:inherit; border:0; border-radius:4px; padding:5px 8px; font:inherit; cursor:pointer } #pmenu button:hover{ background:#2a2c2e }
.pprompt{ position:fixed; left:50%; top:16%; transform:translateX(-50%); z-index:46; display:none; min-width:min(280px,calc(100vw - 24px)); padding:8px 12px; border-radius:8px; background:rgba(16,17,18,.95); border:1px solid #e8c46a; color:#e6e0cf; font:600 max(var(--fmin,12px),14px)/1.3 "Roboto Condensed",sans-serif; text-align:center; box-shadow:0 6px 24px rgba(0,0,0,.6) }
.pprompt .t{ font-size:max(var(--fmin,12px),16px); color:#e8c46a; margin-bottom:2px } .pprompt .mut{ color:#9a9788; font-weight:500 } .pprompt .bar{ height:4px; margin:6px 0; background:#2a2c2e; border-radius:2px; overflow:hidden } .pprompt .bar i{ display:block; height:100%; background:#e8c46a }
.pprompt .row{ display:flex; gap:8px; justify-content:center; margin-top:6px } .pprompt button{ background:#2a2c2e; color:#e6e0cf; border:1px solid #6a6d70; border-radius:4px; padding:4px 14px; font:inherit; cursor:pointer } .pprompt button.go{ border-color:#7d8a52; color:#d6e8a8 }
`;
export class PartyUI {
  panel: HTMLElement; btn: HTMLButtonElement; log: { name: string; text: string; me: boolean }[] = []; open = false; chatEl: HTMLElement; downEl: HTMLElement; private last = '';
  net: NetClient | null = null; sess: NetSession | null = null;
  menuEl: HTMLElement; inviteEl: HTMLElement; checkEl: HTMLElement; private invites: { from: string; name: string; kind: string; at: number }[] = [];
  constructor(public g: Game, public url: string, public ensure: (user?: boolean) => unknown) {
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    const tray = document.getElementById('topright')!; this.btn = document.createElement('button'); this.btn.id = 'btn-party'; this.btn.className = 'tbtn'; this.btn.type = 'button'; this.btn.setAttribute('aria-label', 'Party (multiplayer)');
    this.btn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.4"/><path d="M3 19c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5M15 14c2.7-.4 5.5 1 6 4.5"/></svg><i class="dot"></i><span class="tt">Party<kbd>P</kbd></span>';
    tray.insertBefore(this.btn, document.getElementById('btn-map')); this.btn.addEventListener('click', e => { e.preventDefault(); this.toggle(); });
    this.panel = document.createElement('div'); this.panel.id = 'partypanel'; this.panel.setAttribute('role', 'dialog'); this.panel.setAttribute('aria-label', 'Party'); document.body.appendChild(this.panel);
    this.chatEl = document.createElement('div'); this.chatEl.id = 'netchat'; document.body.appendChild(this.chatEl); this.downEl = document.createElement('div'); this.downEl.id = 'netdown'; document.body.appendChild(this.downEl);
    const mk = (id: string, cls = '') => { const e = document.createElement('div'); e.id = id; if (cls) e.className = cls; document.body.appendChild(e); e.addEventListener('click', ev => this.onPrompt(ev)); e.addEventListener('pointerdown', ev => ev.stopPropagation()); return e; };
    this.menuEl = mk('pmenu'); this.inviteEl = mk('pinvite', 'pprompt'); this.checkEl = mk('rcheck', 'pprompt'); this.inviteEl.setAttribute('role', 'alertdialog'); this.checkEl.setAttribute('role', 'alertdialog');
    window.addEventListener('pointerdown', ev => { if (!this.menuEl.contains(ev.target as Node)) this.menuEl.style.display = 'none'; }, true);
    window.addEventListener('keydown', e => { const t = e.target as HTMLElement; if (t?.matches?.('input,textarea,select')) { if (e.key === 'Escape') { this.toggle(false); t.blur(); } return; } if (e.code === 'KeyP') this.toggle(); else if (e.code === 'Enter' && this.net?.state === 'online') { this.toggle(true); (this.panel.querySelector('#pp-chat') as HTMLInputElement | null)?.focus(); } });
    this.panel.addEventListener('keydown', e => e.stopPropagation()); this.panel.addEventListener('keyup', e => e.stopPropagation()); this.panel.addEventListener('click', e => this.onClick(e));
    setInterval(() => this.tick(), 250); this.render();
  }
  toggle(v?: boolean) { this.open = v ?? !this.open; if (this.open) this.ensure(); this.panel.classList.toggle('open', this.open); if (this.open) this.render(); }
  addChat(m: { name: string; text: string; from: string }) { this.log.push({ name: m.name, text: m.text, me: m.from === this.net?.id }); if (this.log.length > 40) this.log.shift(); const d = document.createElement('div'); d.innerHTML = `<b>${esc(m.name)}</b> ${esc(m.text)}`; this.chatEl.appendChild(d); while (this.chatEl.children.length > 4) this.chatEl.firstChild!.remove(); setTimeout(() => { d.style.opacity = '0'; setTimeout(() => d.remove(), 1000); }, 9000); if (this.open) this.render(); }
  rttTick() { const el = this.panel.querySelector('#pp-rtt'); if (el) el.textContent = this.net!.rtt + ' ms'; }
  /** small menu next to a clicked town player: Invite / Join party / Inspect */
  townMenu(p: any, x: number, y: number) { const n = this.net; if (!n || n.state !== 'online') return; const m = this.menuEl; const mine = n.party?.members.some(q => q.id === p.id);
    m.dataset.id = p.id; m.innerHTML = `<div class="hd">${esc(p.name || 'Player')} <span class="mut">Lv${p.lvl || 1}</span></div>${mine ? '<div class="hd mut">In your party</div>' : `<button data-m="invite" title="Ask them to join your party">Invite</button><button data-m="join" title="Ask to join their party">Join party</button>`}<button data-m="inspect" title="See their gear">Inspect</button>`;
    m.style.display = 'block'; const r = m.getBoundingClientRect(); m.style.left = Math.max(4, Math.min(innerWidth - r.width - 4, x + 8)) + 'px'; m.style.top = Math.max(4, Math.min(innerHeight - r.height - 4, y - 8)) + 'px'; (m as any)._p = p; }
  showInvite(m: { from: string; name: string; kind: string }) { this.invites = this.invites.filter(i => i.from !== m.from); this.invites.push({ ...m, at: Date.now() }); this.drawInvite(); }
  private drawInvite() { const i = this.invites[0]; const e = this.inviteEl; if (!i) { e.style.display = 'none'; return; } e.dataset.from = i.from; e.style.display = 'block';
    e.innerHTML = `<div class="t">${esc(i.name)}</div><div>${i.kind === 'join' ? 'wants to join your party' : 'invites you to a party'}</div><div class="row"><button data-m="accept" class="go">Accept</button><button data-m="decline">Decline</button></div>`; }
  /** ready check: leader stepped into an entrance; ~15 s countdown; you stay in town (still in the party) if you decline or let it run out */
  private drawCheck() { const n = this.net, c = n?.party?.check, e = this.checkEl; if (!n || !c || this.sess?.active) { e.style.display = 'none'; (e as any)._key = ''; return; }
    const key = c.dungeon + (n.party!.code); const me = n.id, said = c.yes.includes(me) ? 'yes' : c.no.includes(me) ? 'no' : ''; if ((e as any)._key !== key) { (e as any)._key = key; (e as any)._until = Date.now() + c.ms; } const left = Math.max(0, (e as any)._until - Date.now());
    const names = n.party!.members.map(m => `${esc(m.name)} ${c.yes.includes(m.id) ? '<span style="color:#7bd389">✓</span>' : c.no.includes(m.id) ? '<span style="color:#e5604a">✗</span>' : '<span class="mut">…</span>'}`).join(' · ');
    e.style.display = 'block'; e.innerHTML = `<div class="t">${esc(DUNGEONS[c.dungeon]?.name || c.dungeon)}</div><div class="mut" title="Ready members go in together. Anyone else stays in town and can Join later.">Ready check · ${Math.ceil(left / 1000)} s</div><div class="bar"><i style="width:${Math.min(100, left / 150)}%"></i></div><div class="mut">${names}</div>${said ? '' : '<div class="row"><button data-m="ready" class="go">Ready</button><button data-m="notready">Not now</button></div>'}`; }
  private onPrompt(ev: Event) { const b = (ev.target as HTMLElement).closest('[data-m]') as HTMLElement | null; if (!b) return; ev.stopPropagation(); const a = b.dataset.m, n = this.net; if (!n) return;
    if (a === 'invite' || a === 'join') { n.invite(this.menuEl.dataset.id!, a); this.menuEl.style.display = 'none'; }
    else if (a === 'inspect') { const p = (this.menuEl as any)._p; this.menuEl.style.display = 'none'; import('../inspectui').then(m => m.openInspect(p)).catch(() => {}); }
    else if (a === 'accept' || a === 'decline') { const f = this.inviteEl.dataset.from!; n.inviteReply(f, a === 'accept'); this.invites = this.invites.filter(i => i.from !== f); this.drawInvite(); }
    else if (a === 'ready' || a === 'notready') { n.checkReply(a === 'ready'); }
  }
  private tick() { this.invites = this.invites.filter(i => Date.now() - i.at < 30000); if (this.inviteEl.style.display === 'block' && !this.invites.length) this.drawInvite(); this.drawCheck(); const n = this.net; const inst = !!this.sess?.active; const you = inst ? this.sess!.ic!.you : null; this.downEl.style.display = you?.down ? 'block' : 'none'; if (you?.down) this.downEl.textContent = 'DOWNED: a teammate can revive you (hold F)'; if (!this.open) this.syncBtn(); else { const key = JSON.stringify([n?.state, n?.party, inst, n?.townPop, n?.shard]); if (key !== this.last) this.render(); } }
  syncBtn() { const n = this.net; this.btn.classList.toggle('on', n?.state === 'online'); this.btn.classList.toggle('party', !!n?.party); const tt = this.btn.querySelector('.tt'); if (tt) tt.innerHTML = (n?.state === 'online' ? 'Party' : n?.lastErr ? 'Party: offline' : 'Party') + '<kbd>P</kbd>'; }
  private inviteLink() { const u = new URL(location.href); u.search = ''; if (new URLSearchParams(location.search).get('server')) u.searchParams.set('server', this.url); u.searchParams.set('party', this.net!.party!.code); return u.toString(); }
  private onClick(e: Event) {
    const t = (e.target as HTMLElement).closest('[data-a]') as HTMLElement | null; if (!t) return; const a = t.dataset.a!; const $ = (id: string) => (this.panel.querySelector('#' + id) as HTMLInputElement | null)?.value || ''; const n = this.net;
    if (a === 'retry') { this.ensure(); return; } if (!n) return;
    if (a === 'join') { this.saveName(); n.joinParty($('pp-code')); } else if (a === 'leave') { n.leaveParty(); if (this.sess?.active) this.sess.exit('left party', true); }
    else if (a === 'dropin') n.dropIn(); else if (a === 'kick') n.kick(t.dataset.id!);
    else if (a === 'copy') { if (!n.party) { this.saveName(); n.createParty(); this.copyWhenReady = true; return; } navigator.clipboard?.writeText(this.inviteLink()).catch(() => {}); this.g.toast('Invite link copied.'); }
    else if (a === 'chat') { const v = $('pp-chat').trim(); if (v) { n.chat(v); (this.panel.querySelector('#pp-chat') as HTMLInputElement).value = ''; } }
    else if (a === 'leaveinst') { this.sess?.exit('left', true); n.send({ t: 'leave_instance' }); }
  }
  copyWhenReady = false;
  private saveName() { const nm = (this.panel.querySelector('#pp-name') as HTMLInputElement)?.value.trim(); if (nm) { try { setPartyName(nm); } catch {} this.net!.profile(nm, Math.max(1, (this.g.save as any).level || 1), this.sess?.look()); } }
  render() {
    this.syncBtn(); const n = this.net; const p = this.panel; if (!this.open) return; const keep = { chat: (p.querySelector('#pp-chat') as HTMLInputElement | null)?.value, name: (p.querySelector('#pp-name') as HTMLInputElement | null)?.value, code: (p.querySelector('#pp-code') as HTMLInputElement | null)?.value }; const focus = document.activeElement?.id;
    const name = keep.name ?? (partyName() || 'Guest-' + Math.floor(1000 + Math.random() * 9000)); let h = '';
    if (!n || n.state !== 'online') {
      const bad = !!n?.lastErr && n.state === 'off';
      h = `<h4>Party <span class="mut">${bad ? 'offline' : 'connecting…'}</span></h4><div class="mut">${bad ? esc(n!.versionError || 'Can\'t reach the game server right now. Solo play is unaffected.') : 'Solo play is unaffected.'}</div>${bad && !n!.versionError ? '<div class="row"><button data-a="retry" class="go">Retry</button></div>' : ''}`;
    } else {
      const pt = n.party, inst = !!this.sess?.active; h = `<h4>Party <span class="mut"><span id="pp-rtt">${n.rtt} ms</span> · ${inst ? 'in dungeon' : (n.townPop || 1) + ' in town'}</span></h4>`;
      if (pt && this.copyWhenReady) { this.copyWhenReady = false; navigator.clipboard?.writeText(this.inviteLink()).catch(() => {}); this.g.toast('Invite link copied.'); }
      if (!pt) h += `<div class="row"><input id="pp-name" maxlength="16" value="${esc(name)}" aria-label="Display name" title="Your name for other players"></div><div class="mut">Click a player in town to invite them.</div><div class="row"><button data-a="copy" title="Copy a link a friend can open to join you">Invite link</button></div><details><summary class="mut">Have a code?</summary><div class="row"><input id="pp-code" maxlength="8" placeholder="Code" value="${esc(keep.code || '')}" aria-label="Party code"><button data-a="join">Join</button></div></details>`;
      else {
        const me = pt.members.find(m => m.id === n.id); const lead = !!me?.leader; const cnt = pt.members.length;
        h += pt.members.map(m => `<div class="mem"><span>${m.leader ? '♛' : ''}</span><span class="nm">${esc(m.name)} <span class="mut">Lv${m.lvl}</span></span><span class="${m.inRun ? 'ok' : 'wait'}">${m.inRun ? 'in run' : 'town'}</span>${lead && !m.leader && !pt.inInstance ? `<button data-a="kick" data-id="${esc(m.id)}" title="Remove from party">×</button>` : ''}</div>`).join('');
        if (!inst && pt.inInstance && !me?.inRun) h += `<div class="row"><button data-a="dropin" class="go" title="Drop into your party's ${esc(DUNGEONS[pt.dungeon || '']?.name || 'run')} at the entrance">Join run</button></div>`;
        else if (!inst) h += `<div class="mut" title="Enemy HP ×${partyHpMul(cnt).toFixed(2)} for ${cnt}. Loot is personal.">${lead ? 'Step into a gateway to start a ready check.' : 'The leader picks the dungeon by stepping into a gateway.'}</div>`;
        else h += `<div class="row"><button data-a="leaveinst">Leave dungeon</button></div><div class="mut">Hold F near a downed teammate to revive · G pings the map</div>`;
        h += `<div class="row"><button data-a="copy" title="Copy a link a friend can open to join you">Invite link</button><button data-a="leave">Leave party</button></div>`;
        h += `<div class="chatlog" id="pp-log">${this.log.slice(-8).map(c => `<div><b>${esc(c.name)}</b> ${esc(c.text)}</div>`).join('') || '<span class="mut">No messages</span>'}</div><div class="row"><input id="pp-chat" maxlength="140" placeholder="Chat (Enter)" aria-label="Chat"><button data-a="chat">Send</button></div>`;
      }
    }
    p.innerHTML = h; this.last = JSON.stringify([n?.state, n?.party, !!this.sess?.active, n?.townPop, n?.shard]);
    const chat = p.querySelector('#pp-chat') as HTMLInputElement | null; if (chat) { chat.value = keep.chat || ''; chat.onkeydown = ev => { ev.stopPropagation(); if (ev.key === 'Enter') { const v = chat.value.trim(); if (v) { n!.chat(v); chat.value = ''; } } if (ev.key === 'Escape') { this.toggle(false); chat.blur(); } }; }
    const log = p.querySelector('#pp-log'); if (log) log.scrollTop = log.scrollHeight; if (focus && focus !== 'pp-chat') (p.querySelector('#' + focus) as HTMLElement | null)?.focus();
  }
}
