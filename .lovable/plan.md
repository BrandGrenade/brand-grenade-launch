# Creative Guidance for the Room 04 big-idea sweep

Feasible, and it fits the existing architecture cleanly. Guidance is stored on the sweep run itself, so it travels with every lens call in that sweep and stays visible afterwards as an attributable input.

## What gets built

**1. Store it against the run**
Add a `creative_guidance` text column to the sweep run record (nullable, defaults to none). Existing runs are unaffected and simply have no guidance.

**2. Capture it on the trigger screen**
On the sweep panel in the Creative Engine, above the "Run 37-lens big idea sweep" / "Start a fresh sweep" buttons, add an optional multi-line "Creative guidance (optional)" field with helper text explaining it steers the register of ideas and is recorded against the sweep. Empty is allowed and behaves exactly as today. The field is only editable before a sweep starts; once a sweep exists its guidance is shown read-only.

**3. Inject it into every lens call**
The guidance is passed into the big-idea user message builder as its own clearly-fenced block, sitting alongside the existing constraints (execution-detail ban, word ceilings, collision check). It is included in all three call paths — batch, single-lens recovery, and collision regeneration — so no lens in the sweep is generated without it.

Important: the guidance text itself is yours, injected verbatim. The wrapper around it does not invent a target. Batches are 3 lenses at a time, so a sweep-wide proportion cannot be enforced by the wrapper — the model only sees its current batch plus the root tensions already produced. The wrapper therefore tells the model to read the prior-tension list and judge the running mix, which is what makes a stated numeric target actually operative.

Exact injected block (guidance non-empty):

```text
═══ CREATIVE GUIDANCE FOR THIS SWEEP — MANDATORY STEER ═══
<your guidance text, verbatim>

This guidance applies to every lens in this sweep. It steers register, framing and emphasis. It does NOT override the proposition, the lens's angle of attack, the collision check, the word ceilings, or any hard ban in the system prompt — an idea may never be twisted into dishonesty or into a different proposition to satisfy it.
Where the guidance states a proportion or target, it is measured across the WHOLE 37-lens sweep, not this batch. Before you write, read the ROOT TENSIONS ALREADY PRODUCED list above and judge the running mix against the target: if the sweep so far is short against it, this batch must correct toward it. If a lens genuinely cannot honour the guidance without breaking its own angle of attack, produce the honest idea and say so in one clause in WHY IT WINS.
```

When the guidance field is blank the block is omitted entirely and the prompt is byte-identical to today's.

## Making the CommBank test a real check

"A meaningful share" is left entirely to model judgment as written — 2–3 shifted ideas would technically comply. Recommend running the validation with an explicit target in the guidance text itself:

> Many prior ideas depict the negative of commitment (frozen, trapped, walled in) rather than the positive benefit of liquidity itself. At least half of the 37 ideas in this sweep — 19 or more — must be gain-framed: they must show what staying liquid actively delivers (access, opportunity, capability in the moment), with the positive as the idea's engine, not a closing reassurance after a loss-framed setup. Loss-framing is not banned and should still carry the remainder where a lens genuinely demands it.

Then the pass/fail test is countable: classify all 37 root tensions gain vs loss vs mixed, compare against the current sweep's baseline, and report both counts. I'll do that classification and show the before/after table rather than asserting a shift.


## Technical notes

- Column: `stimulus_runs.creative_guidance text`.
- Prompt: new optional `creativeGuidance` arg in `buildBigIdeaUserMessage`; block omitted entirely when blank so existing prompt output is byte-identical for runs without guidance.
- `startBigIdeaRun` accepts an optional guidance string and persists it at run creation; `runBigIdeaBatch` reads it off the run row.
