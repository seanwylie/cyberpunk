// Progression sweep (docs/PROGRESSION.md): the player must never be unable to progress.
// Part 1 (node, every dungeon x several seeds): spawn -> gate guards -> gate1 -> relay / lock elite -> lock2 -> objective -> boss door -> boss are connected in order,
//   every gate guard stands on the entry side of the gate it opens, every mob is reachable, each door joins its two stages.
// Part 2 (browser, needs the dev server): runtime nets on a real Sim: Sean's case (gate guard behind the closed gate) is pulled to the player and the gate opens
//   on its kill; the stall watchdog pulls then force-opens; the HUD objective names the next step; Settings > Unstuck works.
// Usage: node tests/progression_sweep.mjs [--full] [--node-only]
import { build } from 'esbuild'; import fs from 'fs'; import path from 'path'; import os from 'os';
const full=process.argv.includes('--full'); const nodeOnly=process.argv.includes('--node-only');
let fails=0; const ok=(c,m)=>{ console.log((c?'PASS ':'FAIL ')+m); if(!c) fails++; };
const out=path.join(os.tmpdir(),'wv_prog_'+process.pid+'.mjs');
await build({ entryPoints:[new URL('./progression/structure.ts',import.meta.url).pathname], bundle:true, platform:'node', format:'esm', outfile:out, logLevel:'error', loader:{'.png':'empty','.jpg':'empty','.json':'json'} });
const { sweep }=await import(out); fs.unlinkSync(out);
const seeds=full?Array.from({length:40},(_,i)=>i*7919+13):[1,13,7932,23770,55446,118798];
const rows=sweep(seeds); const by={}; for(const r of rows){ (by[r.id]=by[r.id]||[]).push(r); }
for(const [id,rs] of Object.entries(by)){ const bad=rs.filter(r=>r.issues.length); ok(!bad.length,id+': progression chain intact over '+rs.length+' seeds'+(bad.length?' :: '+bad.slice(0,3).map(r=>'seed '+r.seed+': '+r.issues.join('; ')).join(' | '):'')); }
if(!nodeOnly){
  const { launch, URL }=await import('./lib.mjs'); let up=false; try{ up=(await fetch(URL)).ok; }catch{}
  if(!up) console.log('SKIP browser runtime nets: dev server not running at '+URL);
  else { const { browser, page, errors }=await launch(); const ev=(fn,a)=>page.evaluate(fn,a);
    const start=(id,seed)=>ev(([id,seed])=>{ const g=window.__game; g.enterTown(); g.save.instance=null; g.inst=null; g.save.lockouts={}; g.save.lastClearDay=null; g.save.level=40; g.save.cleared={}; g.save.settings.devFreeReset=true; g.recompute(); g.dbg.god=true; return g.startRun(id,seed); },[id,seed]);
    const step=s=>ev(s=>{ const g=window.__game; for(let i=0;i<s/0.05;i++) g.update(0.05); },s);
    for(const id of ['warehouse','coke_ovens','aesthetic_ward']){
      ok(await start(id,1),id+': run starts');
      // Sean's case: push one gate guard behind the closed gate
      const r=await ev(async()=>{ const g=window.__game; const P=await import('/src/progress.ts'); const L=g.level; const st=P.stages(L); const gg=g.enemies.filter(e=>!e.dead&&e.type===g.dd.gateGuard);
        let t=-1; for(let i=0;i<st.length;i++) if(st[i]===1&&!L.solid[i]){ t=i; break; } const e=gg[0]; e.x=(t%L.w)+.5; e.y=((t/L.w)|0)+.5; e.home={x:e.x,y:e.y};
        for(const o of gg.slice(1)) g.killEnemy(o); const before=P.stageNear(L,e.x,e.y); const obj=g.objective()?.text||''; for(let i=0;i<30;i++) g.update(0.05); return {before,after:P.stageNear(L,e.x,e.y),obj,gate:g.inst.flags.gate1,id:e.id}; });
      ok(r.before===1&&r.after===0,id+': gate guard stranded behind the gate is pulled to the player side ('+r.before+' -> '+r.after+')');
      ok(/^Next: destroy the gate guard/.test(r.obj),id+': HUD names the next step: "'+r.obj+'"');
      const g1=await ev(id=>{ const g=window.__game; const e=g.enemies.find(x=>x.id===id); g.killEnemy(e); g.update(0.05); return {gate:g.inst.flags.gate1,obj:g.objective()?.text}; },r.id);
      ok(g1.gate&&/go through the open gate/.test(g1.obj),id+': killing it opens the gate and the arrow points at it ("'+g1.obj+'")');
      // watchdog: lock elite left idle and nothing happens -> pulled at PROG.pullS, door forced at PROG.forceS
      const w=await ev(async()=>{ const g=window.__game; const P=await import('/src/progress.ts'); g.progCfg={pullS:3,forceS:6,scanS:1}; const L=g.level; const st=P.stages(L); let t=-1; for(let i=0;i<st.length;i++) if(st[i]===1&&!L.solid[i]&&!L.solid[i+1]&&!L.solid[i-1]){ t=i; break; } g.px=(t%L.w)+.5; g.py=((t/L.w)|0)+.5; g.dbg.god=true;
        const le=g.enemies.filter(e=>!e.dead&&e.type===g.dd.lockElite); for(const e of g.enemies) if(!e.dead&&e.type!==g.dd.lockElite&&!window.__wvBoss?.(e)) e.dead=true; const d0=le.length?Math.hypot(le[0].x-g.px,le[0].y-g.py):0; g.progT=0;
        for(let i=0;i<80;i++) g.update(0.05); const d1=le.length?Math.hypot(le[0].x-g.px,le[0].y-g.py):0; for(const e of le){ e.hp=1e9; e.maxHp=1e9; } for(let i=0;i<100;i++){ g.update(0.05); } g.progCfg=null; return {d0,d1,lock:g.inst.flags.lock2,n:le.length}; });
      ok(w.n===0||w.d1<w.d0||w.d1<12,id+': stall watchdog pulls the lock elite to the player ('+w.d0.toFixed(1)+' -> '+w.d1.toFixed(1)+')');
      ok(w.lock,id+': stall watchdog force-opens the lock after the timeout');
    }
    // Unstuck from Settings
    await start('warehouse',7); const u=await ev(()=>{ const g=window.__game; for(const e of g.enemies) if(e.type===g.dd.gateGuard) e.dead=true; g.inst.flags.gate1=false; for(const d of g.level.doors) if(d.id==='gate1') for(const [x,y] of d.tiles) g.level.solid[y*g.level.w+x]=1; const fu=g.update.bind(g); const m=g.unstuck(); return {m,gate:g.inst.flags.gate1}; });
    ok(u.gate,'Unstuck opens the next gate when nothing is left to fight ("'+u.m+'")');
    // bot run-through (tools/balance/harness.mjs): the bot must never get stuck. Fast: the three balance-stuck cases; --full: every dungeon x 2 seeds.
    { const { runJob }=await import('../tools/balance/harness.mjs'); const D=await ev(async()=>(await import('/src/content/dungeons.ts')).DUNGEON_LIST.map(d=>[d.id,d.tier||0]));
      const kitOf=t=>['mid','mid','blue','purple','purple'][t]||'mid', lvOf=t=>[15,18,26,35,44][t]||18;
      const jobs=full?D.flatMap(([id,t])=>[4000,4053].map(seed=>({id,t,seed}))):[{id:'annex',t:0,seed:4053},{id:'foundry',t:0,seed:4106},{id:'coke_ovens',t:1,seed:4000}];
      const stuck=[]; for(const j of jobs){ const f=await launch({query:'?splash=hold'}); try{ const r=await f.page.evaluate(runJob,{mode:'level',id:j.id,kit:j.id==='foundry'?'blue':kitOf(j.t),level:j.id==='foundry'?24:lvOf(j.t),seed:j.seed,maxT:1100,maxDeaths:4}); if(r.stuck||r.error) stuck.push(j.id+'@'+j.seed+(r.stuckAt?' at '+r.stuckAt.pos+' ('+r.stuckAt.obj?.text+')':'')+(r.error?' '+r.error:'')); } finally{ await f.browser.close(); } }
      ok(!stuck.length,'bot run-through never stuck ('+jobs.length+' runs) '+stuck.join(' | ')); }
    ok(!errors.length,'no page errors '+errors.slice(0,2).join(' | '));
    await browser.close(); }
}
console.log(fails?fails+' FAILED':'ALL PASS'); process.exit(fails?1:0);
