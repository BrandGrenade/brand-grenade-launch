# Government Brief Type — Remediation Plan

Status: scoped, not started. Tracked as separate work from the six production fixes shipped alongside it.
Estimated effort: ~2 working sessions.

---

## 1. What is actually true today (code-level)

### Intelligence Lab (`intelligence_sessions`)

- Brief type IS captured. `IntelligenceForm.tsx` renders a Commercial / Government select.
- It is NOT a column. It is written into `report_metadata.brief_type` (JSONB) — at insert
  (`createIntelligenceSession`), on edit (`updateAndRerunIntelligenceSession`, merged over
  `existingMeta`), and re-stamped on completion in `runIntelligenceAnalysis`.
- On run, `normaliseBriefType()` reads it and `buildSystemPrompt(briefType)` appends
  `GOVERNMENT_ADDENDUM` (`src/lib/intelligence/government-addendum.ts`) instead of
  `COMMERCIAL_ADDENDUM`.
- The output contract has a `government_addendum` object and a
  `historical_validation.government_precedents` array; both are model-populated.
- The report page (`intelligence.$id.tsx`) and PDF 00A (`intelligence/pdf-00A.ts`) render the
  Government Addendum only when BOTH `briefType === "government"` AND
  `report.government_addendum` is non-null.

### Main 22-stage pipeline (`sessions`)

- Brief type does NOT exist at all. No column, no UI capture, no prompt branch.
  Government context reaches the model only as free prose inside the brief text.

### Therefore the reported defect has three distinct causes, not one

1. **Silent relabel to "Commercial"** — `normaliseBriefType()` fails safe to `commercial` for
   any value that is not the exact string `government`. Any path that writes
   `report_metadata` without spreading the existing object (or any pre-existing session created
   before the metadata write existed) loses the flag permanently and silently.
2. **Addendum dropped even when type is correct** — the model is instructed to populate
   `government_addendum` but nothing validates that it did. If it returns `null` (long output,
   token pressure, JSON truncation), the section renders as absent with no warning anywhere.
3. **No pipeline coverage** — a government engagement run through the 22-stage pipeline gets
   no government treatment at all, by design gap.

---

## 2. Plan

### Phase A — Make brief type first-class and unlosable (Session 1)

1. Migration: add `brief_type text not null default 'commercial'` with a
   `CHECK (brief_type in ('commercial','government'))` to `intelligence_sessions` and to
   `sessions`. Add GRANTs consistent with existing policies on both tables.
2. Backfill `intelligence_sessions.brief_type` from `report_metadata->>'brief_type'` where
   present.
3. Switch every read to the column; keep writing `report_metadata.brief_type` for one release
   as a mirror so existing report hydration keeps working, then drop the mirror.
4. Remove the silent fallback. `normaliseBriefType` keeps defaulting for legacy rows, but any
   run that finds a session whose column and metadata disagree logs and prefers the column.

### Phase B — Guarantee the addendum exists (Session 1)

5. Post-parse validation in `runIntelligenceAnalysis`: when `brief_type = 'government'` and
   `parsed.government_addendum` is null/empty, do one targeted repair call asking only for the
   addendum object, then merge it into the stored report.
6. If repair still fails, persist `report_metadata.government_addendum_missing = true` and
   surface an explicit amber warning on the report page and in Document 00A — never render a
   government report that silently looks commercial.
7. Same treatment for `historical_validation.government_precedents` being empty across all
   territories: warn rather than hide.

### Phase C — Pipeline coverage (Session 2)

8. Capture brief type in the brief intake (`brief.new.tsx` / `brief.index.tsx`) and on the
   Briefing Room handoff, persisting to `sessions.brief_type`.
9. Conditional prompt injection: append a government block to the stages where institutional
   voice materially changes output — Stage 2 (category intelligence), Stage 4B (fact status),
   Stage 8/9 (proposition permission + backlash), Stage 13 (verdict), Stage 15 (clearance),
   Stage 20 (master brief). One shared `GOVERNMENT_PIPELINE_ADDENDUM` module, injected by a
   single helper, not copy-pasted per stage.
10. Deliverables: add a Government Addendum section to the Stage 16 documents and the
    downloadable bundle when `brief_type = 'government'`.

### Phase D — Verification (Session 2)

11. Two full end-to-end runs per the standing hard rule: one government brief through the
    Intelligence Lab into the pipeline to deliverables, one commercial control to confirm no
    regression. One of the two must survive browser backgrounding.
12. Explicit checks: type survives edit + re-run, survives reload, appears on report header,
    appears in 00A, appears in the deliverables bundle, and the commercial run shows none of it.

---

## 3. Out of scope for this piece

- Backfilling government treatment into historical completed sessions.
- CALD/multicultural depth beyond what the existing addendum prompt already asks for.
- Any change to the LOC engines — brief type does not currently branch them and this plan does
  not add that.

---

## 4. Risk notes

- The migration touches `sessions`, which ~20 server-fn files select from. Adding a defaulted
  column is additive and safe; no existing select needs to change unless it reads the new field.
- Phase B's repair call adds one extra model call on government runs only.
- Phase C's prompt injection changes live output for government briefs — it must ship behind
  the column so commercial runs are byte-identical to today.
