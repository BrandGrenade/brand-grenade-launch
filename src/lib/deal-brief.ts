// Deal brief type (T1). Client-safe pure module: shared by the brief form,
// createSession validation, the Stage 1–13 framing block and the access point.
import { z } from "zod";

export const BRIEF_TYPES = ["campaign", "deal"] as const;
export type BriefType = (typeof BRIEF_TYPES)[number];

export const TRANSACTION_TYPES = ["buy-side", "sell-side", "exit", "carve-out", "post-merger"] as const;
export const DEAL_DEPTHS = ["outside-in", "data-room"] as const;

const list = z.array(z.string().trim().min(1).max(500)).min(1).max(30);

export const DealFieldsSchema = z.object({
  transactionType: z.enum(TRANSACTION_TYPES),
  targetBrands: list,
  decisionQuestions: list,
  competitors: list,
  decisionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  depth: z.enum(DEAL_DEPTHS),
});
export type DealFields = z.infer<typeof DealFieldsSchema>;

/** Splits a one-per-line textarea into a clean list. */
export function linesToList(s: string): string[] {
  return s.split(/\r?\n/).map((l) => l.replace(/^\s*[-•*\d.)]+\s*/, "").trim()).filter(Boolean);
}

/** Stages that receive the deal framing block (1–13 including 1B and 4B). */
export function isDealFramedStage(stageNumber: string | undefined): boolean {
  if (!stageNumber) return false;
  return /^(1b?|2|3|4b?|5|6|7|8|9|10|11|12|13)$/i.test(stageNumber.trim());
}

export type DealRow = {
  brief_type?: string | null;
  deal_transaction_type?: string | null;
  deal_target_brands?: string[] | null;
  deal_decision_questions?: string[] | null;
};

export const DEAL_CONTEXT_MARKER = "[DEAL CONTEXT]";

/** Context block appended to the user message for Deal runs; null for Campaign. */
export function buildDealContext(row: DealRow | null | undefined): string | null {
  if (!row || row.brief_type !== "deal") return null;
  const qs = (row.deal_decision_questions ?? []).filter((q) => q.trim());
  if (!row.deal_transaction_type && qs.length === 0) return null;
  const targets = (row.deal_target_brands ?? []).filter(Boolean);
  return [
    "",
    "",
    DEAL_CONTEXT_MARKER,
    "This run supports a transaction decision, not a campaign.",
    `Transaction type: ${row.deal_transaction_type ?? "not stated"}`,
    ...(targets.length ? [`Target brand(s): ${targets.join("; ")}`] : []),
    "Decision questions the analysis must address:",
    ...qs.map((q, i) => `${i + 1}. ${q}`),
    "Address these questions within this stage's existing output format. Do not change the format, sections or scoring.",
    "[/DEAL CONTEXT]",
  ].join("\n");
}

/** brief_type + deal fields as exposed by the access point. */
export function dealSummary(row: Record<string, unknown>) {
  const bt = row.brief_type === "deal" ? "deal" : "campaign";
  return {
    brief_type: bt,
    deal:
      bt === "deal"
        ? {
            transaction_type: (row.deal_transaction_type as string | null) ?? null,
            target_brands: (row.deal_target_brands as string[] | null) ?? [],
            decision_questions: (row.deal_decision_questions as string[] | null) ?? [],
            current_proposition: (row.current_proposition as string | null) ?? null,
            current_proposition_source: (row.current_proposition_source as string | null) ?? null,
            current_proposition_date: (row.current_proposition_date as string | null) ?? null,
            competitors: (row.deal_competitors as string[] | null) ?? [],
            decision_date: (row.deal_decision_date as string | null) ?? null,
            depth: (row.deal_depth as string | null) ?? null,
          }
        : null,
  };
}
