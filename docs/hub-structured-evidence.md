# Partner Hub structured evidence repair — 27 October 2026

## Diagnosis (read-only, before changes)

JLR `3470f1ad-b322-4230-8e3d-bf0072e95b7a`, Campaign/full, created 20 October:

- Stage 10: current structured record null; error `expected 4 propositions, got 6`. Its 21 October rerun versioned the older four-candidate structured record, but the writer still derived expected count from Stage 8 rather than the six actual Stage 10 candidates.
- Stage 11: record null; `surviving_set.0…3: Expected string, received object`.
- Stage 13: record null; `forcing_test.path_or_reason: Required`.
- Stage 12: `stage_12_smps` null. Stage 12 writes presentation text and selection separately but had no structured-column writer.
- Stage 9: structured record present. Campaign is not excluded from candidate structured evidence. Campaign current-position absence is expected and unchanged.
- Failed structured blocks were split from prose and not retained. Stage 10's old four-candidate snapshot must not be attached to the current six-candidate output.

## Recovery

`saved-stage-records.ts` reconstructs only explicitly saved values, with complete per-test results and verbatim source evidence. No model calls, content updates, scores, judgements, unlocking, or history replacement. Missing entity/date subfields are null/empty rather than guessed; named evidence remains in the original justification/source text. Unsupported or incomplete formats fail closed. Historical access requests reconstruct from that requested version's document, not today's output.

Access remains read-only: repaired payloads are materialized in responses, not written into locked session fields. New stage writes save structured records atomically, retry a failed write once, and record platform errors; missing structured blocks retry local extraction before recording the error. No second model call.

## Stage 12 schema

Response: existing `bg-access.v1` envelope; `schema_version: "stage12_propositions.v1"`, `content_status: "structured"`.

`content`:

```typescript
{
  propositions: Array<{
    number: number; // positive integer, original presentation order
    smp: string;
    field_name: string;
    owns: string;
    truth: string;
    challenge: string;
    makes_possible: string;
    requires: string;
    scores: {
      fame: number;
      truth_strength: number;
      competitive_impossibility: number;
      brand_permission: number;
      clean_air: number;
      commercial_precedent: number;
    }; // each saved integer 1–10
    weighted_composite: number; // saved, not recomputed
    weighted_max: 90;
    metadata: Record<string, string>; // saved card footer fields
  }>;
}
```

No current-position candidate is synthesized. Selected proposition/rationale are not guessed or added to the Stage 12 card schema. Stage 10/11/13 retain the existing `{ record, text }` envelope; recovered records carry `recovery: "saved_text"`.