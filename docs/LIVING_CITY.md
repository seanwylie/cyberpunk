# Living city

The Basin reacts to what players do across the whole server. Factions win and lose districts, tension rises and falls, prices and guards
follow, bounties appear, and a weekly street-news feed retells what really happened. **Rules decide every effect. AI writes words only.**

## Pieces

| Piece | File | Notes |
|---|---|---|
| Rules (pure, shared) | `src/city.ts` | factions, influence, flip rule, tension, effects, world events, wire format |
| Hub aggregation | `server/city_srv.ts`, `server/hub.ts` | validated events only, persistence, shard diffs, `/city/news`, `/city/state` |
| Persistence | `server/ddb_lite.ts` | DynamoDB GetItem/PutItem via the task role (no SDK in the image) |
| News writer | `server/city_news.mjs` | facts → AI or canned lines → validator. Shared by the hub, the Lambda, the client |
| News Lambda | `infra/lambda/city-news.mjs`, `infra/lib/city-stack.ts` | weekly EventBridge (Mon 06:00 UTC), writes `news#latest` |
| Client | `src/cityclient.ts` (eager, small), `src/cityui.ts` (lazy) | offline sim, server mirror, effects, banner, news panel, chatter |

## Model

- 11 districts (the towns in `src/world.ts`), 6 factions: Rustline Compact, Kestrel Value, Harrow-Brandt, Aldane Surgical, Quiet Shift, Recall Authority.
- Each district has an influence share per faction (sums to 100, floor 2), a controller, `since` (when it took over) and tension 0–100.
- Every district starts held by its home faction (55%), with tension 20.

### Events

| Event | Source | Effect (×count×weight) |
|---|---|---|
| `clear` | party boss kill accepted by the hub (weight 1); solo claim (0.3) | holder of the dungeon's mobs −1, to the strongest challenger; tension +1 |
| `gateway` | same, gateway dungeons | −2, tension +2 |
| `kill` | hub kill count per room (1); solo claim, max 80 (0.3) | −0.02 each, tension +0.01 |
| `hack` | client claim (0.5) | −0.6, tension +0.6 |
| `speech` | client claim (0.5) | success: that faction +0.5, tension −0.3. Failure: tension +0.3 only |

The faction is the dungeon's `faction` (or its manufacturer). The district is the town whose gate hosts the dungeon.

### Flip rule

The strongest challenger takes the district when it leads the holder by **8** points **and** the holder has held it for **6 h**.
A flip sets tension to at least 70 and is logged for the news. Influence moves at most **12 points per district per hour**, so even max
pressure needs about 3 hours to flip a district. Tension relaxes 4 per hour toward 20. All tunables live in `CITY` in `src/city.ts`.

### Anti-spoof

- Party clears and kills are **pivotal events the hub arbitrates** (first valid boss-kill claim, room kill set). Clients never claim them; a `clear` claim from inside a party room is refused.
- Client claims (`cev`): need a prior `run` claim for a real dungeon. 4 per minute, 80 per day per player, 12 hacks and 8 talks per run. A solo clear needs 90 s since the run started, 150 s since the last clear, and one per run. Kills are clamped to 80. Low weights (0.3 to 0.5).
- Unknown districts, factions or kinds are ignored. A bad faction name falls back to the dungeon's.
- The hourly cap bounds any botnet: 300 spoofing clients in an hour move at most 12 points (tested).

## Effects (rules only)

`effectsFor(state, district)`:

- **Prices:** list price at tension ≤ 30, up to +25% at 100. A lockdown adds +10%, a night market −10%. Bounded 0.8 to 1.35. Applies to vendor buy prices (`UI.BUY()`).
- **Guards:** corp holder 2, street 1, plus tension/25, plus 2 during a lockdown, max 8. Generated towns add plaza guards above the calm baseline.
- **Decoration:** if someone other than the home faction holds a generated town, its neon signs switch to the holder's signs and colour. A town banner shows the holder and any event.
- **Bounties:** tension ≥ 55 posts bounties on that district's dungeons run by the holder. Clearing one pays once a day.
- **World events:** tension ≥ 80 brings a lockdown (corp holder, e.g. "Kestrel lockdown in Neon Mile") or a turf war (street holder). Every Friday to Sunday, one district (picked by week) gets "… lockdown this weekend" or "Night market … this weekend".

Hand-built Rustline and Harrow get prices, bounties, events and the banner, but not signage or guard props.

## Sync (low bandwidth, never blocks)

- Wire: `[ctrl, tension, inf×6]` ints per district. A full snapshot is about 250 bytes, a one-district diff about 80 bytes.
- `town_join` carries the client's city version, so the full snapshot is sent only when it differs.
- Diffs go to town shard members at most every 30 s, and only when something changed. Nothing is sent inside dungeons.
- Persistence is async and best-effort, once a minute when dirty. A store outage keeps the hub running and retries.

## News and chatter

- `buildFacts()` is the only input the writer sees: flips, the top districts by activity (real counts), hot districts and up to 3 opted-in players.
- The AI returns JSON lines that cite fact ids. `validateItem()` rejects a line that mentions any town, faction, player or number not in its cited facts, any unknown capitalised name mid-sentence, a takeover verb without a flip fact, banned terms (see tests/no_drug_refs.mjs), links or markup. Too few valid lines fall back to the canned writer.
- Caps: one Lambda run a week, reserved concurrency 1, 700 tokens, 15 s timeout, `CITY_AI=0` kill switch. With no key or on any error, the feed is canned.
- The hub serves `GET /city/news`, cached for 5 minutes. Until the Lambda writes a feed, it serves a canned one built from this week's data.
- **Feature flags:** `VITE_WV_CITY_NEWS=0` / `VITE_WV_CITY_CHATTER=0` at build time, or `localStorage wv_ff_city_news|chatter = 0|1`. `src/cityui.ts` is lazy-loaded 2.5 s after start. The feed is fetched only when the panel opens or the first bark needs it. Chatter is one timer, about every 30 s, in town only.
- **Privacy:** Settings › Name me in city news is off by default. Only opted-in players are stored with a name. Opting out deletes the name from this and last week.

## Offline / single player

With no server, `src/cityclient.ts` runs the same rules locally (`localStorage wv_city`). Your clears, hacks and talks apply directly, and the rest
of the city drifts with two deterministic ambient events per elapsed hour (up to 72 h). News is written locally by the canned writer from
those numbers. When a server snapshot arrives, the server is the truth. When the connection drops, it falls back to the local sim.

## Tests

`tests/city.mjs` (rules, flips, decay, effects, wire size, offline), `tests/city_server.mjs` (arbitrated clears, anti-spoof, privacy,
diffs, persistence, endpoints), `tests/city_news.mjs` (facts from real data, no invented facts, fallbacks, Lambda + CDK),
`tests/city_ui.mjs` (effects in town, news panel, chatter, flags off), `tests/ui_overflow.mjs` (news panel), `infra` `npm test`.
Other browser tests run with the city neutral (`wv_city_neutral`, set by `tests/lib.mjs` unless `city: true`).

## Deploy

```
cd infra && npm ci && npm test
npx cdk deploy WvCity --exclusively      # table + news Lambda + weekly schedule
npx cdk deploy WvServer --exclusively    # WV_CITY_TABLE env + table grant on the hub task role
cd .. && ./update.sh server               # new hub image (city aggregation) + ECS redeploy; active parties drop
./update.sh client                       # banner, news panel, chatter, effects
aws lambda invoke --function-name <NewsFnName output> /dev/stdout   # optional: write the first feed now
```

The news Lambda reuses the `wv/openai-api-key` secret from WvStory. Without it, the feed is canned.
