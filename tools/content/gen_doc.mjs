// Generates docs/CONTENT_BATCH_1.md tables from the data in src/content/batch1_*.ts so the doc and the game never drift.
// usage: node tools/content/gen_doc.mjs
import { build } from 'esbuild'; import fs from 'fs'; import { pathToFileURL } from 'url';
const out = '/tmp/batch1_data.mjs';
await build({ stdin: { contents: "export * from '/workspace/content20/src/content/batch1_bosses.ts'; export * from '/workspace/content20/src/content/batch1_levels.ts';", resolveDir: process.cwd(), loader: 'ts' }, bundle: true, format: 'esm', outfile: out, logLevel: 'error' });
const { BOSSES, LEVELS } = await import(pathToFileURL(out).href + '?' + Date.now());
const mv = m => m.k + (m.p ? '(' + Object.entries(m.p).map(([k, v]) => k + v).join(',') + ')' : '');
const act = a => a.k === 'shield' ? `shield ${Math.round(a.pct * 100)}%/${a.dur}s` : a.k === 'pylons' ? `${a.n}x ${a.type} tether` : a.k === 'enrage' ? `enrage x${a.spd} speed, x${a.cd} cooldowns` : a.k === 'adds' ? `${a.n}x ${a.type} wave` : `gimmick ${a.g.k}`;
const gm = g => g ? g.k + ' every ' + g.every + 's' : 'none';
const tier = ['', 'I', 'II', 'III', 'IV'];
let d = fs.readFileSync(new URL('./batch1_head.md', import.meta.url), 'utf8');
d += '\n## 3. Bosses (20)\n\n| # | id | Name | Faction | Tier | Level | HP | Melee (existing) | Toolkit moves | Phases | Arena gimmick | Signature |\n|---|---|---|---|---|---|---|---|---|---|---|---|\n';
BOSSES.forEach((b, i) => { d += `| ${i + 1} | \`${b.id}\` | ${b.name} | ${b.faction} | ${tier[b.tier]} | \`${b.level}\` | ${b.hp} | ${b.melee.join(', ') || '-'} | ${b.moves.map(mv).join('; ')} | ${b.phases.map(p => `<${Math.round(p.at * 100)}%: ${p.acts.map(act).join(' + ')}`).join('; ')} | ${gm(b.gimmick)}. ${b.arena} | ${b.signature} |\n`; });
d += '\n### 3.1 Lore tie-ins\n\n'; for (const b of BOSSES) d += `- **${b.name}** (${b.faction}): ${b.lore}\n`;
d += '\n### 3.2 Phase lines (spoken on transition)\n\n'; for (const b of BOSSES) d += `- ${b.name}: ${b.phases.map(p => `"${p.say}"`).join(' / ')}\n`;
d += '\n## 4. Levels (20)\n\n| # | id | Name | Host boss | Mfr | Tier | Lv band | Theme / motif | Room shapes (yard, hall, junction, arena) | Hazards | Objective | Gate guard / lock elite | Roster | Unlock |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|---|\n';
LEVELS.forEach((l, i) => { const ro = [...new Set(Object.values(l.roster).flat().filter(x => x[1] > 0).map(x => x[0]))].join(', '); d += `| ${i + 1} | \`${l.id}\` | ${l.name} | \`${l.boss}\` | ${l.mfr} | ${tier[l.tier]} | ${l.minLevel}-${l.maxLevel} | ${l.pal.motif}, ${l.pal.light} light | ${l.shapes.join(' / ')} | ${l.haz.label} (${l.haz.mode} x${l.haz.n}) | ${l.objective.label} | ${l.gateGuard} / ${l.lockElite} | ${ro} | ${l.unlock.after.join(' + ')} |\n`; });
d += '\n### 4.1 Level blurbs and rewards\n\n| id | Blurb | Credit x | Clear XP | Cache chips | Loot pool |\n|---|---|---|---|---|---|\n'; for (const l of LEVELS) d += `| \`${l.id}\` | ${l.blurb} | ${l.creditMul} | ${l.xp} | ${l.chips.join(', ')} | ${l.loot} |\n`;
fs.writeFileSync('docs/CONTENT_BATCH_1.md', d); console.log('wrote docs/CONTENT_BATCH_1.md', d.length);
