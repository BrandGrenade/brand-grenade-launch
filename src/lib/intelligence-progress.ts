export interface IntelligenceProgressInput {
  status: string | null;
  stage_status: string | null;
  current_layer: number | null;
  updated_at: string | null;
}

export function intelligenceProgress(row: IntelligenceProgressInput, now: number) {
  const raw = row.current_layer ?? Number(/^(?:running|complete):(\d+)$/.exec(row.stage_status ?? "")?.[1] ?? 0);
  const marker = Number.isFinite(raw) ? Math.max(0, Math.min(10, Math.floor(raw))) : 0;
  const complete = row.status === "complete";
  const savedAt = row.updated_at ? Date.parse(row.updated_at) : NaN;
  return {
    confirmed: complete ? 10 : 0,
    marker: complete ? 10 : marker,
    queued: row.stage_status === "queued",
    quietSeconds: Number.isFinite(savedAt) ? Math.max(0, Math.floor((now - savedAt) / 1000)) : null,
  };
}