// Run progress from saved stage outputs (never the old current_stage marker),
// so stages finished by the background runner show correctly. Browser-safe.
export type RunProgressFlags = {
  current_stage?: number | null;
  has_stage_15?: boolean | null;
  has_stage_16?: boolean | null;
  has_stage_17?: boolean | null;
  has_stage_17b?: boolean | null;
  has_stage_18?: boolean | null;
  has_stage_19?: boolean | null;
  has_stage_20?: boolean | null;
  stage_20_approved?: boolean | null;
  has_stage_20b?: boolean | null;
  has_stage_21?: boolean | null;
  has_stage_22?: boolean | null;
};

export type LaterStageStatus = "complete" | "ready" | "pending";
export type LaterStage = { id: string; number: string; name: string; status: LaterStageStatus };

const LATER: Array<{ id: string; name: string; done: (f: RunProgressFlags) => boolean }> = [
  { id: "17", name: "Detonation Territory", done: (f) => !!f.has_stage_17 },
  { id: "17B", name: "Detonation Intelligence", done: (f) => !!f.has_stage_17b },
  { id: "18", name: "The Detonation", done: (f) => !!f.has_stage_18 },
  { id: "19", name: "Activation Architecture", done: (f) => !!f.has_stage_19 },
  { id: "20", name: "Detonation Brief", done: (f) => !!f.has_stage_20 && !!f.stage_20_approved },
  { id: "20B", name: "Channel Strategy", done: (f) => !!f.has_stage_20b },
  { id: "21", name: "Channel Briefs", done: (f) => !!f.has_stage_21 },
  { id: "22", name: "Brand Architecture", done: (f) => !!f.has_stage_22 },
];

/** Stages after 15, in order. The first unfinished stage after finished ones is "ready". */
export function laterStageStatuses(f: RunProgressFlags): LaterStage[] {
  const phase1Done = !!f.has_stage_15 || (f.current_stage ?? 0) >= 15;
  let prevDone = phase1Done;
  const out: LaterStage[] = LATER.map((s) => {
    const done = s.done(f);
    const status: LaterStageStatus = done ? "complete" : prevDone ? "ready" : "pending";
    prevDone = done;
    return { id: s.id, number: s.id, name: s.name, status };
  });
  // Stage 16 (document assembly) runs after Phase 2; ready once Stage 15 exists.
  out.push({
    id: "16",
    number: "16",
    name: "Document Assembly",
    status: f.has_stage_16 ? "complete" : phase1Done ? "ready" : "pending",
  });
  return out;
}

/** Furthest stage reached, from saved outputs, e.g. "21" when 20B is done. */
export function furthestStageLabel(f: RunProgressFlags): string {
  const later = laterStageStatuses(f).filter((s) => s.id !== "16");
  const lastDone = [...later].reverse().find((s) => s.status === "complete");
  if (!lastDone) return String(f.current_stage ?? 1);
  const idx = later.indexOf(lastDone);
  return later[idx + 1]?.number ?? lastDone.number;
}
