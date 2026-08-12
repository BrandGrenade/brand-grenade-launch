# Demo Mode — replacing Dev Mode

## Feasibility answers first

**1. Can the existing room views be reused in a stripped read-only mode?**
Partly — and the split is uneven, so the honest answer is "reuse two, rebuild two".

- `/intelligence/$id` (1,439 lines) and the `/creative/$sessionId` shell (226 lines) are close to pure display off a fetched row. Hiding the action buttons is genuinely cheap.
- `/briefing-room/$id` renders prop-driven step views inside a card that owns the run button. The views themselves are reusable; the wrapper is not.
- `/pipeline` (5,774 lines) is a single mega-component where stage output rendering, stream/DB-poll recovery, retry, reset-cascade and checkpoint confirmation are interleaved. There is no `StageOutputCard` boundary to reuse. Threading a `readOnly` flag through it would touch the most critical file in the app.
- `BigIdeaSweep`'s `IdeaCard` (1,021-line file) interleaves triage buttons and the revise textarea inside the same function as the display blocks.

So: reuse the intelligence report render and the briefing-room step views; write new read-only renderers for pipeline stages and idea cards. The new renderers are formatting-only (markdown text blocks + small typed cards), not new business logic — all the parsing helpers (`stage9-disposition-apply`, `checkpoint-gate`, `exec-summary-extract`) are already standalone and get imported as-is.

**2. Single linear "Next" across four separate routes?**
Not achievable by chaining the existing routes — each owns its own fetch, its own status polling and its own layout chrome. It needs one new unified route that loads all four data sources for a session and renders them as ordered steps. That is also the only way to get a stable step index for Next/Back and a progress rail.

## What gets built

### A. Remove Dev Mode entirely
- Delete `src/lib/dev-mode.ts`'s dev-mode half, `src/components/DevModeBanner.tsx`, its mount in `__root.tsx`.
- `src/lib/claude.server.ts`: delete `buildDevModePrompt`, `readDevMode`, and the two branches in `prepareCall` — every call keeps the Universal System Wrapper and full `maxTokens`.
- Drop `devMode` from `stage1.functions.ts` input and stop writing `sessions.dev_mode`; remove `getDevModeFromStorage()` call sites in `brief.index.tsx` and `brief.new.tsx`. The DB column is left in place (harmless, always false) rather than migrating a live table.

### B. Demo Mode as a pure viewing state
- New `src/lib/demo-mode.ts`: `useDemoMode()` backed by `localStorage` key `bg_demo_mode`, same cross-tab event pattern. Nothing server-side, nothing written to any session row, ever.
- `TopNav`: same slot, same admin-only gate, label `DEMO MODE`. When on, it also shows a "Walkthrough" entry that opens the session picker.
- No banner. Demo Mode ON simply enables the walkthrough route and its entry points.

### C. New unified walkthrough route
`src/routes/walkthrough.$sessionId.tsx` plus `src/routes/walkthrough.index.tsx` (picker listing completed sessions, newest first).

Data loaded once per session through one new server function `getWalkthrough` (`src/lib/walkthrough.functions.ts`), pulling:
- `intelligence_sessions` row (final_report, ranked territories)
- briefing-room workspace row (diagnosis, selected frame, tension)
- `sessions` row: all `stage_N_output(s)`, `selected_smp`, `selection_rationale`, checkpoint flags A–F, `locked_big_idea` / `locked_campaign_line`, `stage_21_outputs`
- `stimulus_runs` (+ `convergence_ledger`) and `stimulus_directions` for the winning run
- synthesiser run if present

Steps are computed into an ordered array, skipping absent ones:
```text
00 Research Synthesis → 01 Intelligence → 02 Briefing Room → Checkpoint A →
Stages 1–8 → Checkpoint B → Stage 9 (+ disposition ledger) → Stages 10–12
(+ selection rationale) → Checkpoint C → Stages 13–16 → Stage 17 territory →
Checkpoint D → Stage 18 Detonation → Checkpoint E → Stage 19 activation →
Stage 20 Master Brief → Checkpoint F → 04 Creative Engine (37 lenses,
root tensions, collision ledger, Tissue Check, Gate One, locked idea/line) →
Channel briefs → Orchestrated output
```
Navigation: sticky footer Back / Next with step counter, left rail of section titles for jumping, `?step=` in the URL so a position is shareable, arrow-key support.

### D. Presentation chrome
Read-only throughout: no retry/regenerate/reset, no error or stall banners, no status pills, no heartbeat indicators. Failed or missing steps are simply omitted from the sequence rather than shown as errors.

### E. Rejection reasoning as first-class content
Two dedicated steps rather than footnotes:
- **Stage 9 — what was considered**: parses the CANDIDATE DISPOSITION ledger with the existing `stage9-disposition-apply` helpers and renders every candidate as its own card — survived / rebuilt / rejected — with the verdict reason given the same weight as the survivors. Rejected cards sit alongside, not below.
- **Stage 12 — why this one**: the selected SMP beside every alternative it beat, each with its LOC/CORE source and rebuild note, plus the six-part `selection_rationale` including what was sacrificed.
Creative Engine gets the same treatment: killed and kept-in-play lenses shown with their triage reasoning, not filtered out.

## Technical notes
- One route, one server function, one fetch — no per-room polling in the walkthrough.
- New display components under `src/components/walkthrough/`; all parsing reuses existing standalone helpers.
- `head()` metadata on both new routes.
- Existing rooms are untouched apart from removing the dev-mode toggle wiring.
