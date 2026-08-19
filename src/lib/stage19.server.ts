import { formatThreeTruths, smpGoverningBlock } from "./phase2-shared";

type Stage19Session = {
  brand_name: string | null;
  category: string | null;
  selected_smp: string | null;
  stage_18_selected_detonation: string | null;
  stage_18_detonation_line: string | null;
  stage_18_output: string | null;
  stage_14b_output: string | null;
  truth_product: string | null;
  truth_consumer: string | null;
  truth_cultural: string | null;
};

function normalise(value: string | null | undefined): string {
  return (value ?? "")
    .trim()
    .replace(/[.,;:!?\s]+$/g, "")
    .toLowerCase();
}

function selectedDetonationContext(session: Stage19Session): string {
  const output = session.stage_18_output?.trim() ?? "";
  if (!output) return "—";

  const candidates = output
    .split(/(?=^##\s+Detonation Candidate\s+(?:One|Two|Three)\b)/gim)
    .filter((part) => /^##\s+Detonation Candidate\s+(?:One|Two|Three)\b/im.test(part));
  const selectedLine = normalise(session.stage_18_detonation_line);
  const selectedStatement = normalise(session.stage_18_selected_detonation);
  const selected = candidates.find((candidate) => {
    const line = candidate.match(/(?:^|\n)\s*\**\s*(?:THE\s+)?DETONATION\s+LINE\s*\**\s*:?\s*\n*[ \t]*([^\n]+)/i)?.[1];
    const statement = candidate.match(/(?:^|\n)\s*\**\s*DETONATION\s+STATEMENT\s*\**\s*:?\s*\n+([\s\S]*?)(?=\n\s*\**\s*[A-Z][A-Z ]+\s*\**\s*:|$)/i)?.[1];
    return (selectedLine && normalise(line) === selectedLine) ||
      (selectedStatement && normalise(statement) === selectedStatement);
  });

  if (!selected) return "Selected candidate detail unavailable; use only the selected line and statement above.";
  return selected.trim();
}

export function buildStage19UserMessage(session: Stage19Session): string {
  return [
    smpGoverningBlock(session.selected_smp),
    "",
    `BRAND: ${session.brand_name ?? "—"}`,
    `CATEGORY: ${session.category ?? "—"}`,
    "",
    "SELECTED DETONATION — HUMAN-LOCKED, SOLE GOVERNING DETONATION",
    `LINE: ${session.stage_18_detonation_line?.trim() || "—"}`,
    `STATEMENT: ${session.stage_18_selected_detonation?.trim() || "—"}`,
    "",
    "SELECTED DETONATION DETAIL AND COMPOUNDING ASSESSMENT",
    selectedDetonationContext(session),
    "",
    "MANDATORY SELECTION RULE",
    "Build the entire Activation Architecture only around the human-locked Detonation above. Do not infer, rank, substitute, or revive any other candidate.",
    "",
    "THREE TRUTH POSITIONING",
    formatThreeTruths({
      product: session.truth_product,
      consumer: session.truth_consumer,
      cultural: session.truth_cultural,
    }),
    "",
    "CHANNEL EXPRESSION MAPPING (Stage 14B — upstream context only)",
    session.stage_14b_output?.trim() || "—",
  ].join("\n");
}