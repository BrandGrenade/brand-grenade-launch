# Creative Stimulus Engine — canonical architecture

Status: current as of 8 Sep 2026. Written by diffing against live code, not from
prior documentation. This file supersedes any earlier passage describing the
37-Lens Sweep as firing per channel brief.

## The sequence actually built

1. **One sweep, pre-channel.** `startBigIdeaRun`
   (`src/lib/stimulus-bigidea.functions.ts`) creates a single
   `stimulus_runs` row with `run_mode: "big_idea"` and
   `channel_name = BIG_IDEA_CHANNEL_LABEL` ("Campaign big idea (pre-channel)").
   It carries **no channel brief**: the 37 lenses are fired against the
   validated proposition / Stage 18 Detonation alone.
   `driveBigIdeaSweep` / `advanceBigIdeaSweep` seed and process all 37 lenses,
   with the watchdog at `src/routes/api/public/sweep-tick.ts`.

2. **Tissue Check triage (human).** Each direction is screened
   Keep / Keep in play / Kill via `triageStimulusDirection`
   (`src/lib/stimulus.functions.ts`), with revise available through
   `reviseStimulusDirection`.

3. **Gate One (human).** `setGateOneApproval` per idea, then `confirmGateOne`
   for the run. Fidelity breaks block confirmation in the rendered outputs.

4. **Lock.** `lockWinningIdea` persists `locked_big_idea`,
   `locked_campaign_line`, `locked_big_idea_lens` and `locked_big_idea_run_id`
   on the session; `unlockWinningIdea` reverses it. Sequencing between Gate One
   and lock is enforced in the Step 2 Shortlist UI, not inside
   `lockWinningIdea` itself.

5. **Channel briefs come after, and only from the lock.** `generateStage21`
   requires the locked idea and locked line, places them first as binding
   inputs in `buildStage21UserMessage`, and deliberately withholds the Stage 18
   line once a lock exists. `runChannelAdaptation` and the offline / martech
   prompt generators call `loadLockedSession`, require the lock, and run
   fidelity checks with one automatic retry.

The master idea is therefore the **input that produces** channel briefs, never
something applied alongside them.

## Retired: the legacy per-channel sweep

Until Sep 2026 a second path existed: `startStimulusRun` /
`generateStimulusBatch` / `listStimulusChannels` in
`src/lib/stimulus.functions.ts`, driven by `src/components/CreativeStimulus.tsx`.
It ran a separate 37-lens sweep **per Stage 21 channel brief, after the briefs
already existed**. No live route referenced the component; the path was dead and
was the source of the contradictory documentation.

Both the functions and the component have been deleted. Historical
`stimulus_runs` rows created by that path remain readable (`ChannelBriefs.tsx`
filters the run list to `run_mode === "channel_adaptation"`), but nothing
creates new ones. Any description of per-channel sweeping is **historical, not
current**.

## Shared layer that remains

`src/lib/stimulus.functions.ts` now holds only the shared run/direction layer:
`listStimulusRuns`, `loadStimulusRun`, `triageStimulusDirection`,
`reviseStimulusDirection` — used by both the pre-channel sweep and
channel-adaptation runs.
