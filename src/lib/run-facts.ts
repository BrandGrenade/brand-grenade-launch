// Run-level facts — the single source of truth for every count a deliverable
// is allowed to state about the pipeline run that produced it.
//
// Before this module each Stage 16 format asked the model to describe the run
// in prose, so vision / consulting / agency could (and did) disagree about how
// many stages ran, how many propositions were considered, how many documents
// exist and which governance gates were confirmed. No prompt may state a count
// that is not interpolated from here; if a fact is unavailable the format omits
// it rather than inventing one.

import { parseStage10Scores } from "./stage12-filter";
import { countPropositions } from "./count-helpers";

/** The 22 numbered pipeline stages. Sub-stages (1b, 13b, 14b/c, 17b, 20b/l)
 *  are variants of their parent and are not counted separately. */
export const NUMBERED_STAGE_COLUMNS: string[] = Array.from(
  { length: 22 },
  (_, i) => `stage_${i + 1}_output`,
);

export const STAGE_16_FORMAT_COLUMNS = [
  "stage_16_agency_output",
  "stage_16_consulting_output",
  "stage_16_workshop_output",
  "stage_16_vision_output",
] as const;

export interface GateFact {
  /** Client-facing gate name. */
  name: string;
  confirmed: boolean;
}

export interface RunFacts {
  stagesCompleted: number;
  stagesTotal: number;
  propositionsConsidered: number;
  propositionsScored: number;
  propositionsPassed: number;
  documentsProduced: number;
  gates: GateFact[];
  gatesConfirmed: number;
  gatesTotal: number;
}

type Row = Record<string, unknown>;

function text(row: Row, key: string): string {
  const v = row[key];
  return typeof v === "string" ? v.trim() : "";
}

const GATE_DEFS: Array<{ name: string; column: string }> = [
  { name: "Checkpoint A — brief confirmed", column: "checkpoint_a_confirmed" },
  { name: "Checkpoint B — territories confirmed", column: "checkpoint_b_confirmed" },
  { name: "Checkpoint C — proposition selected", column: "checkpoint_c_confirmed" },
  { name: "Strategy sign-off", column: "strategy_signoff_confirmed" },
  { name: "Checkpoint D — creative territory selected", column: "checkpoint_d_confirmed" },
  { name: "Checkpoint E — detonation selected", column: "checkpoint_e_confirmed" },
  { name: "Checkpoint F — activation approved", column: "checkpoint_f_confirmed" },
];

/**
 * Derive every run-level count from persisted stage output. Deterministic:
 * two formats rendered from the same session always receive identical facts.
 *
 * @param includeFormat a Stage 16 format currently being generated — counted
 *   as produced even though its column is not written yet.
 */
export function deriveRunFacts(
  session: Row,
  includeFormat?: "agency" | "consulting" | "workshop" | "vision",
): RunFacts {
  const stagesCompleted = NUMBERED_STAGE_COLUMNS.filter((c) => text(session, c)).length;

  const stage8 = text(session, "stage_8_output");
  const stage10 = text(session, "stage_10_output");
  const scores = stage10 ? parseStage10Scores(stage10) : [];
  // The same proposition can be re-scored later in the same transcript; the
  // scored field is the set of distinct propositions, not the block count.
  const distinct = new Set(
    scores.map((s) => s.smpLine.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim()),
  );
  const passedNames = new Set(
    scores
      .filter((s) => s.codeVerdict === "PASS")
      .map((s) => s.smpLine.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim()),
  );

  const propositionsScored = distinct.size;
  const propositionsConsidered = Math.max(
    stage8 ? countPropositions(stage8) : 0,
    propositionsScored,
  );

  const producedColumns = STAGE_16_FORMAT_COLUMNS.filter((c) => text(session, c).length > 1000);
  const inFlightColumn = includeFormat ? `stage_16_${includeFormat}_output` : "";
  const documentsProduced =
    producedColumns.length +
    (inFlightColumn && !producedColumns.some((c) => c === inFlightColumn) ? 1 : 0);

  const gates: GateFact[] = GATE_DEFS.map((g) => ({
    name: g.name,
    confirmed: session[g.column] === true,
  }));

  return {
    stagesCompleted,
    stagesTotal: NUMBERED_STAGE_COLUMNS.length,
    propositionsConsidered,
    propositionsScored,
    propositionsPassed: passedNames.size,
    documentsProduced,
    gates,
    gatesConfirmed: gates.filter((g) => g.confirmed).length,
    gatesTotal: gates.length,
  };
}

/** Authoritative, interpolated block handed to every Stage 16 section call. */
export function runFactsBlock(f: RunFacts): string {
  const gateLines = f.gates
    .map((g) => `  - ${g.name}: ${g.confirmed ? "CONFIRMED" : "NOT CONFIRMED"}`)
    .join("\n");
  return `════════════════════════════════════════
RULE 5 — RUN FACTS ARE FIXED (AUTHORITATIVE)
════════════════════════════════════════

The figures below are computed from the actual pipeline record. They are the ONLY counts you may state about how this strategy was produced. Quote them exactly as written or omit the subject entirely. Never estimate, round, re-derive, or infer a different number, and never describe the pipeline in numbers that do not appear here.

RUN FACTS
- Pipeline stages completed: ${f.stagesCompleted} of ${f.stagesTotal}
- Propositions considered: ${f.propositionsConsidered}
- Propositions competitively scored: ${f.propositionsScored}
- Propositions clearing the hard floors: ${f.propositionsPassed}
- Governance gates confirmed: ${f.gatesConfirmed} of ${f.gatesTotal}
${gateLines}

This run produces up to four document formats from the same locked strategy; never state how many documents exist.

Scoring scale: six weighted dimensions totalling 90 points (Fame 30, Truth Strength 20, Competitive Impossibility 15, Brand Permission 10, Clean Air 10, Commercial Precedent 5). Every composite score is out of 90. Never write a composite out of 60, 100 or 110, and never compute a composite yourself — quote only the composite supplied in the pipeline inputs.

`;
}

/** One-sentence, client-facing statement of the same facts. */
export function runFactsSentence(f: RunFacts): string {
  return (
    `${f.stagesCompleted} of ${f.stagesTotal} pipeline stages completed · ` +
    `${f.propositionsConsidered} propositions considered · ` +
    `${f.propositionsScored} competitively scored · ` +
    `${f.gatesConfirmed} of ${f.gatesTotal} governance gates confirmed`
  );
}
