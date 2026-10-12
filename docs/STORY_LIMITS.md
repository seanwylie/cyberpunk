# Story endpoint limits (AI spend protection)

The AI story line (Fixer quotes + **Regenerate**) costs OpenAI credits, and the Function URL is public. All limits are enforced
**server-side** in the WvStory Lambda (`server/story_limits.mjs`, wired in `server/story_beat.mjs`). The client button state is only a convenience.

## Defaults

| Limit | Default | Lambda env | CDK context (`-c`) |
|---|---|---|---|
| Regenerate cooldown per player | 60 s | `STORY_REGEN_COOLDOWN_SEC` | `storyRegenCooldownSec` |
| Regenerates per player per UTC day | 5 | `STORY_REGEN_PER_DAY` | `storyRegenPerDay` |
| Total generations per player per UTC day (beats + regenerates) | 20 | `STORY_GEN_PER_DAY` | `storyGenPerDay` |
| Generations per source IP per UTC day (fallback against spoofed ids) | 60 | `STORY_IP_PER_DAY` | `storyIpPerDay` |
| Global daily circuit breaker (all players) | 2000 | `STORY_GLOBAL_PER_DAY` | `storyGlobalPerDay` |
| Max completion tokens per call (hard ceiling 800) | 400 | `STORY_MAX_TOKENS` | `storyMaxTokens` |
| Lambda reserved concurrency | 3 | n/a | `storyConcurrency` |
| CloudWatch alarm: invocations per hour | 300 | n/a | `storyAlarmPerHour` |

Example: `npm run deploy-story -- -c storyGenPerDay=30 -c storyGlobalPerDay=5000` (from `infra/`). CDK also reads `WV_<KEY>` env vars (e.g. `WV_STORYGENPERDAY`).
The alarm emails `alertEmail` (context) through SNS if that is set; otherwise it only shows in CloudWatch.

## Identity
* **Player**: a random 24-hex id kept in `localStorage` (`wv_story_pid`) and sent as `player`. The game has no accounts, so it's the best stable id available. It can be reset by clearing storage, which is why the per-IP cap also applies.
* **IP**: `requestContext.http.sourceIp` from the Function URL.
* A "Regenerate" is any request with `variant > 0`.

## Storage
DynamoDB table `StoryLimits` (on-demand, partition key `pk`, TTL attribute `exp`). Keys: `cd#<player>` (cooldown), `rg#<day>#<player>`, `pl#<day>#<player>`,
`ip#<day>#<ip>`, `gl#<day>`. Counters use conditional `UpdateItem ADD`, so concurrent Lambdas can't overshoot. If DynamoDB fails, the limiter **fails closed** (canned line).
Cached repeats (same session + loadout + variant) are free and don't count.

## Responses
* `429 {ok:false, reason:"rate_limited", retryAfter:<s>}`: Regenerate cooldown. The button shows `Regenerate (N s)`.
* `429 {ok:false, reason:"daily_cap", retryAfter:<s until 00:00 UTC>, scope:"regen"|"player"|"ip"}`: The button shows **No more rewrites today**.
* `200 {ok:false, reason:"budget", canned:true}`: The global breaker tripped. The client quietly uses an authored line.
The older in-memory per-instance burst limits (`rate_limited_ip`, `rate_limited_session`) still apply on top.

## Tests
`node tests/story_limits.mjs` (limiter + mocked DynamoDB + service wiring), `node tests/story_regen_ui.mjs` (button cooldown/cap UI, needs the dev server), `cd infra && npm test`.
