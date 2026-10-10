// Mobile/PWA plumbing. Everything here is inert on a desktop (fine pointer) except harmless listeners.
import type { AudioSys } from './audio';
import type { Game } from './sim';
import { Q } from './quality';

const coarse = () => matchMedia('(pointer:coarse)').matches || new URLSearchParams(location.search).has('touch');

export function initMobile(game: Game, audio: AudioSys, onResize: () => void) {
  const isTouch = coarse(); const b = document.body;
  // --- viewport: 100dvh with a JS fallback (iOS address bar collapse, keyboard, rotation) ---
  const setVh = () => { const vv = window.visualViewport; const h = Math.round(vv ? vv.height : window.innerHeight); document.documentElement.style.setProperty('--vh', h + 'px'); const portrait = innerHeight > innerWidth; b.classList.toggle('portrait', portrait); b.classList.toggle('landscape', !portrait); };
  setVh(); window.addEventListener('resize', setVh); window.visualViewport?.addEventListener('resize', () => { setVh(); onResize(); });
  window.addEventListener('orientationchange', () => { setVh(); setTimeout(() => { setVh(); onResize(); window.scrollTo(0, 0); }, 250); });
  if (!isTouch) return;
  // --- no zoom / selection / callouts / pull-to-refresh ---
  const stop = (e: Event) => e.preventDefault();
  for (const t of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(t, stop as any, { passive: false });
  document.addEventListener('contextmenu', e => { if (!(e.target as HTMLElement)?.closest?.('input,textarea')) e.preventDefault(); });
  document.addEventListener('selectstart', e => { if (!(e.target as HTMLElement)?.closest?.('input,textarea')) e.preventDefault(); });
  document.addEventListener('dragstart', stop);
  // multi-touch pinch on the page must never zoom: block 2+-finger touchmove outside scroll panels
  document.addEventListener('touchmove', e => { if (e.touches.length > 1 || !(e.target as HTMLElement)?.closest?.('.sbody,.win .body,.scroll,#modal [class*=scroll],#livepanel,textarea,select')) { if (e.cancelable && !(e.target as HTMLElement)?.closest?.('#modal,#livepanel')) e.preventDefault(); } }, { passive: false });
  // --- audio unlock on the first real gesture (iOS needs touchend/click, not pointerdown) + resume on return ---
  const unlock = () => { audio.resume(); if ((audio as any).ctx?.state === 'running') for (const t of ['touchend', 'click', 'pointerup', 'keydown']) window.removeEventListener(t, unlock, true); };
  for (const t of ['touchend', 'click', 'pointerup', 'keydown']) window.addEventListener(t, unlock, true);
  // --- wake lock while playing (re-acquired after the browser releases it on tab switch) ---
  let wl: any = null; const wake = async () => { try { if ('wakeLock' in navigator && !document.hidden && !wl) { wl = await (navigator as any).wakeLock.request('screen'); wl.addEventListener('release', () => { wl = null; }); } } catch { wl = null; } };
  window.addEventListener('pointerup', wake, { once: false, capture: true, passive: true } as any);
  // --- background: save, silence, stop sim; foreground: resume audio, reset timing ---
  const ctx = () => (audio as any).ctx as AudioContext | undefined;
  document.addEventListener('visibilitychange', () => { if (document.hidden) { try { game.saveNow(); } catch { /* ignore */ } ctx()?.suspend?.().catch(() => { }); } else { audio.resume(); ctx()?.resume?.().catch(() => { }); wake(); setVh(); onResize(); } });
  window.addEventListener('pagehide', () => { try { game.saveNow(); } catch { /* ignore */ } });
  document.addEventListener('freeze', () => { try { game.saveNow(); } catch { /* ignore */ } });
  // --- low memory: drop caches that can be rebuilt when Chrome signals pressure, or when memory is clearly tight ---
  (window as any).__lowMem = () => { Q.setPref('low'); game.save.settings.quality = 'low'; };
  // --- fullscreen + orientation lock best-effort on first tap (Android Chrome; iOS ignores) when installed/standalone is not already in effect ---
  const standalone = matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches || (navigator as any).standalone;
  b.classList.toggle('standalone', !!standalone);
  const fs = () => { if (standalone || document.fullscreenElement || !document.documentElement.requestFullscreen) return; document.documentElement.requestFullscreen({ navigationUI: 'hide' } as any).then(() => (screen.orientation as any)?.lock?.('landscape').catch(() => { })).catch(() => { }); };
  if (game.save.settings.autoFullscreen !== false && !/iPhone|iPad/.test(navigator.userAgent)) window.addEventListener('touchend', fs, { once: true, capture: true });
  // --- portrait: friendly prompt, dismissible ---
  const rot = document.getElementById('rotate'); rot?.querySelector('[data-act=portrait]')?.addEventListener('click', () => { b.classList.add('portraitok'); onResize(); });
}

declare const __BUILD__: string;
/** Production only: register the versioned service worker (dev server must never be cached). */
export function registerSW() {
  if (!('serviceWorker' in navigator) || !(import.meta as any).env?.PROD || new URLSearchParams(location.search).has('nosw')) return;
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js?v=' + (typeof __BUILD__ !== 'undefined' ? __BUILD__ : '0')).catch(() => { }); });
}
