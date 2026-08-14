# Creative Guidance for the Room 04 big-idea sweep

Feasible, and it fits the existing architecture cleanly. Guidance is stored on the sweep run itself, so it travels with every lens call in that sweep and stays visible afterwards as an attributable input.

## What gets built

**1. Store it against the run**
Add a `creative_guidance` text column to the sweep run record (nullable, defaults to none). Existing runs are unaffected and simply have no guidance.

**2. Capture it on the trigger screen**
On the sweep panel in the Creative Engine, above the "Run 37-lens big idea sweep" / "Start a fresh sweep" buttons, add an optional multi-line "Creative guidance (optional)" field with helper text explaining it steers the register of ideas and is recorded against the sweep. Empty is allowed and behaves exactly as today. The field is only editable before a sweep starts; once a sweep exists its guidance is shown read-only.

**3. Inject it into every lens call**
The guidance is passed into the big-idea user message builder as its own clearly-fenced block, sitting alongside the existing constraints (execution-detail ban, word ceilings, collision check). Wording makes its status explicit: it is a steer on register and emphasis, applied across the sweep as a whole; it does not override the SMP, the lens mechanics, the output contract, or any hard ban. It is included in all three call paths — batch, single-lens recovery, and collision regeneration — so no lens in the sweep is generated without it.

**4. Surface it afterwards**
- Tissue Check / sweep header shows a "Creative guidance applied" block with the verbatim text.
- The sweep export includes the same block, so any reader can see what steered the mix.

## Validation against the CommBank case

Run a fresh CommBank sweep with the liquidity gain-framing guidance, then compare the resulting 37 root tensions against the current sweep and report the shift in gain- vs loss-framed ideas. The guidance is deliberately phrased as emphasis ("a meaningful share"), not a ban, so loss-framing remains available where a lens genuinely needs it.

## Technical notes

- Column: `stimulus_runs.creative_guidance text`.
- Prompt: new optional `creativeGuidance` arg in `buildBigIdeaUserMessage`; block omitted entirely when blank so existing prompt output is byte-identical for runs without guidance.
- `startBigIdeaRun` accepts an optional guidance string and persists it at run creation; `runBigIdeaBatch` reads it off the run row.
