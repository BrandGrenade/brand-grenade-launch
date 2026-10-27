# Roadmap — Partner Hub structured evidence (27 Oct 2026)

Previous Stage 16/22 work completed and verified in the preceding conversation.

1. [x] Diagnose and report missing JLR structured records before changes.
2. [x] Reconstruct structured Stage 10/11/13 and Stage 12 from version-matched saved outputs in access responses, without running stages or editing locked session content.
3. [x] Add reliable structured save retry and recorded platform errors; regression tests.
4. [x] Call list_runs and actual preview HTTP access point for JLR v96; all five outputs structured, Stage 11 has all eight tests, unchanged session row. Stage 12 schema in docs/hub-structured-evidence.md.
5. [x] Published with authorization; actual live HTTP list_runs returned JLR v96 and all five get_output responses were structured (Stage 10: six candidates; Stage 11: six blocks, each with eight tests; Stage 12: four cards). All 415 tests passed; JLR row unchanged; temporary verification key revoked.

## Infiniti current-position add-on

- [x] Checked existing runners and live controls: JLR is locked, the access version is 96, Stage 11/13 baselines are Deal-only, and historical null values need explicit preservation. Existing runners cannot safely perform this add-on.
- [x] Checked the named research: saved Infiniti audience claims cite September 2021 and the experience refresh cites 2023, but source_date fields are null; neither is a verified current brand proposition. Minimum new assessment work is baseline-only 10/11/13, using Infiniti rather than Jaguar evidence.
- [x] Approval received to build, test, publish and verify without further confirmation, conditional on sufficient proposition evidence; complete the evidence gate first.
- [x] Evidence gate: Lab v1 explicitly describes Infiniti's existing positioning as Japanese precision/omotenashi hospitality; combine this with dated 2023 experience refresh and 2021 audience evidence as BG-derived, unverified, with unknown publication dates retained.
- [x] Implemented private version-aware baseline jobs and Hub responses; 454 automated tests passed, basic security check clear. All 3 assessments saved with raw attempts and schema retry errors retained.
- [x] Published and checked all 16 actual live HTTP responses at v96/v97. v96 baseline outputs remain not_produced; v97 baseline outputs structured; original Stage 9/10/11/12/13 content identical excluding the explicitly added baseline. Database fingerprint confirms every session field and lock unchanged. All temporary verification keys revoked.
