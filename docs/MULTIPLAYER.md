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
- `server/hub.ts`, `server/main.ts`, `server/Dockerfile`, `docker-compose.yml`, `infra/` (AWS CDK), `infra/ci/deploy.yml.template` (copy to `.github/workflows/deploy.yml`): guests, parties, town shards, instance rooms, chat, pings, rate limits.
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
- `tests/net_hardening.mjs`: origin allow-list incl. wildcard spoofing, room/party caps, `/healthz` + `/metrics`, graceful drain. `tests/net_party_ui.mjs` (Playwright, needs the dev server and `URL=`): Party button in tray, offline panel, connect, invite-link join, ready, scaling text, town presence, chat, two real game pages in one dungeon, remote player, movement vs server, boss kill, personal loot applied locally, soft leave without solo penalties, no page errors.

## 7. Works / stubbed
Works: guests, parties (create/join/leave/kick/ready/leader transfer/60 s reconnect seat), invite links, 2-4 player authoritative instances for any dungeon in `DUNGEONS` (real layouts, enemy stats, boss), prediction/interpolation, auto-attack combat, enemy melee/ranged and boss slam, downed + hold-F revive, wipe reset, instanced loot with local grant, party chat, map ping (G), town presence with real sprites/cosmetics, one range-faded non-overlapping plate per player, soft leave.

Stubbed / not networked yet:
- Abilities, dodge, chips/augments, heat, stims: not in the server sim; party runs are auto-attack only (damage from level). Team Revival is replaced by hold-F revive. Top phase 2 item.
- Gates/locks/hacks/conditions/hazards: doors are all open, hazards ignored; no per-boss move sets, affixes or summons. Enemy AI is simple chase.
- XP, rep, lockouts, achievements, repair bills are not granted for party runs (loot and credits are).
- No 5th guest slot, no instance resume beyond 60 s, no server persistence (restart drops parties), town chat only in protocol, no emotes/voice/friends. Look updates only on join/profile change.
- WebSocket is TCP: the loss shim proves state tolerance, real loss shows up as latency spikes.

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
| **Data out from the hub (ALB/EC2)** | ~US$0 | **dominant**: US$0.09/GB. A 4-player party at 20 snapshots/s of ~2-3 KB is roughly 0.5-0.9 GB/hour per party, so 125 parties is on the order of US$6-10/hour while all are active |
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
1. Extract the combat core from `Game` so abilities, dodge, heat and chips run on the server. 2. Gates, locks and boss mechanics networked. 3. Accounts and a server ledger (roadmap phase 2), host lockouts and the +1 guest. 4. Town emotes/bubbles, cross-shard invites.
