import { startHub } from './hub';
const port = +(process.env.PORT || process.env.WV_PORT || 8787);
const hub = startHub({ port, dev: process.env.WV_DEV === '1', log: true, host: process.env.WV_HOST });
await hub.ready;
console.log(`[wv-hub] Warranty Void multiplayer server listening on ws://localhost:${hub.port()}  (dev=${process.env.WV_DEV === '1'})`);
