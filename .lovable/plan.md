# Infiniti current-position add-on for JLR v97

## Feasibility and boundaries

The existing runners cannot do this safely. JLR is a locked Campaign run at access-point v96; Stage 11 and Stage 13 currently add baselines only on Deal briefs. Changing the brief type is forbidden after Stage 1. The ordinary runners return saved outputs or replace full candidate assessments; they do not append a baseline.

A dedicated add-on can perform only three new assessments: Stage 10 scoring, Stage 11 T1–T8 testing, and Stage 13 six-dimension credibility assessment. No Stage 1–9 or Stage 12 execution is necessary, and no Campaign output, selection, document, lock or brief field changes.

## Proposition and evidence

- Derive a single Infiniti proposition from the specified saved research, explicitly labelled **BG-derived**, not an official current tagline or client-supplied wording.
- Use only source-version-matched material from Research Synthesiser `8ac87434-3bad-4921-b605-0b57acb26f54` v1 and Intelligence Lab `4740d024-9ce8-4757-905b-91767ce2dff0` v1. Do not substitute the latest Lab report for v1 or use Jaguar's selected proposition as Infiniti evidence.
- Preserve quoted extracted evidence, filenames, verification labels and dates at their actual precision. The saved audience claim cites **September 2021**; the experience-refresh claim cites **2023**. Their `source_date` fields are null. Show that limitation; never substitute the 20 October 2026 save date for a source publication date.
- Establish the exact BG-derived wording and evidence manifest before paid assessments. Missing source versions or insufficient evidence produce a named, visible error rather than invented supporting facts.

## Build

1. Add a private, version-aware baseline job and result record attached to this existing run. It inherits existing run access and grants no new Hub/client permissions.
2. Freeze v96 evidence and checksums. Reuse the existing stage rubrics, but assess only Infiniti's derived current proposition, excluded from candidate selection. Keep all attempts and source manifests.
3. Run the three assessments through a leased background queue with progress and bounded retries. Validate each structured result. Retry recoverable generation/validation/save failures, then retain a named error; credit exhaustion, denials and refusals stop immediately.
4. Publish all three validated results atomically at one new version boundary, only if the source remains v96. Keep v96 responses unchanged, including previously absent baselines. Never unlock or repurpose the Stage 16 exception.
5. Serve `stage10_current_position`, `stage11_current_position` and `stage13_current_position` through the existing Hub access point at v97. Include the baseline in Stage 11/13 structured responses without changing their existing Campaign candidate content. Extend the conditional contracts specifically for an explicit add-on, leaving other Campaign runs unchanged.

## Tests and verification

- Assert v96 remains unchanged and v97 contains all three validated, BG-derived records.
- Assert no candidate scores, prose, selection, documents, brief type or lock changes.
- Cover historical null values, one atomic version boundary, stale source rejection, idempotency, access restrictions, retry exhaustion and terminal denial handling.
- Run the automated suite and inspect preview results before publication. Verify the requested version through the actual access point; live verification requires publishing the new capability.
- Report exactly what ran, the proposition, quoted sources and date limitations, saved output identifiers and access-point results. Do not report completion until all three read back successfully.

## Technical approach

Use append-only baseline storage and explicit effective-version handling rather than merging into locked session fields. The current historical reader falls back to current values when a prior null has no snapshot, so an ordinary additive write would risk leaking v97 content into v96. Coordinate the new version boundary with existing history batches in one row-locked transaction. Reuse existing authentication and background-runner conventions; record the acting user and reason.