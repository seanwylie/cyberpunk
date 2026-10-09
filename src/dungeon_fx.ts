// Registers telegraph geometry for dungeon-pack attacks with the renderer WITHOUT editing render.ts.
// Zone-pattern attacks (slagpool, gasvent, ringpools, sawlanes, cratefall) are telegraphed by the zones themselves.
import { ATKD } from './render';
import { ATK } from './sim';
const geo:Record<string,any>={ bite:{shape:'cone',r:1.3,arc:Math.PI*.5}, chainsweep:{shape:'cone',r:4.6,arc:Math.PI*.95}, riposte:{shape:'cone',r:2.4,arc:Math.PI*.7}, slagshot:{shape:'aim',r:10,arc:0}, dart:{shape:'aim',r:10,arc:0}, scalpelfan:{shape:'fan',r:12,arc:0}, blink:{shape:'circle',r:1.4,arc:0} };
for(const k of Object.keys(geo)) (ATKD as any)[k]={ ...geo[k], w:ATK[k].w, wid:geo[k].w };
