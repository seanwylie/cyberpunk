# Multiplayer (Phase 2): party play on the real combat code + shared town presence

Status: working prototype (protocol v2, client-authoritative), off by default. Solo/offline play is unchanged and works with no server.
Context: `docs/UNIVERSE.md` section 8 (MMO roadmap): "a persistent shared hub world plus private instanced 4+1 dungeons", near-zero cost at zero players. This is roadmap phase 1 (networking spike) plus a small slice of phase 4 (parties/invites).

## 1. Architecture decision (protocol v2: client-authoritative)

**Why:** v1 ran an authoritative 20 Hz server sim and made every client wait for it (prediction + reconciliation). Over real internet RTTs that felt laggy, and it needed a big server per party. v2 inverts it: each client runs the whole dungeon locally with the normal single-player `Game` code, and the server only relays low-rate display state and arbitrates the few events that must be shared.

| Question | Decision | Why |
|---|---|---|
| Authority | **Each client simulates its own dungeon** (movement, combat, enemy AI, abilities, loot rolls). The server is a relay + referee for pivotal events | Input is never delayed by the network; the server is a tiny relay, not a sim |
| Transport | WebSocket (`ws`), JSON, one Node process, **protocol version 2** (`PROTO` in `src/net/shared.ts`) | Works from a static web build and phones |
| Teammate display | Clients send `st` (x, y, facing, hp, down, moving, attacking) at **8 Hz**, only when changed (1 s heartbeat). The server relays only changed players in one `ps` message per room at 8 Hz. Clients interpolate teammates ~170 ms behind | ~1 KB/s per player, display only, never blocks input |
| Shared world | Deterministic: the server picks `seed`, every client builds the same level and the same enemy list (enemy id = spawn index). Doors/locks/objectives are shared **flags** | Everyone gets the same map and enemies |
| Enemies | **Each client simulates its own copy** (hybrid "local sim + relayed damage + first-claim kills"). Damage a player deals is batched (125 ms) and relayed so teammates' copies of that enemy lose the same HP; a kill is a **claim** the server dedupes, then everyone gets `ekill` | See tradeoff below |
| Pivotal (synchronous, server arbitrated) | party create/join/leave/ready/kick, dungeon start (seed), enemy and boss **kill claims**, objective flags, instance complete (boss kill), revive, wipe | Everything that must agree |
| Identity | Anonymous guest id + secret token, display name; saves stay local | Accounts are a later phase |
| Party | Invite / Join party from a town player's menu (accept prompt), invite link as backup, code tucked away; max 4, leader, kick | No codes or server details in the main flow |
| Scaling | Enemy HP x(1+0.65 per extra player) applied on each client to its own enemies; damage x(1+0.20) | HP pool is effectively shared because damage is relayed |

### Enemy approach and tradeoff
Options considered: (A) party leader/host simulates all enemies and broadcasts them; (B) every client simulates enemies locally, kills reported as events, boss dedup by server; (C) full server sim (v1).
**Chosen: B plus relayed damage.** (A) needs the host to stream every enemy at 10 Hz (heavy), makes non-hosts hit "ghost" enemies with lag, and a host disconnect loses the world. (B) needs only damage batches and claims (a few small messages per second), makes every hit feel instant, and has no host.
Tradeoffs we accept: enemy positions/aggro differ slightly between clients (each enemy chases the local player; teammates see their own copy), so two players can fight "different copies" of the same mob. Relayed damage keeps HP aligned, the first valid kill claim wins and removes the mob everywhere. Summons and boss adds are local-only (no network, no shared rewards). A kill appears instantly on the claimant's screen; the loot/XP for it arrives with the server's `ekill` confirmation (one round trip), so a rejected or duplicate claim never pays out twice.

### Rewards are INDIVIDUAL (unchanged rule)
Rewards are rolled **locally by each participant from their own save, RNG and pity timers** when the server confirms a kill (`ekill`): XP, reputation, contract credit, instanced loot, signature drops, ability-acquisition pity and cosmetics are per-player, never shared or split. A player participates if they damaged the enemy or were within 20 tiles when it died (boss: damaged it or inside the boss room); non-participants get nothing from that kill. The boss clear XP is granted once per participant. Loot lives on your own ground (never in another player's instance state) and is banked into your save when you leave. Party runs never consume the solo daily lockout, break gear, add a repair bill or touch a solo instance.

### Cheating limits (no per-tick sim, so cheap checks)
- **Movement:** distance budget refilled at `3 x playerSpeed` with a 16-tile burst. Larger jumps are dropped (not relayed) unless they land on the entrance/a checkpoint (respawns); 25 violations remove the player from the room.
- **Damage:** per-player damage-rate budget (`400 + 60 x level` per second, 3x burst); excess is clipped from relays. Boss damage only after the boss was revealed.
- **Kills:** only valid enemy ids (1..N or 0 = boss), first claim wins, duplicates ignored, claimant must be within 70 tiles of the enemy's home, boss only after `bossSpawned`, token bucket 8/s burst 30. Total payable kills per dungeon are bounded by the enemy count, the boss pays once.
- **Flags:** whitelist (`gate1, lock2, controller, armory, passageSeen, cond, bossKey, bossSpawned, alarm, salvageForeman`), set-once, strict value types. `bossDead` can only come from an accepted boss claim.
- **Revive:** reviver alive, target down, within 6 tiles (relayed positions + latency slack), 1 s cooldown. **Wipe:** server announces it when everyone has been down for 3 s.
- **Transport:** 8 KB payloads, per-socket token buckets (state 14/s, all messages, chat, pings), persistent abuse closes the socket, sanitised names/chat/look.
- **Version gate:** the hello must carry `proto: 2`. Anything else gets `err {code:'version', msg:'... Refresh the page (Ctrl+F5) ...'}` and the socket is closed (4001) before any session exists. The client also checks the server's `welcome.proto`, shows the refresh message and does not auto-reconnect.
- **Limits that remain:** a hacked client can still lie about its own state inside these bounds (e.g. claim kills of enemies it never fought, up to the enemy count and rate caps) and its local save is trusted; real anti-cheat needs accounts and a server ledger (later phase).

## 1b. Local combat core
There is no second combat model: a party dungeon is the same `Game` as solo (`src/sim.ts`) running on a net-owned instance (`id: net-<seed>`, not stored in the save) built from the shared seed. `src/net/session.ts` wraps a few Game methods only while in a party dungeon: `hurtEnemy` (relay damage), `grantKill` (claim, rewards deferred until `ekill`), `grantClear` (no daily lockout), `playerDown` (no solo penalties), `returnToCheckpoint` (wait for revive/wipe), `leaveInstance`/`townReturn`/`abandonInstance` (soft exit that banks your loot), `hpMul` (party HP scaling). They are restored on exit. `Game.netHook` always returns false (the game update is never replaced).
`src/core/party.ts` (`PartyWorld`, the v1 authoritative sim) and `tests/net_core.mjs` remain as the deterministic reference/regression core for the combat code; the hub no longer imports it.

## 2. Code map
- `src/net/shared.ts` protocol version (`PROTO = 2`), rates, shared flag whitelist, movement helpers, scaling, sanitising. `src/net/client.ts` `NetClient` (connection, guest identity, party API, version handling) + `InstanceClient` (local state report at 8 Hz, damage batching, claims, teammate interpolation; no prediction/reconciliation any more). `src/net/session.ts` bridges a party dungeon into the real `Game`/`Renderer` (see 1b). `interp.ts` interpolation. `remote_render.ts` remote players (real sprite, body variants, cosmetics), name plates, ping markers. `party_ui.ts` + `index.ts` Party button, panel, chat overlay, bootstrap.
- `server/hub.ts` (guests, parties, town shards, **light rooms**, chat, pings, rate limits, version gate), `server/main.ts`, `server/Dockerfile`, `docker-compose.yml`, `infra/` (AWS CDK), `infra/ci/deploy.yml.template`.
- Legacy v1 reference core (not used by the hub): `src/core/party.ts`, `src/core/profile.ts`, `src/core/testkit.ts`.
- Shared-file edits are tiny: `Game.netHook` (+1 call at top of `Game.update`; it now always returns false), one `netItems` call in `Renderer`, `initNet` in `main.ts`.

## 2b. Zero-config grouping (no server details, no accounts)
- **Connection:** production builds carry the server URL (`VITE_WV_SERVER`, set by `update.sh` to `wss://game.seanwylie.ca`). There is no URL field. The client connects quietly once the player is in town (only when a URL was baked in or passed with `?server=`), or when Party is opened, a town player is clicked, or an invite link is followed. `?server=` is a dev/test override (remembered only on dev hosts); dev hosts with nothing configured use `ws://<host>:8787` when Party is opened. Unreachable server: solo play continues, the Party button tooltip reads "Party: offline", the panel says so with Retry, and one short toast appears only if the player asked for multiplayer.
- **Invite from town:** click/tap another player -> small menu: Invite, Join party, Inspect. The other player gets an Accept/Decline prompt (expires after 30 s client-side, 60 s server-side). Invite creates the inviter's party on demand; a Join request, once accepted, puts the asker into the accepter's party. Invite links still work (Party panel > Invite link); a code field sits under "Have a code?".
- **Ready check:** the world entrance is the picker. When the leader of a 2+ party steps into a gateway, the server opens a 15 s ready check (`party_go`); every member sees the dungeon name, a countdown and who is ready. When everyone has answered, or time runs out, the ready members go in together; anyone who declined or timed out stays in town, still in the party. Non-leaders entering a gateway play solo as before (never stuck).
- **Drop-in:** a party member in town gets **Join run** in the Party panel (or steps into the same gateway). The server adds them to the room and sends the normal `instance_start` with the seed, killed set and flags; they spawn at the entrance. Joining a party whose run is in progress is allowed. **Scaling choice (simple):** party HP/damage scaling is fixed at the run's start size; a late joiner does not rescale enemies already alive. Documented tradeoff: a 2-player run that becomes 3 is slightly easier.
- Protocol additions (still `PROTO = 2`, additive): `invite {to, kind}`, `invite_reply {from, ok}`, `party_go {dungeon}`, `rcheck {ok}`, `drop_in`; server -> client `invite {from, name, lvl, kind}`; `party` state gains `check {dungeon, ms, yes, no}` and `members[].inRun`. `party_dungeon` / `party_start` / `party_ready` remain for old tests but the UI no longer uses them.

### Later phase: town shards with population caps (design only)
Named town instances (e.g. "Rustline 1", "Rustline 2") each capped (`TOWN_SHARD_CAP`, tuned to the render/perf budget for visible players). A player joins the fullest shard below the cap; when all are full a new shard opens (overflow). Party members are routed to their leader's shard (reserved seats so a party is never split; a member arriving at a full shard still gets in up to cap + party size). Shard name shows in the Party header; empty shards close after a minute. Cross-task shards need the room-ownership registry in section 8 step 3.

## 3. Running
```
npm run server        # ws://localhost:8787  (PORT=, WV_HOST=; WV_DEV=1 enables test-only teleports (tp flag), never in production)
npm run dev           # game
# http://localhost:5173/ -> Party button connects to ws://localhost:8787; open a second window and click the other player in town -> Invite
```
The Party button shows on dev/LAN hosts, and in production builds only when a server URL is configured (`?server=` is remembered in `localStorage.wv_server`, or build-time `VITE_WV_SERVER`). A static build without a URL has no multiplayer UI and opens no socket. Nothing connects until the player presses Connect or follows an invite link; failure leaves the game in solo mode.

## 4. Protocol (JSON, `proto: 2`)
Handshake: client `hello {proto:2, guest?, token?, name, lvl, look}`; server `welcome {proto:2, id, token, stateHz}` or, on a version mismatch, `err {code:'version', server, client, msg}` followed by close code 4001. The client shows `msg` ("Refresh the page (Ctrl+F5)...") and does not retry.
Client to server: `ping`, `profile`, `party_create|join|leave|kick|ready|dungeon|start`, `leave_instance`, `chat`, `mark`, `town_join|town_pos|town_leave`, and in a dungeon:
- `st {x,y,f,hp,mh,dn,mv,at}` display state, <= 8/s (`tp:1` only honoured by a dev server) 
- `dmg {d:[[enemyId,amount]...]}` damage dealt, batched at 125 ms (id 0 = boss)
- `kill {id}` kill claim (id 0 = boss); `flag {k,v}` objective flag; `revive {id}`
Server to client: `welcome`, `pong`, `party`, `instance_start {dungeon, seed, you, hpMul, dmgMul, roster, nSpawns, flags, killed, resume}`, `ps {n, p:[{id,x,y,f,hp,mh,dn,mv,at}]}` (8 Hz, changed players only), `edmg {from,d}`, `ekill {id,by,k}`, `flag {k,v,by}`, `revived {id,by}`, `wipe`, `instance_end`, `chat`, `mark`, `town`, `town_snap`, `town_correct`, `err`, `sys`. The layout and the enemy list are not sent: both sides build `dungeonOf(id).build(seed)` (deterministic; enemy id = spawn index + 1).
Removed in v2: `input`, `snap`, `loot`, `build`, `pickup`, `dev_*`.

## 5. Security model
See "Cheating limits" in section 1. In short: the server cannot verify gameplay, so it bounds what a client can claim (movement budget, damage rate, valid-id/first-claim/rate-capped kills, whitelisted set-once flags, validated revives) and refuses outdated clients. Origin allow-list, connection/party/room caps, rate limits and drain are unchanged. Town positions are speed-gated (`town_correct`). Gaps: guest identity is bearer-token only; local saves are trusted; no shared economy exists yet.

## 6. Tests (`npm run test:net`, run one at a time)
- `tests/net_integration.mjs`: real ws server, 3 bot clients on the real client core, 150 ms RTT + jitter + 8% loss: party flow, caps, chat limits, same seed/enemy ids everywhere, local movement + 8 Hz relay, teleport/flood rejection, damage relay and clipping, kill-claim dedup/rate cap/boss dedup, flag whitelist, revive and wipe, reconnect resume, town presence.
- `tests/net_latency.mjs`: 200 ms RTT: every local input is applied in the same call (< 5 ms measured), teammates see it only after the link delay, local movement continues with the connection dropped, server load stays tiny.
- `tests/net_hardening.mjs`: origin allow-list, caps, health/metrics, **version gate** (proto 1/missing/99 refused with the refresh message), graceful drain.
- `tests/net_party_ui.mjs` (needs vite dev, `URL=...`; hub on `HUB_PORT`, default 8787): three real pages, no URL typed, invite and join request from town, ready check on the entrance, ready members enter together, a declined member stays in town and drops in later (seed, killed set, flags, entrance spawn), unreachable-server notice. Screenshots go to `SHOTS` (default /tmp).
- `tests/net_core.mjs`, `tests/net_interp.mjs`: legacy v1 combat-core regression (deterministic, per-player rewards, build validation) and interpolation.

## 7. Works / stubbed
Works: guests, parties (create/join/leave/kick/ready/leader transfer/60 s reconnect seat), invite links, 2-4 player dungeons for any dungeon in `DUNGEONS` running on the real local combat code, shared seed/layout/enemy list, relayed teammate display, shared damage and first-claim kills, shared objective flags and doors, boss dedup and instance complete, revive and wipe, individual rewards, town presence, chat, pings, origin/caps/rate limits, version gate.

Known gaps:
- Enemies are simulated per client (see tradeoff): positions and aggro can differ between players; a teammate's enemy copy only mirrors damage and death. Summons/boss adds are local-only. Enemy attacks only ever target the local player (no friendly fire between players), heal/aura abilities are self-only.
- Boss phases follow each client's own copy of the boss (HP is kept aligned by relayed damage); a player who never entered the boss room sees the boss simply die (no local fight, no clear XP).
- Without accounts the server cannot prove item ownership or truthfulness of client state.
- Late joiners drop in at the entrance (section 2b); scaling stays at the start size. Reconnect within 60 s resumes with the killed set and flags, but the local enemy HP of a rejoining client restarts.
- No 5th guest slot, no persistence (restart drops parties), no emotes/voice/friends.

## 8. Deployment plan (AWS) and cost
Decision: everything on AWS. Runbook: `docs/DEPLOY_AWS.md`. Infrastructure as code: `infra/` (AWS CDK, TypeScript). Nothing deploys itself; the CI workflow is disabled until variables are set.

### Topology
```
 browser ──https──> CloudFront ──OAC──> S3 (private bucket: Vite build)       play.<domain>   (ACM cert in us-east-1, Route 53 alias)
    │  ──wss────> ALB :443 (ACM cert, idle timeout 3600 s) ──> ECS Fargate task(s) "hub" :8787     game.<domain>   (Route 53 alias)
    │  ──https──> Lambda Function URL (story-beat proxy) ──> OpenAI                                  (key in Secrets Manager)
 CloudWatch Logs + alarms -> SNS email · AWS Budgets email · ECR (image) · SSM/Secrets Manager (config/secrets)
```
- **Client:** static files in a private S3 bucket behind CloudFront (Origin Access Control, TLS 1.2+, HTTP/3, security headers, SPA fallback). Cache rules match the service worker (`public/sw.js`, registered as `sw.js?v=<build>`): `assets/*` (content-hashed by Vite) are `immutable, 1 year`; `index.html`, `sw.js`, `manifest.webmanifest` are `no-cache` (always revalidated; a new build means a new SW cache name and old caches are deleted on activate); other art/audio is `max-age=3600` and the deploy invalidates those paths. The SW ignores cross-origin requests, so the websocket host and the story URL are unaffected.
- **Game server:** one Fargate task (ARM64, 0.25 vCPU / 0.5 GB) in public subnets (no NAT gateway, security group admits only the ALB) behind an Application Load Balancer. ALBs support WebSocket upgrades natively; idle timeout is 3600 s (the game also sends a ping every 2 s, so idle drops are not expected); health check `GET /healthz` (200, or 503 while draining); LB-cookie stickiness on; deregistration delay 60 s; container `stopTimeout` 30 s with SIGTERM -> graceful drain (healthz 503, running instances ended with a notice, then exit). Deployment circuit breaker rolls back on failed health checks.
- **Server config (env):** `WV_ORIGINS` (allowed browser Origins; set automatically to the client URL), `WV_ALLOW_NO_ORIGIN`, `WV_MAX_CONNS`, `WV_MAX_ROOMS`, `WV_MAX_PARTIES`, `WV_GRACE_MS`, `PORT`, optional `WV_STORY=1` (serve `/api/story-beat` from the hub; needs `OPENAI_API_KEY` secret). `WV_DEV` is never set in AWS.
- **Story proxy:** default is a Lambda Function URL (Node 22, ARM, reserved concurrency 5, CORS locked to the client origin, per-IP/session/daily caps from `server/story_beat.mjs`). The key is in Secrets Manager (`wv/openai-api-key`), read at cold start with least-privilege `GetSecretValue`, never in the bundle or template. The client uses it through build-time `VITE_WV_STORY_URL`. Alternative: run it inside the hub (`-c storyInService=true`), which saves a Lambda but couples story traffic to game CPU.
- **Secrets/config:** Secrets Manager for `OPENAI_API_KEY` ($0.40/secret/month). Plain config is ECS environment (not secret). If you want SSM Parameter Store (free standard tier) for the key instead, the ECS `secrets` entry accepts `ssm` SecureString too; the CDK stack uses Secrets Manager because Lambda and ECS both read it natively.
- **Observability:** 30-day CloudWatch Logs, alarms (CPU, memory, unhealthy/no healthy host, ALB 5xx) to an SNS topic with an email subscription, and an AWS Budgets monthly cost alert at 50/80/100% plus forecast. `GET /metrics` returns connection/room counters for dashboards.
- **Cheap start alternative (no ALB/ECS):** one Lightsail instance or `t4g.nano` EC2 (about US$4-7/month with its IPv4), Docker + Caddy for automatic TLS on `game.<domain>`, `docker compose up -d` from `docker-compose.yml`, Route 53 A record. Same container, same env vars; no autoscaling or managed rollbacks. Move to the CDK stack when you want managed deploys and alarms.

### Cost estimate (us-east-1, list prices, rough)
| Item | Low usage (0-20 players) | Growth (about 500 concurrent players) |
|---|---|---|
| Fargate ARM 0.25 vCPU/0.5 GB x1 | ~US$7 | 2-3 tasks at 0.5-1 vCPU: ~US$30-60 |
| ALB (+ 2 public IPv4 + LCUs) | ~US$24 | ~US$30-40 |
| Task public IPv4 | ~US$4 per task | ~US$8-12 |
| CloudFront + S3 (client, PWA caching) | ~US$1-3 | ~US$10-40 (client bytes dominate on first visits) |
| Route 53 zone, ECR, CloudWatch, Secrets, Lambda | ~US$3-5 | ~US$8-15 |
| **Data out from the hub (ALB/EC2)** | ~US$0 | **dominant**: US$0.09/GB. With protocol v2 a 4-player party exchanges only 8 Hz deltas (about 1 KB/s per player down), roughly 0.01-0.02 GB/hour per party, so egress is negligible and one small task serves many parties |
| **Total (excluding hub egress)** | **~US$35-45/month** | **~US$100-200/month plus egress** |
The Lightsail/EC2 start is about US$5-8/month plus client hosting (~US$1-3). Budget the egress: before growth, enable `permessage-deflate` or send deltas/quantised positions (documented next step) which should cut snapshot bandwidth by about 3-5x. These are estimates, not quotes; check the AWS pricing calculator and set the budget alert first.

### Scaling plan
1. **Now: one task per region** (`maxTasks=1` by default, `minTasks=1`). Parties, rooms and town shards live in the hub's memory, so a second task would split parties (a code created on task A is unknown to task B). Autoscaling policies (CPU target 60% and ALB active-connection steps) are already in the stack but capped by `maxTasks`; raise the cap only after step 3.
2. **Per-region deployments:** add a region by deploying `WvServer` there with its own subdomain (`game-eu.<domain>`); the client picks the nearest by latency (a small list in the lobby). Party leader's region owns the instance.
3. **Room ownership layer (before `maxTasks` > 1):** a registry (ElastiCache Redis or DynamoDB with TTL) mapping party code and shard id to the owning task; the hub rejects/redirects joins for rooms it does not own, ALB routes by a `?room=` query/header via listener rules or the client reconnects directly to the owner's task address returned by the registry. Room state stays single-owner and in memory; only ownership and presence are shared.
4. **Matchmaking/MMO layer:** Redis (pub/sub + sorted sets) for cross-task presence, party invites across shards, global chat and queueing; then persistence (DynamoDB or Aurora Serverless) for accounts, ledgered rewards and lockouts (roadmap phases 2 and 5). Hubs become stateless relays + room owners.

### Before going public (all implemented unless noted)
Origin allow-list (`WV_ORIGINS`, enforced at the WebSocket upgrade, tested), room/party caps (`WV_MAX_ROOMS`, `WV_MAX_PARTIES`, tested), connection cap, `WV_DEV` unset, TLS only (ALB redirect 80 to 443, HSTS on the client), billing alert (Budgets), alarms. Still to do: optional chat profanity filter, WAF rate rules on the ALB/CloudFront if abused (about US$5-10/month), bandwidth reduction (above).

## 9. Next steps
1. Accounts and a server ledger (roadmap phase 2), host lockouts and the +1 guest. 4. Town emotes/bubbles, cross-shard invites.
