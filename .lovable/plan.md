## Scope

Much of this already exists in the `sessions` table (stage outputs, errors, checkpoints B/C, auto-save on each stage). This plan covers the additions and the missing infrastructure (users, real-time, interrupted-stage recovery).

## 1. Database migration

Rename `sessions` → `pipeline_sessions` (or keep `sessions` and add columns — see "Decision" below). Add columns:

- `user_id uuid` (nullable for now — no auth yet in the app)
- `status` widened via CHECK to: `pending | running | awaiting_checkpoint | complete | held | error | interrupted`
- Checkpoint A: `checkpoint_a_confirmed bool`, `checkpoint_a_notes text`, `checkpoint_a_confirmed_at timestamptz`
- Checkpoint B/C: add `_notes` and `_confirmed_at` (B/C exist; only flags today)
- `selected_format text` CHECK (`agency|consulting|workshop`) — replaces/parallels `stage_16_format`
- `selection_rationale_1..6 text` — alongside existing `selection_rationale jsonb`
- `stage_12_smps jsonb`
- `stage_13_verdict text`
- `stage_15_clearance_status text`
- Flat brand fields: `brand_positioning`, `brand_product_truth`, `brand_audience_relationship`, `brand_tone_of_voice`, `brand_constraints`, `brand_organisational_context` (kept alongside existing `brand_intelligence jsonb`)
- `stage_status text` — tracks the in-flight stage so we can mark it `interrupted`
- `interrupted_stage int` — set on resume detection

New `users` table:
- `id uuid PK`, `email text unique`, `plan text CHECK (demo|professional|enterprise) default 'demo'`, `created_at`

RLS: keep public read/write on `pipeline_sessions` for now (no auth wired); add policies on `users`.

Enable Supabase realtime: `ALTER PUBLICATION supabase_realtime ADD TABLE pipeline_sessions;` and `REPLICA IDENTITY FULL`.

### Decision needed
The existing table is `sessions` and is referenced from ~20 server-fn files. Renaming to `pipeline_sessions` is a wide blast radius. I recommend **keeping the table name `sessions`** and only adding the new columns + realtime. This delivers everything the spec calls for without rewriting all stage handlers.

## 2. Server-side wiring

- `src/lib/session-heartbeat.functions.ts`: on stage start set `stage_status='running'`, on success set `'complete'`. On session resume, if `stage_status='running'` and `updated_at` is stale (>2 min), flip to `'interrupted'` and expose a retry that re-runs only that stage.
- Per-stage retry: each `runStageN` already writes `stage_N_error` — expose them as `retryStageN` (same call). Add a thin `retryStage(stageId)` dispatcher in `src/lib/retry.functions.ts`.
- New `getOrCreateUser` server fn (email-based, demo plan default) — placeholder until auth lands.

## 3. Client wiring

- `pipeline.tsx`: subscribe to `supabase.channel('pipeline_sessions').on('postgres_changes', { table: 'sessions', filter: 'id=eq.<id>' })` and merge updates into local state — stage tracker updates without polling.
- Right-panel error state: when `stage_N_error` is set, show error card + "Retry stage N" button calling the dispatcher.
- `dashboard.tsx`: list sessions DESC by `updated_at`, badge `status`, "Resume" link to `/pipeline?session=<id>`; resumes detect `interrupted` and re-run only that stage.

## 4. Out of scope (call out)

- No real auth (email/password, Google) — `users` table is created but not enforced. Want me to wire Lovable Cloud auth too? Say the word.
- Stage 1B already conditional via `stage_1b_required` — no change.

## Files touched

- New migration `supabase/migrations/*_session_arch.sql`
- New: `src/lib/session-heartbeat.functions.ts`, `src/lib/retry.functions.ts`, `src/lib/realtime-session.ts`
- Edit: `src/routes/pipeline.tsx`, `src/routes/dashboard.tsx`, each `stageN.functions.ts` (one-line heartbeat call at start)

Approve and I'll execute the migration first, then the code changes in one pass.

## Priority backlog — Fact verification safeguard (build before next client session)

**Problem:** Stage 4B distinguishes "real facts" from "perceived facts" in prompt, but no verification step exists before real-fact claims flow downstream. A factually incorrect "real fact" (rugby union prohibits the forward pass — false; both codes share the rule) was generated, treated as verified, and built into the strongest territory of a session before manual human catch. Undetected factual errors in "verified fact" output are a platform-level credibility risk.

**Universal fix — applies to every brand, every category, every future session:**

1. **Stage 4B fact-verification pass.** After Stage 4B streams its initial output, extract every claim explicitly labelled `Real Fact` (vs `Perceived Fact`). For each, run a web search (Firecrawl `search` or `websearch`) to confirm. If the search cannot corroborate the claim:
   - Downgrade the label from `Real Fact` → `⚠️ UNVERIFIED — REQUIRES HUMAN CONFIRMATION`
   - Prepend a visual flag (emoji + bold) so the reviewer sees it without re-reading the whole block
   - Append a one-line note: `Search ran; no corroborating source found. Do not promote to insight until confirmed.`
2. **Apply same rule to Stage 2 Category Intelligence** — any claim presented as established category fact (market size, regulation, behavioural statistic) gets the same verification pass.
3. **Audit any other stage** that emits claims framed as verifiable real-world facts; add to the verification dispatcher.
4. **Shared utility:** `src/lib/fact-verify.functions.ts` — takes `(claims: string[]) => Promise<{claim, verified, sources}[]>`. Stage 4B / Stage 2 post-processors call it before saving final `stage_*_output`.
5. **Surface in UI:** the right-panel renderer already shows markdown; flagged claims will render with the ⚠️ visual treatment automatically. No new component needed.

**Not urgent for tonight's session.** Build before any further client-facing sessions run.
