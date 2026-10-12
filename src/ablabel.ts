// Ability / Dodge button captions: break only at spaces, never inside a word. If the longest word is wider than the label box, shrink the font (to a 10px floor),
// then tighten letter-spacing, and only as a last resort ellipsise (full name goes in the tooltip). At most two lines.
export const AB_LABEL_MIN_PX = 10;
const meas = (() => { let s: HTMLSpanElement | null = null; return (word: string, cs: CSSStyleDeclaration, fs: number, ls: number) => { if (!s) { s = document.createElement('span'); s.style.cssText = 'position:fixed;left:-9999px;top:-9999px;visibility:hidden;white-space:nowrap;pointer-events:none'; document.body.appendChild(s); } s.style.fontFamily = cs.fontFamily; s.style.fontWeight = cs.fontWeight; s.style.textTransform = cs.textTransform; s.style.fontSize = fs + 'px'; s.style.letterSpacing = ls + 'px'; s.textContent = word; return s.getBoundingClientRect().width; }; })();
/** returns the font size / letter spacing applied and whether the ellipsis fallback was needed */
export function fitAbLabel(el: HTMLElement): { fs: number; ls: number; ellipsis: boolean } {
  el.style.fontSize = ''; el.style.minHeight = ''; el.style.letterSpacing = ''; el.style.whiteSpace = ''; el.style.overflow = ''; el.style.textOverflow = ''; el.removeAttribute('title'); delete el.dataset.fit;
  const text = (el.textContent || '').trim(); const parent = el.parentElement; if (!text || !parent) return { fs: 0, ls: 0, ellipsis: false };
  const cs = getComputedStyle(el); let fs = parseFloat(cs.fontSize) || 12; const boxH = Math.round(fs * (parseFloat(cs.lineHeight) / fs || 1.1) * 2 + 2 + (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0)); /* every caption box has the height of two lines at the UNshrunk size, so shrunk text never changes it */ const ls0 = parseFloat(cs.letterSpacing) || 0; const gap = parseFloat(getComputedStyle(parent.parentElement || parent).columnGap) || 0;
  const pad = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0); const avail = Math.max(24, parent.getBoundingClientRect().width + (parent.id === 'dodge' ? 0 : gap) - 4 - pad);
  const words = text.split(/\s+/); const widest = (f: number, l: number) => Math.max(...words.map(w => meas(w, cs, f, l)));
  let ls = ls0; let guard = 0; while (widest(fs, ls) > avail && fs > AB_LABEL_MIN_PX && guard++ < 40) fs = Math.max(AB_LABEL_MIN_PX, fs - .5);
  if (widest(fs, ls) > avail) { for (const k of [.5, .25, 0, -.4, -.8]) { ls = Math.min(ls0, k); if (widest(fs, ls) <= avail) break; } }
  let ellipsis = false; if (widest(fs, ls) > avail) { ellipsis = true; el.style.whiteSpace = 'nowrap'; el.style.overflow = 'hidden'; el.style.textOverflow = 'ellipsis'; el.style.maxWidth = avail + pad + 'px'; el.title = text; }
  el.style.minHeight = boxH + 'px'; el.style.fontSize = fs + 'px'; el.style.letterSpacing = ls + 'px'; el.dataset.fit = ellipsis ? 'ellipsis' : 'ok';
  // two lines at most: shrink further while the wrapped text needs a third line
  guard = 0; const lh = () => parseFloat(getComputedStyle(el).lineHeight) || fs * 1.1; while (!ellipsis && el.getBoundingClientRect().height > lh() * 2.4 && fs > AB_LABEL_MIN_PX && guard++ < 20) { fs = Math.max(AB_LABEL_MIN_PX, fs - .5); el.style.fontSize = fs + 'px'; }
  return { fs, ls, ellipsis };
}
