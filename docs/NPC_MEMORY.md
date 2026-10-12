# NPCs that remember you

Key NPCs keep a per-character memory of what you did to them, and that memory changes how they talk to you, what they charge you, how hard they are to talk to, and which jobs they give you.

**AI writes words only.** Every mechanical effect comes from bounded, tested rules in `src/npcmem.ts` and `src/speechrules.ts`. The model only:
- classifies a typed line into a bounded intent, and
- writes the NPC reply.

## Who remembers (`NPCS` in `src/npcmem.ts`)
| id | who | role |
|---|---|---|
| `odalys_vane` | Odalys Vane | fixer |
| contacts from `src/content/npcs.ts` | Marr, Cole, Ten Hallowell, Noor Abiodun, ... | handler / trader / technician; faction fixers are `boss` |
| `vendor_rustline`, `vendor_harrow` | Pike, Greaves | vendor |
| `guard_HI`, `guard_PS`, `guard_MM` | faction floor crews | guard (crew of their faction boss) |

To add an NPC, add it to `NPCS` and run `npm run catalog`. That regenerates `server/npc_catalog.json`, the list of ids the server accepts.

## The log (`save.npcmem`, per character)
`{ v:1, log:[{ k, npc, at, key?, hum, tr }], met:{npc:ts}, refs:{} }`

Each entry also records your humanity and level 10 trait at that moment, so an NPC can notice "more chrome than last time". The log is capped at 240 entries in total and 40 per NPC, newest kept. Unknown NPCs and kinds are dropped.

Memory kinds and their goodwill weights (`MEM_CFG.w`):

| kind | weight | recorded when |
|---|---|---|
| `talked_down` | +1 | persuade succeeds |
| `bribed` | +1 | bribe succeeds |
| `intimidated` | -2 | intimidate succeeds |
| `deceived` | -1 | bluff succeeds |
| `empathized` | +2 | empathize succeeds |
| `speech_failed` | -1 | any talk fails |
| `betrayed` | -8 | hook for quest/faction systems; also told to the guard's faction boss |
| `scammed` | -5 | hook for vendor systems |
| `helped` | +3 | personal contract finished |
| `contract_done` | +2 | any contract claimed |
| `cleared` | +1 | dungeon clear (to Odalys and the dungeon's fixer) |
| `killed_crew` | -3 | dungeon clear (to that faction's guards) |
| `gift` | +2 | **Gift** in the Talk window (costs `40 + 8×level` credits, once per NPC per day) |
| `witnessed_death` | 0 | you went down in a dungeon (its fixer hears, once per run); referenced in lines |
| `failed_job` | -2 | you dropped a personal contract (its giver remembers the place) |

Dungeon speech nodes (`src/altsim.ts`) also feed the dungeon faction's crew (`guard_HI/PS/MM`): success → talked_down / bribed / intimidated, failure → speech_failed.

Memories fade with a 21-day half-life.

## Rules (bounded, tested in `tests/npc_memory.mjs`)
- **Standing**: the decayed sum of weights, clamped to ±20.
- **Trust**: trusted (≥8), friendly (≥3), neutral, wary (≤-3), hostile (≤-8).
- **Prices**: `priceMul = clamp(1 - standing*0.01, 0.90, 1.15)`. This multiplies the vendor buy price after rep discounts. A successful **Haggle** at the vendor (once a day) takes another 8% off that day.
- **Hostility**: hostile guards lower all talk odds by 12%. Fighting always stays available, so this never blocks anything.
- **Quest access**: hostile contacts offer no personal jobs. Trusted contacts add the **Premium** modifier (+25% credits).
- **Speech history** (`memSpeechMod`, clamped to ±0.15): scared NPCs stay easier to intimidate, a repeated lie works less well, past empathy helps persuasion, and betrayal hurts it.

## References
`memLine(save, npc)` returns a deterministic canned line for the NPC's most salient memory, weighted by kind and fade. When humanity has dropped 20 or more since that memory, it appends a line noticing your chrome. With no memories, it gives a first-meeting line or a humanity remark.

These lines show up in the job board (Odalys), the Talk window and haggling.

The AI path only receives `memFacts()`: trust, up to 6 memory kinds, humanity band and trait id. All of these are enums.

## Speech encounters (`src/npcui.ts`, `openSpeech(ui, npc, situation, {resist, tier, onDone})`)
- **Say it your way**: you type a line of at most 140 characters. It goes to `POST /api/story-beat` with `kind:"npc_intent"`.
- **Or pick a line**: five choices (Persuade, Intimidate, Bribe, Bluff, Empathize), each showing its odds and any credit cost. These are always available and use strength 1.
- **Outcome**: decided by `speechrules.resolve()`:
  - `chance = base[intent] + 0.07*strength + 0.07*tier + humanity term + trait bonus (≤0.10) + memory mod (±0.15) - 0.09*resist - 0.12 if hostile`, clamped to [0.05, 0.92].
  - Humanity term: persuade `(h-50)/250`, empathize `(h-50)/200`, intimidate `(50-h)/220`, deceive `(h-50)/600`.
  - Free-text strength is capped at `tier + 1`, so clever wording can't outscale your build.
  - A bribe costs credits by formula and can't succeed without them.
  - Failure is remembered and always leads to a fight or walking away, never a lock.
- **Where it's used today**: the Haggle button at the vendor, and Talk with Odalys on the job board. Dungeon nodes from the hacking/speech/humanity work (`wv-hack`, `src/altplay.ts`, not yet on main) should call `openSpeech()` with their own `tier` and `resist`, then apply their payoff in `onDone`.
- **Humanity**: `npcmem.humanityOf()` uses `altplay.humanityOfSave()` (the same number as the humanity gauge); `save.humanity` overrides it in tests.

## Server (`server/npc_speech.mjs`, through the story Lambda)
- **Request**: `{kind:'npc_intent', session, player, npc, role, situation, trust, band, mem[], text}`. Every field except `text` is an enum checked against `server/npc_catalog.json`.
- **Moderation**, always on and run before any model call:
  - length 2–140 characters (`STORY_SPEECH_MAX_CHARS`, at most 280)
  - control characters stripped; spam and repeated characters rejected
  - house-rule banned terms, sexual content, slurs, self-harm, links and markup are blocked, and the client shows "Keep it in the world."
  - optional provider moderation with `STORY_MODERATION=openai` (fails open to the local filter)
- **Prompt injection**: patterns like "ignore previous…" or "strength: 3" get the canned classifier with strength 0 and no model call. The player line is passed as JSON data.
- **Model**: `response_format: json_schema` with `strict:true` and the shape `{intent: enum, strength: 0|1|2|3, reply_ok, reply_fail}`. Extra keys, out-of-enum values or non-integers reject the whole reply and fall back to the canned keyword classifier. A bad reply text is replaced by a canned reply and the intent is kept.
- **Abuse limits**, using the story_limits store (DynamoDB in the Lambda):
  - 3 s cooldown per player (`STORY_SPEECH_COOLDOWN_SEC`)
  - 6 per minute
  - 80 per player per day (`STORY_SPEECH_PER_DAY`)
  - 240 per IP per day (`STORY_SPEECH_IP_PER_DAY`)
  - plus the shared global breaker (`STORY_GLOBAL_PER_DAY`)
  - Over a cap, you get the canned classifier, so there's no spend.
- **Response**: `{ok, src:'ai'|'canned', intent, strength, replies:{ok,fail}}`. It never includes an outcome. The client validates it again with `validIntent()` and clamps the strength.
