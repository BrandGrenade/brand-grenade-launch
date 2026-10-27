// Serve-time contracts for every output the Partner Hub allow-lists can
// request. One contract per output: name, schema version, required fields.
// Contracts describe the access-point payload (which may be a recovered
// record), so they are looser than generation-time schemas but pin every
// field the Hub relies on. contracts.test.ts proves every allow-list entry
// has a contract and that real JLR payloads satisfy them.
import { z } from "zod";
import { Stage9Schema, Stage10CurrentPositionSchema, Stage11CurrentPositionSchema, Stage13CurrentPositionSchema } from "../structured-output";
import { Stage12PropositionsSchema } from "../saved-stage-records";

export type ContractStatus = "structured" | "text_only" | "unavailable" | "conditional";
export interface OutputContract {
  output_id: string;
  schema_version: string;
  /** Status a complete run is expected to serve. */
  status: ContractStatus;
  /** Required-field schema for `content` when structured; null when never served. */
  content: z.ZodTypeAny | null;
  note: string;
}

const str = z.string().min(1);
const dim = z.object({ score: z.number().int().min(1).max(10), justification: str }).passthrough();
const textDoc = z.object({ text: str });

// Recovered records keep extra provenance keys; contracts check required fields only.
const stage10Record = z
  .object({
    smps_scored: z.number().int().min(1),
    selection_rule: z.string().nullable(),
    scores: z
      .array(
        z
          .object({
            smp: str,
            field_name: z.string(),
            fame: dim,
            truth_strength: dim,
            competitive_impossibility: dim,
            brand_permission: dim,
            clean_air: dim,
            commercial_precedent: dim,
          })
          .passthrough(),
      )
      .min(1),
  })
  .passthrough();

const stage11Test = z.object({ result: z.enum(["HOLDS", "WOBBLES", "CRACKS", "N/A"]), rationale: z.string().nullable() }).passthrough();
const stage11Record = z
  .object({
    blocks: z
      .array(
        z
          .object({
            smp: str,
            field_name: z.string(),
            tests: z
              .object({ T1: stage11Test, T2: stage11Test, T3: stage11Test, T4: stage11Test, T5: stage11Test, T6: stage11Test, T7: stage11Test, T8: stage11Test })
              .passthrough(),
            verdict: str,
          })
          .passthrough(),
      )
      .min(1),
    surviving_set: z.array(z.string()),
    exposed_count: z.number().int().min(0),
    divergence_preserved: z.boolean(),
  })
  .passthrough();

const CRED = ["product_truth_alignment", "audience_permission", "tonal_compatibility", "behavioural_capacity", "cultural_authority", "historical_consistency"] as const;
const stage13Record = z
  .object({
    verdict: z.enum(["CONFIRMED — PROCEED", "CONFIRMED WITH ADJUSTMENTS — PROCEED", "HUMAN REVIEW REQUIRED", "RETURN TO STAGE 12 — RESELECT SMP"]),
    verdict_reason: str,
    credibility: z.object(Object.fromEntries(CRED.map((k) => [k, dim])) as Record<(typeof CRED)[number], typeof dim>).passthrough(),
    most_vulnerable: z.enum(CRED),
    ownership: z.object({ own: str, behave: str, sustain: str }).passthrough(),
    section5: z.object({ mode: z.enum(["GUARDRAILS", "OPERATIONAL_REQUIREMENTS"]), items: z.array(z.object({ text: str }).passthrough()) }).passthrough(),
    commitments: z.array(z.string()),
  })
  .passthrough();

const withText = (record: z.ZodTypeAny) => z.object({ record, text: str }).passthrough();


export const CONTRACTS: OutputContract[] = [
  // ── Room 00 · Research Synthesiser ─────────────────────────────────────
  {
    output_id: "room00.claims",
    schema_version: "room00.claims.v1",
    status: "structured",
    content: z.object({
      claims: z
        .array(
          z.object({
            position: z.number().int().min(1),
            heading: str,
            claim: str,
            source: z.string().nullable(),
            source_date: z.string().nullable(),
            bg_label: z.string().nullable(),
            label: str,
          }),
        )
        .min(1),
    }),
    note: "One row per claim per heading, in text-block order, with the Hub evidence label mapped.",
  },
  // ── Room 01 · Intelligence Lab ─────────────────────────────────────────
  {
    output_id: "room01.report",
    schema_version: "room01.report.v1",
    status: "structured",
    content: z.object({ territories: z.array(z.record(z.string(), z.unknown())).min(1) }).passthrough(),
    note: "Full parsed report object; territories is the required payload.",
  },
  {
    output_id: "room01.territories",
    schema_version: "room01.territories.v1",
    status: "structured",
    content: z.object({ territories: z.array(z.object({ id: str, name: str }).passthrough()).min(1) }),
    note: "Territory records exactly as saved in the report.",
  },
  {
    output_id: "room01.white_space",
    schema_version: "room01.white_space.v1",
    status: "structured",
    content: z.object({
      white_space: z.array(z.object({ territory_id: z.unknown(), territory_name: z.unknown(), white_space: z.unknown() }).passthrough()).min(1),
    }),
    note: "White-space assessment per territory; white_space may be text or a structured object.",
  },
  {
    output_id: "room01.layer04",
    schema_version: "room01.layer04.text.v1",
    status: "unavailable",
    content: null,
    note: "Layer 04 text lives only in retired layer fields, which are never served. Always unavailable by design.",
  },
  // ── Room 02 · Briefing Room ────────────────────────────────────────────
  {
    output_id: "room02.steps",
    schema_version: "room02.steps.v1",
    status: "structured",
    content: z
      .object({
        diagnosis: z.unknown(),
        truths: z.unknown(),
        relevance: z.unknown(),
        tensions: z.unknown(),
        selected_frame: z.unknown(),
        selected_tension_index: z.unknown(),
      })
      .passthrough(),
    note: "The four workspace steps plus selections; partial when a step is missing.",
  },
  {
    output_id: "room02.saved_brief",
    schema_version: "room02.saved_brief.v1",
    status: "structured",
    content: z.object({ brand_name: z.string().nullable(), category: z.string().nullable(), fields: z.unknown(), text: z.string().nullable() }).passthrough(),
    note: "Saved brief fields and text.",
  },
  // ── Room 03 · Strategy Pipeline ────────────────────────────────────────
  { output_id: "stage02", schema_version: "stage02.text.v1", status: "text_only", content: textDoc, note: "Prose stage document; no structured form exists." },
  { output_id: "stage04b", schema_version: "stage04b.text.v1", status: "text_only", content: textDoc, note: "Prose stage document; no structured form exists." },
  { output_id: "stage09", schema_version: "stage09.structured.v1", status: "structured", content: withText(Stage9Schema), note: "Proposition set with ranking and recommendation." },
  {
    output_id: "stage09_loc",
    schema_version: "stage09_loc.v1",
    status: "structured",
    content: z
      .object({
        task_type: z.string().nullable(),
        engine_outputs: z.unknown().refine((v) => v !== null && v !== undefined, "engine_outputs required"),
        validation: z.unknown(),
        decision_packages: z.unknown(),
        selected_expression: z.string().nullable(),
      })
      .passthrough(),
    note: "LOC engine outputs, validation and decision packages.",
  },
  { output_id: "stage10", schema_version: "stage10.structured.v1", status: "structured", content: withText(stage10Record), note: "Six-dimension scores per candidate." },
  { output_id: "stage10_current_position", schema_version: "stage10_current_position.v1", status: "conditional", content: Stage10CurrentPositionSchema, note: "Deal baseline or explicitly published version-aware Campaign add-on; otherwise not_produced." },
  { output_id: "stage11", schema_version: "stage11.structured.v1", status: "structured", content: withText(stage11Record), note: "T1–T8 forcing tests per candidate with verdicts." },
  { output_id: "stage11_current_position", schema_version: "stage11_current_position.v1", status: "conditional", content: Stage11CurrentPositionSchema, note: "Deal baseline or explicitly published version-aware Campaign add-on; otherwise not_produced." },
  { output_id: "stage12_propositions", schema_version: "stage12_propositions.v1", status: "structured", content: Stage12PropositionsSchema, note: "Proposition cards with strategic quality scores." },
  { output_id: "stage13", schema_version: "stage13.structured.v1", status: "structured", content: withText(stage13Record), note: "Credibility verdict, ownership answers and commitments." },
  { output_id: "stage13_current_position", schema_version: "stage13_current_position.v1", status: "conditional", content: Stage13CurrentPositionSchema, note: "Deal baseline or explicitly published version-aware Campaign add-on; otherwise not_produced." },
  { output_id: "stage16.agency", schema_version: "stage16.document.v1", status: "text_only", content: textDoc, note: "Final document; served as text." },
  { output_id: "stage16.consulting", schema_version: "stage16.document.v1", status: "text_only", content: textDoc, note: "Final document; served as text." },
  { output_id: "stage16.workshop", schema_version: "stage16.document.v1", status: "text_only", content: textDoc, note: "Final document; served as text." },
  { output_id: "stage16.vision", schema_version: "stage16.document.v1", status: "text_only", content: textDoc, note: "Final document; served as text." },
  { output_id: "stage16.valuation", schema_version: "stage16.document.v1", status: "text_only", content: textDoc, note: "Final document; served as text." },
  {
    output_id: "stage21_channels",
    schema_version: "stage21_channels.v1",
    status: "structured",
    content: z.record(z.string(), z.string().min(1)).refine((r) => Object.keys(r).length > 0, "at least one channel brief"),
    note: "Channel briefs keyed by channel name.",
  },
  {
    output_id: "stage22_architecture",
    schema_version: "stage22_architecture.v1",
    status: "structured",
    content: withText(
      z.object({
        domain: str,
        heritage: z.array(z.string()).min(1),
        values: z.array(z.string()).min(1),
        assets: z.array(z.string()).min(1),
        personality: z.object({ words: str, exemplar: z.string().nullable() }),
        reflection: str,
      }),
    ),
    note: "Brand architecture parsed from the fixed Stage 22 line format.",
  },
  {
    output_id: "stage22_assets",
    schema_version: "stage22_assets.v1",
    status: "structured",
    content: withText(
      z.object({
        recommended_assets: z.array(z.object({ asset: str, type: z.string().nullable() })).min(1),
        deployment_principles: z.array(z.string()).min(1),
        recognition_test: str,
      }),
    ),
    note: "Distinctive assets parsed from the fixed Stage 22 line format.",
  },
  // ── Room 04 · Creative Stimulus Engine ─────────────────────────────────
  {
    output_id: "room04.lenses",
    schema_version: "room04.lenses.v1",
    status: "structured",
    content: z.object({
      lenses: z.array(z.object({ lens_id: z.unknown(), lens_name: z.unknown(), direction: z.unknown(), campaign_line: z.unknown(), rationale: z.unknown(), status: z.unknown(), ratings: z.unknown() }).passthrough()).min(1),
    }),
    note: "Sweep directions with status and ratings.",
  },
  {
    output_id: "room04.gates",
    schema_version: "room04.gates.v1",
    status: "structured",
    content: z.object({
      gate_one: z.object({ passed: z.boolean(), at: z.string().nullable() }),
      gate_one_directions: z.array(z.object({ lens_id: z.unknown(), approved: z.boolean(), at: z.string().nullable() }).passthrough()),
      gate_two: z.array(z.object({ passed: z.boolean(), at: z.string().nullable() }).passthrough()),
    }),
    note: "Gate One and Gate Two confirmation records.",
  },
  {
    output_id: "room04.final_prompts",
    schema_version: "room04.final_prompts.v1",
    status: "structured",
    content: z.object({
      prompts: z.array(z.object({ channel_name: z.unknown(), lens_name: z.unknown(), tool_target: z.unknown(), final_prompt: str, status: z.unknown() }).passthrough()).min(1),
    }),
    note: "Final prompts only; earlier drafts are never served.",
  },
];

export const CONTRACT_BY_ID = new Map(CONTRACTS.map((c) => [c.output_id, c]));
