// Nemesis card (docs/NEMESIS.md): one fixed DOM node, shown on 'nemesis' events. Short label + tooltip; subtitle always shown (voice is optional).
import { playTaunt } from './nemesis_voice';
import { nemOf, MODULES } from './nemesis';
import { nameNemesis } from './nemesis_ai';
let node: HTMLDivElement | null = null; let hideT: any = 0;
const esc = (s: string) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
export function showNemesis(g: any, p: any) { if (typeof document === 'undefined') return;
  if (!node) { node = document.createElement('div'); node.id = 'nemCard'; node.className = 'nem-card'; document.body.appendChild(node); }
  const n = nemOf(g.save).list.find(x => x.id === p.id); const head = p.kind === 'killed' ? 'Nemesis slain' : p.kind === 'created' ? 'New nemesis' : p.kind === 'promoted' ? 'Promoted' : p.kind === 'recruited' ? 'Recruited' : p.kind === 'return' ? 'Nemesis returns' : 'Stronger';
  const mods = n && p.kind !== 'killed' ? n.modules.map(m => `<span class="nem-mod" title="${esc(MODULES[m].tip)}">${esc(MODULES[m].name)}</span>`).join('') : '';
  const sub = p.kind === 'killed' ? esc(p.line || '') : '“' + esc(p.taunt || n?.taunt || '') + '”';
  node.innerHTML = `<div class="nem-head" title="A nemesis returns in later runs, adapts to your build, and can be killed for good.">${esc(head)}</div><div class="nem-name">${esc(n?.name || p.name || '')}${n && p.kind !== 'killed' ? ` <span class="nem-title">${esc(n.title)} · R${n.rank}</span>` : ''}</div>${n?.trophy && p.kind !== 'killed' ? `<div class="nem-trophy" title="Taken from you: ${esc(n.trophy.name)}">Wears your ${esc(n.trophy.name)}</div>` : ''}<div class="nem-line">${sub}</div><div class="nem-mods">${mods}</div>`;
  node.classList.add('on'); node.dataset.voice = 'pending'; clearTimeout(hideT); hideT = setTimeout(() => node?.classList.remove('on'), 6500);
  if (p.kind === 'created') nameNemesis(g.save, p.id).then(r => { if (r === 'ai' && node) { const nn = node.querySelector('.nem-name'); const n2 = nemOf(g.save).list.find(x => x.id === p.id); if (nn && n2) nn.firstChild!.textContent = n2.name + ' '; } });
  playTaunt(p.tauntKey, g.save.settings).then(r => { if (node) node.dataset.voice = r; }); }
