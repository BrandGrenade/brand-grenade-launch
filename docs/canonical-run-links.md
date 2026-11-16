# Canonical run links — 16 Nov 2026

## Route contract

Every Room uses `https://brandgrenade.app/runs/<run_id>` for its saved read-only view. The ID is the access-point run ID, not an assumed parent session or workspace ID.

Strategy Pipeline accepts `?stage=18` and lettered stages. Without a stage it reads the latest stage with saved evidence; JLR resolves to Stage 22. Access `list_runs` adds `open_url` per production/test row; `run_manifest` adds `open_url` and `stage_urls` both at the top level and in content. No prior response fields were removed. Stage URLs contain only stages with saved output.

## Diagnosed causes

- `9ab82c60-4051-49f2-9825-a175a9ce3ae9` exists in `stimulus_runs`, with `run_mode=offline_creative_brief`, status complete, parent session `3470f1ad-b322-4230-8e3d-bf0072e95b7a`. The old Creative route looked up that stimulus ID in sessions, so it found nothing. The saved view now opens that exact offline creative record and its saved direction.
- `d287fcca-7993-40ad-9647-45f7b4a013c4` exists in `saved_briefs`, with a 41,056-character JLR brief, not in `briefing_room_workspaces`. The old page invoked the workspace loader and never caught its rejection, leaving ws=null and an endless loading message. It now resolves saved briefs correctly and displays named errors and a back link for genuinely absent workspaces.
- Brief intake did not recognize session search parameters; Synthesiser intake did not recognize run search parameters. Both now resolve saved-run links without displaying blank intake forms.

## Verification

- All 577 tests across 81 files passed, including 17 new tests. Preview build OK.
- Real authenticated account: admin check opened all 36 linked JLR records and confirmed the matching rendered run ID through same-origin frame messages. Includes test copy, 25 Creative records, four Room 02 records, three Synthesiser records and two Lab records.
- Old Strategy, Creative, Briefing links redirected successfully; Synthesiser run query opened saved claims.
- Stage 18 direct URL showed Stage 18 saved text; unanchored JLR URL showed Stage 22.
- Unknown workspace showed `Briefing workspace not found`, not a spinner.
- Signed-out saved-run request was refused; no saved-run data marker rendered.
- 776×664 viewport: saved research page had no horizontal overflow.
- JLR entire session row hash before/after: `7c34a9c23ab0740cc2e3904eecce9bb2`. This fingerprint is current whole-row evidence, not a comparison against the earlier historical fingerprint.
- No run-content writes, AI calls, schema migrations, lock changes or version changes. Admin saved reads validate existing platform admin authority server-side; ordinary reads retain existing RLS. Authentication configuration is unchanged.
- Not published. All browser checks were against the current preview using real saved backend records; live deployment checks remain unverified.

## Changed files

- `src/lib/run-links.ts`
- `src/lib/run-links.functions.ts`
- `src/routes/runs.$runId.tsx`
- `src/components/admin/RunLinkCheck.tsx`
- `src/routes/admin.clients.tsx`
- `src/routes/brief.index.tsx`
- `src/routes/synthesiser.index.tsx`
- `src/routes/creative.$sessionId.tsx`
- `src/routes/briefing-room.$id.tsx`
- `src/lib/access/core.ts`
- `src/lib/access/core.test.ts`
- `src/lib/run-links.test.ts`
- `src/lib/run-links-handlers.test.ts`
- `roadmap.md`
- `docs/canonical-run-links.md`