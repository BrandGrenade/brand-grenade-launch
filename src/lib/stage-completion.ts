const STAGE_SEQUENCE = [
  "1",
  "1b",
  "2",
  "3",
  "4",
  "4b",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "11",
  "12",
  "13",
  "13b",
  "14",
  "14b",
  "14c",
  "15",
  "16",
  "17",
  "17b",
  "18",
  "19",
  "20",
  "20b",
  "21",
  "22",
] as const;

type StageStatusState = "complete" | "running" | "interrupted";

type StageCompletionRow = {
  current_stage?: number | null;
  status?: string | null;
  stage_status?: string | null;
};

function stageRank(stageId: string): number {
  const idx = STAGE_SEQUENCE.indexOf(stageId.toLowerCase() as (typeof STAGE_SEQUENCE)[number]);
  return idx === -1 ? -1 : idx;
}

function parseStageStatus(value: string | null | undefined): { state: StageStatusState; id: string } | null {
  const match = /^(complete|running|interrupted):([0-9]+[a-z]?)$/i.exec(value ?? "");
  if (!match) return null;
  return { state: match[1].toLowerCase() as StageStatusState, id: match[2].toLowerCase() };
}

export function hasStageOutput(output: unknown): boolean {
  if (typeof output === "string") return output.trim().length > 0;
  if (Array.isArray(output)) return output.length > 0;
  if (output && typeof output === "object") return Object.keys(output).length > 0;
  return output !== null && output !== undefined;
}

/**
 * Treat a persisted output as complete only when the row's stage marker proves
 * that this stage reached its terminal save, or a later stage has already begun.
 * This prevents throttled partial snapshots from being mistaken for final output.
 */
export function isStageOutputComplete(
  row: StageCompletionRow,
  stageId: string,
  numericStage: number,
  output: unknown,
): boolean {
  if (!hasStageOutput(output)) return false;
  if (row.status === "complete") return true;

  const wantedRank = stageRank(stageId);
  const marker = parseStageStatus(row.stage_status);
  if (marker && wantedRank >= 0) {
    const markerRank = stageRank(marker.id);
    if (marker.state === "complete" && markerRank >= wantedRank) return true;
    if ((marker.state === "running" || marker.state === "interrupted") && markerRank > wantedRank) {
      return true;
    }
    if (
      (marker.state === "running" || marker.state === "interrupted") &&
      markerRank === wantedRank &&
      typeof row.current_stage === "number" &&
      row.current_stage > numericStage
    ) {
      return true;
    }
    return false;
  }

  // Legacy rows pre-date `stage_status` and only have the numeric
  // `current_stage` marker. In that shape, a persisted output whose numeric
  // stage is current-or-earlier is the source of truth; otherwise reloads can
  // show stored stages as blank/pending and block advancement.
  return typeof row.current_stage === "number" && row.current_stage >= numericStage;
}
