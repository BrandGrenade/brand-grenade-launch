# Strategic Objective — Real Branching

Scope confirmation before building. This is targeted prompt-injection plus a small
number of conditional branches. No new stages, no new architecture.

## 1. Split "Refresh" into two objectives

`STRATEGIC_OBJECTIVE_OPTIONS` in `src/lib/brief-schema.ts` goes from 7 to 8 entries:

- `Refresh (Packaging)` — pack/identity/design-system refresh, bounded lifecycle.
- `Refresh (Campaign)` — new campaign inside a fixed brand platform.

The radio group in the brief intake form renders from this array, so it updates
automatically. Existing sessions holding the literal value `Refresh` are treated as
`Refresh (Campaign)` by the resolver (no data migration, no rewriting of history).

## 2. Remove `strategic_mode`

Hardcoded to `"Auto"`, no UI control, injected into five stage prompts for no effect.
Clean removal:

- Drop the `strategicMode` argument from the Stage 1, 3, 4, 4B, 5, 6, 7 prompt builders
  and from the corresponding `*.functions.ts` callers.
- Drop `strategic_mode` from every `.select(...)` list and from the session insert.
- Drop it from `brief.index.tsx`, `brief.new.tsx`, `pipeline.tsx`, `dashboard.tsx`,
  `preflight-tier-two.functions.ts`.
- One migration: give `sessions.strategic_mode` a default so inserts stop supplying it.
  The column itself stays (historical rows keep their value); nothing reads it.

## 3. Conditional logic — the eight objectives

New client-safe module `src/lib/strategic-objective.ts`:

- `StrategicObjective` union of the eight values.
- `resolveObjective(briefVersions)` — reads `sections.f2_objective` from the latest
  brief version, normalises legacy `Refresh`, returns `null` when unset.
- `objectiveDirective(objective, stageKey)` — returns the injection text for a given
  stage, or `""` when that objective has no rule at that stage.

Server helper `src/lib/strategic-objective.server.ts` exposes
`getObjectiveDirective(sessionId, stageKey)`, which loads `brief_versions` once and
returns the block to append to that stage's user message. When there is no rule the
call returns `""` and the stage's behaviour is byte-identical to today.

Injection points, and nothing else:

| Objective | Stage | Injected rule |
|---|---|---|
| Launch | 5 | Mandatory "genuine first claim" interrogation; if true it must appear as a candidate territory |
| Launch | 17–21 | Channel mix weighted to earned/PR and category education |
| Refresh (Packaging) | 17–21 | Mandatory "reveal moment" beat; bounded lifecycle. No Stage 2/5 rule |
| Refresh (Campaign) | 17–21 | Existing distinctive assets and brand architecture are fixed constraints; territory-fatigue check against prior campaign history when present |
| Repositioning | 5 | "What we were vs what we're becoming" contrast required as a structural component of the tension |
| Repositioning | 13B | Weighting elevated on repositioning-specific historical precedent |
| Defence | 2 | Named competitive threat gets explicit priority weighting in the competitive set |
| Defence | 9 | Competitive Impossibility stress-tested against that named competitor |
| Challenger | 5 | Explicit interrogation of what the named incumbent is structurally blocked from claiming |
| Challenger | LOC | Engine 08 Enemy First guaranteed to fire and flagged for serious consideration at Checkpoint C |
| Crisis Recovery | 4B | Elevated fact-verification rigor |
| Crisis Recovery | 17–21 | Mandatory tonal constraints: no bravado, no minimising, direct acknowledgment required |
| Category Creation | 5 | Category definition itself as a mandatory output field, distinct from a product benefit |
| Category Creation | Intelligence Engine | Type 03 Category Creation required as primary lens |

Stages 2, 4B, 5, 9, 13B, 17, 17B, 18, 19, 20, 21 each gain one line appending the
directive to the existing user message. No other stage is touched.

### Challenger / LOC — the one non-prompt branch

`src/lib/loc.functions.ts` currently fires all thirteen engines equally. For Challenger:

- `enemy_first` is excluded from any engine-subset retry pruning, so it always fires.
- Its parsed output is tagged `priority: true` in `loc_engine_outputs`.
- `SMPSelection.tsx` renders an amber "Enemy First — priority for Challenger" badge on
  that candidate at Checkpoint C.

### Crisis Recovery — Release Gate

Entry #39 Release Gate is not built in this codebase. The tonal constraints are enforced
via the Stage 17–21 injection. If the Release Gate is built later, Crisis Recovery flips
it to mandatory; that is a one-line hook, noted but not built here.

## 4. Verification

Two runs on the same underlying brief, one `Launch`, one `Crisis Recovery`, diffing
Stage 5 and Stage 19 output to prove genuinely different behaviour. Reported stage by
stage with the actual output excerpts.

## Technical notes

- All directive text lives in one module so the rules are auditable in one place.
- Injection is additive to the user message; system prompts are unchanged, so an unset
  objective produces exactly today's output.
