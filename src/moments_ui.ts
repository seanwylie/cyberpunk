// Moments controller + Share/Copy/Download panel (docs/MOMENTS.md). One fixed button node, one panel node created on first open.
// Capture work happens off the frame path: the frame snapshot is a single drawImage scheduled after the frame, the card renders on idle.
import { feature } from './features';
import { offer, type Moment, type MomentSession, MOMENT_LABEL } from './moments';
import { ClipBuffer } from './clipbuf';
import { BUILD_ID } from './version'; import { CATALOG_VERSION } from './catalog_version';
import { exportBuild, encodeBuild, buildUrl } from './buildcode';
const idle = (f: () => void) => ((globalThis as any).requestIdleCallback ? (globalThis as any).requestIdleCallback(f, { timeout: 1500 }) : setTimeout(f, 50));
export class Moments {
  ses: MomentSession = { best: null, captures: 0 }; card: Blob | null = null; clip: Blob | null = null; url = ''; clipUrl = ''; shared = false; clipBuf: ClipBuffer | null = null; busy: Promise<void> | null = null;
  private btn: HTMLButtonElement | null = null; private panel: HTMLDivElement | null = null;
  constructor(private g: any, private canvas: HTMLCanvasElement) { this.syncClip(); document.addEventListener('visibilitychange', () => this.syncClip()); }
  syncClip() { const want = feature('momentClip', this.g.save.settings) && !document.hidden && ClipBuffer.supported();
    if (want && !this.clipBuf?.running) { this.clipBuf = new ClipBuffer(this.canvas); this.clipBuf.start(); } else if (!want && this.clipBuf) { this.clipBuf.stop(); if (!feature('momentClip', this.g.save.settings)) { this.clipBuf.clear(); this.clipBuf = null; } } }
  stats(): Record<string, string | number> { const s = this.g.save; const tr = s.traits?.l10?.id; return { Runner: (s.charName || (() => { try { return localStorage.getItem('wv_name'); } catch { return null; } })() || 'Runner'), Level: s.level, Dungeon: this.g.inst ? this.g.dd?.name : 'Town', Kills: this.g.kills || 0, ...(tr ? { Trait: tr } : {}) }; }
  event(ev: any) { if (!feature('moments', this.g.save.settings)) return null; let code = ''; try { code = encodeBuild(exportBuild(this.g.save)); } catch {}
    const m = offer(this.ses, ev, { stats: this.stats(), code, ver: 'Game ' + BUILD_ID + ' · Catalog ' + CATALOG_VERSION }, this.shared); if (!m) return null; this.busy = this.capture(m); return m; }
  private capture(m: Moment): Promise<void> { return new Promise(done => { requestAnimationFrame(() => { // after this frame was drawn: one scaled copy of the game canvas
      let shot: HTMLCanvasElement | null = document.createElement('canvas'); const k = Math.min(1, 960 / Math.max(1, this.canvas.width)); shot.width = Math.max(1, Math.round(this.canvas.width * k)); shot.height = Math.max(1, Math.round(this.canvas.height * k)); try { shot.getContext('2d')!.drawImage(this.canvas, 0, 0, shot.width, shot.height); } catch { shot = null; }
      idle(async () => { const b = await (await import('./moment_card')).renderCard(m, shot); /* card painter is lazy-loaded: not in the boot bundle */ if (shot) shot.width = shot.height = 0; if (this.ses.best !== m) return done(); if (this.url) URL.revokeObjectURL(this.url); this.card = b; this.url = b ? URL.createObjectURL(b) : '';
        if (this.clipBuf?.running) { const c = await this.clipBuf.grab(); if (this.clipUrl) URL.revokeObjectURL(this.clipUrl); this.clip = c; this.clipUrl = c ? URL.createObjectURL(c) : ''; }
        this.showBtn(); done(); }); }); }); }
  private showBtn() { if (!this.btn) { const b = document.createElement('button'); b.id = 'momentBtn'; b.className = 'moment-btn'; b.textContent = 'Moment'; b.title = 'Your best moment this session. Open to share, copy or download.'; b.onclick = () => this.open(); document.body.appendChild(b); this.btn = b; } this.btn.style.display = ''; this.btn.classList.add('new'); }
  open() { const m = this.ses.best; if (!m) return; this.btn?.classList.remove('new');
    if (!this.panel) { const p = document.createElement('div'); p.id = 'momentPanel'; p.className = 'moment-panel'; document.body.appendChild(p); this.panel = p; }
    const p = this.panel; p.innerHTML = `<div class="mp-box"><div class="mp-head"><span title="Captured automatically, once per session.">${MOMENT_LABEL[m.kind] || 'Moment'}</span><button class="mp-x" title="Close">✕</button></div>
      <img class="mp-img" alt="Moment card" src="${this.url}">${this.clipUrl ? `<video class="mp-clip" src="${this.clipUrl}" muted loop playsinline controls></video>` : ''}
      <div class="mp-row"><button data-a="share" title="Share the card with your device's share sheet">Share</button><button data-a="copy" title="Copy the card image (or the build link if images can't be copied)">Copy</button><button data-a="png" title="Download the card as PNG">Download</button>${this.clipUrl ? '<button data-a="webm" title="Download the short clip (WebM)">Clip</button>' : ''}</div><div class="mp-msg"></div></div>`;
    p.style.display = 'flex'; (p.querySelector('.mp-x') as HTMLElement).onclick = () => { p.style.display = 'none'; };
    p.querySelectorAll('button[data-a]').forEach(b => (b as HTMLElement).onclick = () => this.act((b as HTMLElement).dataset.a!)); }
  async act(a: string): Promise<string> { const msg = (t: string) => { const e = this.panel?.querySelector('.mp-msg'); if (e) e.textContent = t; return t; }; const m = this.ses.best; if (!m || !this.card) return msg('Nothing to share yet.');
    const name = 'warranty-void-' + m.kind + '.png'; const link = m.code ? buildUrl(m.code) : location.href;
    if (a === 'png' || a === 'webm') { const blob = a === 'png' ? this.card : this.clip; if (!blob) return msg('No clip.'); const u = URL.createObjectURL(blob); const el = document.createElement('a'); el.href = u; el.download = a === 'png' ? name : name.replace('.png', '.webm'); document.body.appendChild(el); el.click(); el.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000); this.shared = true; return msg('Downloaded.'); }
    if (a === 'copy') { try { await (navigator.clipboard as any).write([new (window as any).ClipboardItem({ 'image/png': this.card })]); this.shared = true; return msg('Card copied.'); } catch { try { await navigator.clipboard.writeText(m.title + ' ' + link); this.shared = true; return msg('Link copied.'); } catch { return msg('Copy blocked by the browser.'); } } }
    if (a === 'share') { const f = new File([this.card], name, { type: 'image/png' }); const data: any = { title: 'Warranty Void', text: m.title, url: link, files: [f] };
      try { if ((navigator as any).canShare?.(data)) { await (navigator as any).share(data); this.shared = true; return msg('Shared.'); } if ((navigator as any).share) { delete data.files; await (navigator as any).share(data); this.shared = true; return msg('Shared.'); } } catch { return msg('Share cancelled.'); }
      return this.act('copy'); } return msg(''); }
}
