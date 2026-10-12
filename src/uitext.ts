// UI text principle (docs/UI.md): compact labels in the interface, full detail in the shared tooltip (data-tip: hover on desktop, tap/long-press on touch).
/** Short form of a long item/gear name for tile captions: drops the maker prefix and side suffix, then keeps whole words up to `max` characters
 *  (first word always kept, trimmed with an ellipsis only if it alone is too long). The full name belongs in the element's data-tip / aria-label. */
export function shortLabel(name:string,max=12):string{ const n=name.replace(/^[A-Z]{2,3}(?:-\d+)?\s+/,'').replace(/\s*\((?:L|R|Left|Right)\)$/i,'').replace(/\s*\([^)]*\)$/,'').trim();
  if(n.length<=max) return n; const w=n.split(/\s+/); let out=w[0]; if(out.length>max) return out.slice(0,max-1)+'…';
  for(let i=1;i<w.length;i++){ if((out+' '+w[i]).length>max) break; out+=' '+w[i]; } return out; }
