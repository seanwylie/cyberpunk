# Multiplayer (Phase 1): party play + shared town presence

Status: working prototype, off by default. Solo/offline play is unchanged and works with no server.
Context: `docs/UNIVERSE.md` section 8 (MMO roadmap): "a persistent shared hub world plus private instanced 4+1 dungeons", near-zero cost at zero players. This is roadmap phase 1 (networking spike) plus a small slice of phase 4 (parties/invites).

## 1. Architecture decision

| Question | Decision | Why |
|---|---|---|
| Authority | Authoritative server; clients send inputs only | Anti-cheat by construction; later phases (accounts, lockouts, trading) need it |
| Transport | WebSocket (`ws`), JSON, one Node process | Works from a static web build and phones, trivial hosting. UDP/WebRTC only if profiling demands |
| Tick | Sim 20 Hz, one full snapshot per tick per player; town presence 10 Hz | Full snapshots (no deltas) make loss/reorder tolerance trivial |
| Client | Predict own movement with the same fixed-step function as the server (`stepPlayer`), reconcile by replaying unacked inputs; remotes interpolated 120 ms behind | Responsive local feel, smooth remotes |
| Sim | New small headless `InstanceSim` (`src/net/netsim.ts`) reusing the real seeded dungeon generators, enemy stats and loot tables | See below |
| Identity | Anonymous guest id + server-issued secret token, display name; saves stay local | Accounts are roadmap phase 2 |
| Party | 5-char code or invite link (`?server=..&party=CODE`), max 4, leader, ready check, kick | Spec says 4 + 1 guest; the guest slot is later |
| Loot | Instanced: each member rolls their own drops from a deterministic per-player stream; the server only sends you your own drops and only you can collect them | No stealing |
| Scaling | Enemy HP x(1+0.65 per extra player), damage x(1+0.20 per extra player), shown in the panel | Placeholders for the balance harness |

Why not run the existing `Game` on the server yet: `src/sim.ts` is a dense single-player class fused to the one local player, `localStorage`, the save object and UI toasts, and it is only tested headlessly inside a browser page. Extracting a pure multi-player core touches files other jobs are editing. Phase 1 therefore ships a parallel, deliberately small authoritative sim that reuses all the data, and leaves `Game` as the solo source of truth. Phase 2 should extract the shared combat core and delete the duplication.

## 2. Code map
- `src/net/shared.ts` protocol, constants, shared movement, scaling, sanitising. `netsim.ts` authoritative instance. `interp.ts` snapshot interpolation. `client.ts` `NetClient` + `InstanceClient` (prediction). `session.ts` bridges a party instance into the existing `Game`/`Renderer`. `remote_render.ts` remote players (real sprite, body variants, cosmetics), one name plate each, ping markers. `party_ui.ts` + `index.ts` Party button, panel, chat overlay, bootstrap.
- `server/hub.ts`, `server/main.ts`: guests, parties, town shards, instance rooms, chat, pings, rate limits.
- Shared-file edits are tiny: `Game.netHook` (+1 call at top of `Game.update`), one `netItems` call in `Renderer`, `initNet` in `main.ts`.

## 3. Running
```
npm run server        # ws://localhost:8787  (PORT=, WV_HOST=; WV_DEV=1 enables test-only teleports, never in production)
npm run dev           # game
# http://localhost:5173/?server=ws://localhost:8787 -> Party button (top-right tray) -> Create party -> send the Invite link
```
The Party button shows on dev/LAN hosts, and in production builds only when a server URL is configured (`?server=` is remembered in `localStorage.wv_server`, or build-time `VITE_WV_SERVER`). A static build without a URL has no multiplayer UI and opens no socket. Nothing connects until the player presses Connect or follows an invite link; failure leaves the game in solo mode.

## 4. Protocol (JSON, `proto: 1`)
Client to server: `hello`, `ping`, `profile`, `party_create|join|leave|kick|ready|dungeon|start`, `leave_instance`, `input{seq,mx,my,atk,face,revive}` (20 Hz), `chat`, `mark`, `town_join|town_pos|town_leave`, `pickup`.
Server to client: `welcome`, `pong`, `party`, `instance_start{dungeon,seed}`, `snap` (20 Hz), `loot`, `instance_end`, `chat`, `mark`, `town`, `town_snap`, `town_correct`, `err`, `sys`. The layout is not sent: both sides build `dungeonOf(id).build(seed)` (deterministic) and open all doors.

## 5. Security model
- Server accepts inputs only: direction clamped to unit length (NaN rejected), attack and revive flags. Speed is a server constant; damage derives from the server-known level clamped 1-50; position, HP, enemy HP, drops are server decided.
- Sequence numbers must increase; one input applied per tick; queue cap 4; per-socket token buckets (inputs 30/s, all messages, chat 1.5/s, pings 1/s); persistent abuse closes the socket; 8 KB max payload; names/chat/look sanitised.
- Town positions are speed-gated; teleports get `town_correct`. Only the owner can collect a drop; stealing attempts are denied and counted.
- Gaps: guest identity is bearer-token only; local saves are trusted by the local client (loot grants apply to an editable local save). Intended for phase 1; nothing here touches a shared economy.

## 6. Tests (`npm run test:net`, run one at a time)
- `tests/net_sim.mjs`: determinism, scaling, speed-hack clamp, replay rejection, flood bound, boss kill, instanced loot, steal denial, revive, wipe, interpolation, sanitising.
- `tests/net_integration.mjs`: real ws server, 3 bot clients on the real client core, 150 ms RTT + jitter and 8% loss of snapshots and inputs: party flow, caps, chat limits, same seed everywhere, prediction convergence, input flood, boss kill, loot instancing, state consistency, rtt, token reconnect, leader transfer, town shards, teleport rejection, offline server.
- `tests/net_party_ui.mjs` (Playwright, needs the dev server and `URL=`): Party button in tray, offline panel, connect, invite-link join, ready, scaling text, town presence, chat, two real game pages in one dungeon, remote player, movement vs server, boss kill, personal loot applied locally, soft leave without solo penalties, no page errors.

## 7. Works / stubbed
Works: guests, parties (create/join/leave/kick/ready/leader transfer/60 s reconnect seat), invite links, 2-4 player authoritative instances for any dungeon in `DUNGEONS` (real layouts, enemy stats, boss), prediction/interpolation, auto-attack combat, enemy melee/ranged and boss slam, downed + hold-F revive, wipe reset, instanced loot with local grant, party chat, map ping (G), town presence with real sprites/cosmetics, one range-faded non-overlapping plate per player, soft leave.

Stubbed / not networked yet:
- Abilities, dodge, chips/augments, heat, stims: not in the server sim; party runs are auto-attack only (damage from level). Team Revival is replaced by hold-F revive. Top phase 2 item.
- Gates/locks/hacks/conditions/hazards: doors are all open, hazards ignored; no per-boss move sets, affixes or summons. Enemy AI is simple chase.
- XP, rep, lockouts, achievements, repair bills are not granted for party runs (loot and credits are).
- No 5th guest slot, no instance resume beyond 60 s, no server persistence (restart drops parties), town chat only in protocol, no emotes/voice/friends. Look updates only on join/profile change.
- WebSocket is TCP: the loss shim proves state tolerance, real loss shows up as latency spikes.

## 8. Deployment plan and cost
- Build: `npm run server` bundles to `server/dist/server.mjs` (Node 20+, only `ws` at runtime). Container `node:20-slim`, env `PORT`.
- Host: Fly.io shared-cpu-1x 256 MB, `auto_stop_machines` with `min_machines_running = 0`, TLS for `wss://`; about US$0-3/month at low usage (a 4-player room is far below 1% CPU). Alternatives: Railway/Render hobby (~US$5), or a US$4-6 VPS with Caddy. Cloudflare Durable Objects are a good later fit but need the sim ported.
- Static client stays on static hosting; set `VITE_WV_SERVER=wss://<app>.fly.dev` at build (HTTPS pages need `wss://`).
- Before public: leave `WV_DEV` unset, add an origin allow-list, a global room cap and billing alerts (`maxConns` default 500). Scale out later by routing party code to a process.

## 9. Next steps
1. Extract the combat core from `Game` so abilities, dodge, heat and chips run on the server. 2. Gates, locks and boss mechanics networked. 3. Accounts and a server ledger (roadmap phase 2), host lockouts and the +1 guest. 4. Town emotes/bubbles, cross-shard invites.
