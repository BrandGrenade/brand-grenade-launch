export interface PipelineStage {
  id: string;
  number: string;
  name: string;
  conditional?: boolean;
  checkpoint?: boolean;
}

export const PIPELINE_STAGES: PipelineStage[] = [
  { id: "01", number: "01", name: "Brief Analysis", checkpoint: true },
  { id: "01B", number: "01B", name: "Brief Enhancement", conditional: true },
  { id: "02", number: "02", name: "Category Intelligence" },
  { id: "03", number: "03", name: "Strategic Frameworks" },
  { id: "04", number: "04", name: "Strategic Universes" },
  { id: "04B", number: "04B", name: "Asset Mining & Product Facts" },
  { id: "05", number: "05", name: "Insight Generation" },
  { id: "06", number: "06", name: "Insight Validation" },
  { id: "07", number: "07", name: "Territory Synthesis" },
  { id: "08", number: "08", name: "Proposition Generation", checkpoint: true },
  { id: "08B", number: "08B", name: "Left-of-Centre Engines" },
  { id: "09", number: "09", name: "Distinctiveness Check" },
  { id: "10", number: "10", name: "Proposition Scoring" },
  { id: "11", number: "11", name: "Integrity Testing" },
  { id: "12", number: "12", name: "Proposition Selection", checkpoint: true },
  { id: "13", number: "13", name: "Brand Fit Validation" },
  { id: "13B", number: "13B", name: "Historical Validation", conditional: true },
  { id: "14", number: "14", name: "Territory Mapping" },
  { id: "14B", number: "14B", name: "Channel Expression", conditional: true },
  { id: "14C", number: "14C", name: "Brand World Definition", conditional: true },
  { id: "15", number: "15", name: "Coherence Audit" },
];

// Stage keys and display numbers are identifiers, never numeric operands.
export function nextPipelineStage(id: string, briefEnhancement: boolean, runMode = "full"): PipelineStage | null {
  const index = PIPELINE_STAGES.findIndex((stage) => stage.id === id);
  if (index < 0) return null;
  const remaining = PIPELINE_STAGES.slice(index + 1);
  return remaining.find((stage) =>
    (stage.id !== "01B" || briefEnhancement) &&
    (runMode !== "diagnostic" || PIPELINE_STAGES.indexOf(stage) <= PIPELINE_STAGES.findIndex((s) => s.id === "13"))
  ) ?? null;
}

export function pipelineContinueLabel(next: PipelineStage | null, terminal: boolean, diagnostic: boolean): string {
  if (next) return `Continue to Stage ${next.number.replace(/^0(?=\d)/, "")} — ${next.name} →`;
  if (terminal) return diagnostic ? "Return to Dashboard →" : "Begin Brand Detonation →";
  return diagnostic ? "Diagnostic ends after Stage 13" : "Continue →";
}