// Maps an Intelligence Lab session row's ingested research fields into the
// named evidence sources used by the shared "Current state versus recommended
// change" derivation. One place, so every 00A caller attributes identically.

import { SYNTHESISER_CATEGORIES } from "../synthesiser/types";

export const RESEARCH_INPUT_COLUMNS = [
  "territory_input",
  "additional_context",
  ...SYNTHESISER_CATEGORIES.map((c) => c.key),
] as const;

const EXTRA_LABELS: Record<string, string> = {
  territory_input: "Territory input (client brief)",
  additional_context: "Additional context supplied with the brief",
};

export function researchEvidenceFromSession(
  row: Record<string, unknown> | null | undefined,
): { label: string; text: string }[] {
  if (!row) return [];
  const labelFor = (key: string) =>
    EXTRA_LABELS[key] ?? SYNTHESISER_CATEGORIES.find((c) => c.key === key)?.title ?? key;
  return RESEARCH_INPUT_COLUMNS.map((key) => ({
    label: labelFor(key),
    text: typeof row[key] === "string" ? (row[key] as string) : "",
  })).filter((e) => e.text.trim().length > 0);
}
