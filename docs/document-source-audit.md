# Document source-of-truth audit

Audit scope: every user-facing document builder and its actual render/download entry point.

## Authority rule

- Current selections are resolved at render time.
- Room 04 authority is `stimulus_runs.winning_direction_id` + `winning_line_direction_id`, joined to `stimulus_directions`. `sessions.locked_*` is a cache only.
- `sessions.selected_smp` is the current SMP authority.
- Stage outputs are immutable historical snapshots. Documents may quote them as evidence, but must not let embedded SMPs, Reflection lines, master lines, or rejection explanations override current authoritative fields.
- Historical stage appendices are visibly marked as snapshots; the source-authority marker records the Room 04 lock time/run.

## Inventory

| Document / displayed field | Previous source | Current source | Status |
|---|---|---|---|
| Board Strategy §01/§04 recommendation | `selected_smp` plus Stage 10/12 prose | live `sessions.selected_smp` | Live |
| Board Strategy §05 fit proof | Stage 11 + Stage 13 output | Stage snapshots, explicitly evidence | Snapshot, correctly labelled by section |
| Board Strategy §06 scores/verdict | Stage 10 output | Stage 10 scoring snapshot matched to live SMP | Snapshot, visible in appendix/source marker |
| Board Strategy §07 rejection reasoning | Stage 10 weakest score/verdict | current `selection_rationale` first; Stage 10 fallback | Fixed |
| Board Strategy §08 winning idea/master line | Stage 14/15 implications; duplicated `sessions.locked_*` prepended | winning Room 04 run + winning directions resolved on click | Fixed |
| Board Strategy §08 Brand Architecture/assets | not rendered despite available Stage 22 fields | current `stage_22_brand_architecture` and `stage_22_distinctive_assets`, subordinate to Room 04 lock | Fixed |
| Board Strategy UI open action | session object loaded when Deliverables page mounted | full session refetch + Room 04 winning run/direction join on click | Fixed |
| Board Strategy appendix | Stage 1–15 outputs | same historical outputs | Flagged visibly as historical snapshots |
| Strategy Executive Summary winning SMP | `selected_smp` | live `sessions.selected_smp` | Live |
| Executive Summary proposition rejection reasons | Stage 12 pressure notes | current session plus stage evidence; canonical §07 uses `selection_rationale` | Fixed in canonical section |
| Executive Summary scoring/verification | Stage 10/11 outputs | stage snapshots matched to live SMP | Snapshot, visible source marker |
| Executive Summary Brand World line | Stage 22 `REFLECTION` | authoritative Room 04 winning line; Reflection only when no lock exists | Fixed |
| Executive Summary Stage 22 Reflection/deployment fallback | builder expected `stage_22_output`, but UI/bundle queries omitted it | `stage_22_output` included at every build entry point; still subordinate to Room 04 lock | Fixed |
| Executive Summary distinctive asset | Stage 22 shorthand in older code | `stage_22_distinctive_assets` recommended assets | Live current stored stage result |
| Consulting Delivery all ten sections | Shared Minto derivation | live SMP + authoritative Room 04 run; snapshots marked | Fixed |
| Consulting Delivery §08 Brand Architecture/assets | absent | current Stage 22 architecture/assets with Room 04 lock first | Fixed |
| Master Detonation Brief SMP | Stage 20 embedded SMP fallback | live SMP first; Stage 20 only fallback | Fixed precedence |
| Master Detonation Brief §08 idea/line | Stage 20/14/15 prose | authoritative Room 04 winning run first | Fixed |
| Master Detonation Brief §08 Brand Architecture/assets | available only in appendix | current Stage 22 architecture/assets also surfaced in §08 | Fixed |
| Brand Architecture centre Reflection | Stage 22 embedded `REFLECTION` | authoritative Room 04 winning campaign line when locked | Fixed (stale Reflection no longer displayed as current) |
| Brand Architecture lock block | duplicated `sessions.locked_*` | authoritative Room 04 run resolved on click | Fixed |
| Complete Brand Detonation Brand Architecture | Stage 22 Reflection + session cache | authoritative Room 04 line injected into grid | Fixed |
| Creative Showcase idea, lens, line | duplicated `sessions.locked_*` | server-side winning run/direction join per render | Fixed |
| Creative Showcase ratings/instinct brief | winning direction record | authoritative winning direction record | Live |
| Creative Showcase channel expressions | newest adaptation/offline-brief runs per channel | same newest live runs | Live |
| Creative Showcase rejection reasoning | orchestration prompt `rejected_reason` | current orchestration prompt records | Live |
| Document 00A territories/evidence | latest completed Intelligence run by normalised brand | same completed run | Historical report by design; exact run ID and completion timestamp now shown |
| Executive Summary Intelligence evidence | latest completed Intelligence run by normalised brand | same completed run | Exact run ID/date shown; brand-name linkage explicitly disclosed pending a direct relational link |
| Strategy & Creative Vision | cached `stage_16_vision_output` | stored generated artefact | Snapshot necessary; UI exposes explicit regenerate against current inputs |
| Agency Pitch / Workshop Guide | Stage 1–15 outputs + live SMP cover | stage snapshots + live SMP cover | Historical pipeline records; not presented as current Room 04 output |
| Full Pipeline Run | every stored stage output | same immutable stage record + live SMP cover | Historical record by design and labelled as such |
| Detonation Territory | `stage_17_selected_territory` | current selected territory field | Live selection |
| The Detonation | `stage_18_selected_detonation` | current selected detonation field | Live selection |
| Activation Architecture | `stage_19_output` | generated snapshot | Snapshot by design |
| Channel Detonation Briefs | `stage_21_outputs` | generated snapshots | Snapshot by design |
| Conceptual Assets | `stage_22_distinctive_assets` | current Stage 22 asset output | Live current stored stage result |
| Orchestration Prompt Set (tool-specific MarTech prompts) | reachable only inside Room 04 | Deliverables entry resolving the Gate Two-confirmed (else newest complete) orchestration at click time | Live; now present on Deliverables |
| Orchestration signature registry / cross-refs / Gate Two record | Room 04 only | same export, resolved live | Live; now present on Deliverables |
| 37-Lens Sweep raw ideas | Room 04 only | Deliverables batch export resolving directions at click time | Live; now present on Deliverables |
| Gate One shortlist | Room 04 only | Deliverables batch export filtered on `gate_one_approved` at click time | Live; now present on Deliverables |
| Full Creative Showcase | Deliverables (Phase 2 section only) | also included in the zip bundle | Live |
| Phase 2 documents (Territory, Detonation, Activation, Channel Briefs, Assets, Architecture, Complete Detonation) | stage snapshots with no version marker | unchanged snapshots plus a mandatory "Source authority" block naming generation time, session update time, live SMP and Room 04 lock time/run | Snapshot, now explicitly versioned |
| Download-All copies of all above | page session object, which could age | full session refetch + authoritative Room 04 join before bundle build; Creative Stimulus Engine exports resolved from their own records | Fixed |
| Generated consulting/agency/workshop URL cache | `status=ready` regardless of later session changes | reused only when document generation timestamp is at/after session `updated_at` | Fixed; otherwise automatically regenerated |

## Remaining intentional snapshots

Stage-generated prose is retained for audit/history and is not silently rewritten after later decisions. It is now subordinate to live selected fields in synthesis documents, and canonical documents include a visible source-authority statement. Regenerable creative/vision artefacts remain snapshots because changing their inputs without regeneration would misrepresent what was generated.