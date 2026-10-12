// Regenerates the kit tables in docs/BOSSES.md: npx esbuild src/content/boss_kits.ts --bundle --platform=node --format=esm --outfile=/tmp/bk.mjs && node tools/gen_boss_docs.mjs
import fs from 'fs'; const K = await import('/tmp/bk.mjs'); const C = await import('/tmp/bk.mjs');
const I = K.MECH_INFO; let md = '';
md += '| Mechanic | Telegraph (shape / style) | Visual language | Stinger |\n|---|---|---|---|\n';
for (const [m, i] of Object.entries(I)) md += `| **${i.name}** (\`${m}\`) | ${i.shape} / ${i.style} | ${i.tell} | \`${i.sfx}:tell\` / \`:fire\` |\n`;
md += '\n| Boss id | Kit | Palette | Mechanics (cooldown s, gate) |\n|---|---|---|---|\n';
for (const [id, k] of Object.entries(K.KITS)) md += `| \`${id}\` | ${k.title} | ${k.pal} | ${k.mechs.map(x => `${I[x.m].name} (${x.cd}${x.at ? ', <=' + Math.round(x.at * 100) + '% HP' : ''})`).join('; ')} |\n`;
fs.writeFileSync('/tmp/tables.md', md); console.log(md.length);
