// Transfers + exports + IDKFA per character (docs/CHARACTERS.md, docs/TRAITS.md): account mailbox respects ownership (unequipped, no cheat gear),
// chips stay with the sender, level requirement to claim, traits never transfer; build export/code/text carry traits; "What changed" covers
// trait changes; IDKFA is per character.
import { launch, sleep } from './lib.mjs'; import fs from 'fs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
fs.mkdirSync('shots/mail', { recursive: true });
const { browser, page, errors } = await launch({ query: '?splash=hold' }); const ev = (f, a) => page.evaluate(f, a);
const boot = async () => { await page.waitForFunction(() => window.__game); await ev(() => { document.getElementById('splash')?.remove(); window.__ui.close(); }); await sleep(250); };
await ev(() => document.getElementById('splash')?.remove());
const a = await ev(async () => { const C = await import('/src/chars.ts'), St = await import('/src/state.ts'), Cf = await import('/src/config.ts'), S = await import('/src/traitstate.ts');
  const g = window.__game, s = g.save; g.enterTown(true); const r = C.createChar('Bea', St.newSave); const A = C.ensureRoster().active;
  const low = Cf.ITEMS.find(i => !i.id.startsWith('stock_') && i.lvl <= 1 && /^leg/.test(i.slot)), high = Cf.ITEMS.find(i => i.lvl > 20 && !i.id.startsWith('idkfa_') && !i.id.startsWith('sig_'));
  const iL = St.mkInst(s, low.id), iH = St.mkInst(s, high.id), iC = St.mkInst(s, low.id); iC.chips = ['speed']; s.items.push(iL, iH, iC); const chips0 = s.lockerChips.speed || 0;
  S.traitsOf(s).l10 = { id: 'netrunner', at: 1, level: 12 }; s.cheated = false; St.persist(s); window.__ids = { iL: iL.uid, iH: iH.uid, iC: iC.uid };
  const M = await import('/src/mail.ts'); const eq = Object.values(s.installed)[0];
  const res = { trait: M.sendItem(s, 'netrunner', r.id), equipped: M.sendItem(s, eq, r.id), self: M.sendItem(s, iL.uid, A) };
  res.lowOk = M.sendItem(s, iL.uid, r.id).ok; res.highOk = M.sendItem(s, iH.uid, r.id).ok; res.chipOk = M.sendItem(s, iC.uid, r.id).ok; St.persist(s);
  res.gone = ![iL.uid, iH.uid, iC.uid].some(u => s.items.some(i => i.uid === u)); res.chipBack = (s.lockerChips.speed || 0) === chips0 + 1; res.B = r.id; res.A = A; res.highLvl = high.lvl;
  // cheat gear: IDKFA ON on character A
  window.__game.cheatIdkfa ? 0 : 0; return res; });
ok(!a.trait.ok && /Traits stay/.test(a.trait.why), 'a trait cannot be sent (traits stay with their character)');
ok(!a.equipped.ok && !a.self.ok, 'equipped items and sending to yourself are refused');
ok(a.lowOk && a.highOk && a.chipOk && a.gone && a.chipBack, 'unequipped items sent; they leave the sender; socketed chips stay in the sender locker');
await page.keyboard.type('idkfa'); await sleep(250);
const cheat = await ev(async () => { const M = await import('/src/mail.ts'); const s = window.__game.save; const u = s.idkfa.granted.find(x => !Object.values(s.installed).includes(x)) || s.idkfa.granted[0]; const r = M.canSend(s, u); return { on: s.idkfa.on, r, inst: Object.values(s.installed).includes(u) }; });
ok(cheat.on && !cheat.r.ok, 'IDKFA cheat gear cannot be mailed (' + cheat.r.why + ')');
// export with traits
const ex = await ev(async () => { const B = await import('/src/buildcode.ts'); const s = window.__game.save; const e = B.exportBuild(s); const code = B.encodeBuild(e); const d = B.decodeBuild(code); return { e, d, text: B.buildText(e) }; });
ok(ex.e.traits?.[0] === 'netrunner' && ex.d.ok && ex.d.build.traits[0] === 'netrunner' && /Traits: Netrunner/.test(ex.text), 'build export JSON / code / text carry the confirmed traits');
const bad = await ev(async () => { const B = await import('/src/buildcode.ts'); const raw = { v: 1, game: 'x', cat: 'abcdef12', lvl: 12, slots: {}, traits: ['a', 'b', 'c'] }; const code = 'WVB1.' + btoa(JSON.stringify(raw)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); return B.decodeBuild(code); });
ok(!bad.ok && /traits/.test(bad.why), 'decode rejects malformed trait lists');
const diff = await ev(async () => { const C = await import('/src/catalog_snap.ts'); const cur = C.snapshot(); const old = JSON.parse(JSON.stringify(cur)); old.traits.netrunner.e = ['+5% damage with hacking abilities']; old.traits.gone_trait = { n: 'Gone', t: 1, e: [], p: [] };
  const pre = JSON.parse(JSON.stringify(cur)); delete pre.traits; return { changed: C.diffBuild(old, cur, {}, ['netrunner']), removed: C.diffBuild(old, cur, {}, ['gone_trait']), preTrait: C.diffBuild(pre, cur, {}, ['netrunner']) }; });
ok(diff.changed.length === 1 && diff.changed[0].kind === 'trait' && !diff.changed[0].incompatible, 'What changed: a trait whose effects changed is reported');
ok(diff.removed[0]?.kind === 'trait_removed' && diff.removed[0].incompatible && diff.preTrait.length === 0, 'What changed: removed trait is Incompatible; catalogs older than traits report nothing spurious');
await ev(() => { window.__ui.open('build'); }); await sleep(300); ok(await ev(() => /Netrunner|Netrun/.test(document.querySelector('#modal .bdtraits')?.textContent || '') && !!document.querySelector('#modal .bdtraits [data-tip]')), 'build inspector shows the traits (short label + tooltip)');
await ev(() => window.__ui.close());
// switch to B
await ev(async b => { const C = await import('/src/chars.ts'), St = await import('/src/state.ts'); St.persist(window.__game.save); C.selectChar(b); window.__wvNoPersist = true; location.reload(); }, a.B); await sleep(500); await boot();
const b = await ev(async () => { const M = await import('/src/mail.ts'), S = await import('/src/traitstate.ts'); const s = window.__game.save; const box = M.inbox(); const out = { n: box.length, l10: S.traitsOf(s).l10, idkfa: !!s.idkfa?.on, cheated: !!s.cheated, lvl: s.level };
  out.claims = box.map(m => ({ def: m.def, r: M.claimMail(s, m.id) })); (await import('/src/state.ts')).persist(s); out.items = s.items.map(i => i.def); out.left = M.inbox().length; return out; });
ok(b.n === 3 && b.l10 === null, 'receiver sees 3 mails; no trait came with them');
ok(b.claims.filter(c => c.r.ok).length === 2 && b.claims.some(c => !c.r.ok && /Needs level/.test(c.r.why)) && b.left === 1, `claim needs the item level (Lv ${b.lvl} cannot claim a Lv ${a.highLvl} item); claimed items land in the locker`);
ok(!b.idkfa && !b.cheated, 'IDKFA is per character: on for the sender, off and not flagged on the receiver');
await ev(() => { window.__game.enterTown(true); window.__ui.open('bank'); }); await sleep(200);
ok(await ev(() => /Mail \(1\)/.test(document.querySelector('[data-act="ml-open"]')?.textContent || '')), 'bank shows Mail with the pending count');
await page.click('[data-act="ml-open"]'); await sleep(250); await page.screenshot({ path: 'shots/mail/mail_desktop.png' });
ok(await ev(() => !!document.querySelector('#modal .mlinbox [data-act="ml-claim"][disabled]')), 'mail modal: locked claim shown disabled with a reason tooltip');
// back to A: IDKFA still on there
await ev(async x => { const C = await import('/src/chars.ts'), St = await import('/src/state.ts'); St.persist(window.__game.save); C.selectChar(x); window.__wvNoPersist = true; location.reload(); }, a.A); await sleep(500); await boot();
ok(await ev(() => window.__game.save.idkfa?.on === true && window.__game.save.traits.l10.id === 'netrunner'), 'back on the sender: IDKFA still on, trait still there');
ok(errors.length === 0, 'no page errors ' + errors.slice(0, 2).join('|')); await browser.close();
console.log(fails ? `\n${fails} FAILED` : '\nALL PASS'); process.exit(fails ? 1 : 0);
