import type { FidelityVerdict } from "@/lib/stage21-fidelity-types";

export type AdaptationFidelity = {
  kind: "channel_adaptation_fidelity";
  verdict: FidelityVerdict;
  score: number;
  reasoning: string;
  missing: string[];
  misreadingEvidence: string;
  lineVerbatim: boolean;
  lockedLine: string;
  checkedAt: string;
};
