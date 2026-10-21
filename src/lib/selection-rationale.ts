import { z } from "zod";

export const RATIONALE_FIELDS = [
  { key: "f1", label: "Why this proposition over the alternatives?" },
  { key: "f2", label: "What strategic priority drove this selection?" },
  { key: "f3", label: "What does this selection set in motion?" },
  { key: "f4", label: "What was sacrificed by not selecting the alternatives?" },
  { key: "f5", label: "What must the brand commit to in order to own this?" },
  { key: "f6", label: "Is there anything about this selection that requires human strategic review?" },
] as const;

const requiredAnswer = z.string().max(5000).refine((v) => v.trim().length > 0, "Selection rationale is incomplete");
export const selectionRationaleSchema = z.object({
  f1: requiredAnswer, f2: requiredAnswer, f3: requiredAnswer, f4: requiredAnswer,
  f5: z.string().max(5000).optional(), f6: z.string().max(5000).optional(),
  f_loc_legacy: z.string().max(5000).optional(),
});

export function selectionRationaleText(smp: string, rationale: Record<string, string>): string {
  return `Selection Confirmed\n\n${smp}\n\n${RATIONALE_FIELDS.map((f) => `${f.label}\n\n${rationale[f.key] ?? ""}`).join("\n\n")}${rationale.f_loc_legacy ? `\n\nLegacy relationship\n\n${rationale.f_loc_legacy}` : ""}\n\nDownstream Pipeline Direction\n\nCarry the selected proposition and these human-authored answers verbatim into the downstream assessment. Treat the human strategic review answer as a binding guard-rail.\n\nCheckpoint C Confirmation\n\nConfirmed with the saved selection rationale.`;
}

export function fillSelectionDeliverable(output: string, smp: string, rationale: Record<string, string>): string {
  const result = selectionRationaleText(smp, rationale);
  const section = /={2,}\s*DELIVERABLE 3[^\n]*\n[\s\S]*?(?=\n={2,}\s*(?:PRESENTATION ORDER|SELF-AUDIT)|$)/i;
  const filled = `==== DELIVERABLE 3 — SELECTION RATIONALE ====\n\n${result}\n`;
  return section.test(output) ? output.replace(section, () => filled) : `${output}\n\n${filled}`;
}