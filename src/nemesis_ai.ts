// Client side of AI nemesis words (docs/NEMESIS.md, server/nemesis_words.mjs). Sends ids + labels only; the reply goes through
// nemesis.applyWords(), which accepts only a validated name + taunt. Any failure keeps the canned words. Respects settings.storyAi.
import { nemOf, applyWords } from './nemesis';
import { ENEMIES } from './config';
import { PLAYER_ID, SESSION_ID } from './story_beats';
import { persist } from './state';
export async function nameNemesis(s: any, id: string, endpoint?: string, fetcher: (u: string, i: any) => Promise<any> = (u, i) => fetch(u, i)): Promise<'ai' | 'kept' | 'skip'> {
  const n = nemOf(s).list.find(x => x.id === id); if (!n || n.words === 'ai' || s.settings?.storyAi === false) return 'skip';
  const url = endpoint || ((import.meta as any).env?.VITE_WV_STORY_URL as string) || 'api/story-beat';
  const body = { kind: 'nemesis_words', session: SESSION_ID, player: PLAYER_ID, nem: n.id, enemy: n.src, enemyName: ENEMIES[n.src]?.name, cat: n.cat, tier: n.tier, trophy: n.trophy?.name };
  try { const r = await fetcher(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); const j = await r.json();
    if (j && j.ok && j.src === 'ai' && applyWords(n, j)) { persist(s); return 'ai'; } return 'kept'; } catch { return 'kept'; } }
