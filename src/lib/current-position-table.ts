// Current-position score table: baseline (evidence-supported) and each
// alternative (modelled) shown as its own score with the movement in brackets.
export const POSITION_DIMS: [string, string][] = [
  ["fame", "Fame"], ["truth_strength", "Truth"], ["competitive_impossibility", "Comp. Imp."],
  ["brand_permission", "Permission"], ["clean_air", "Clean Air"], ["commercial_precedent", "Precedent"],
];

export type PositionTableRow = { label: string; basis: "evidence-supported" | "modelled"; cells: string[] };

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const signed = (d: number) => (d > 0 ? `+${d}` : `${d}`);
const round = (n: number) => Math.round(n * 10) / 10;

export function positionTableRows(cp: Record<string, any>): PositionTableRow[] {
  const base = POSITION_DIMS.map(([k]) => num(cp[k]?.score));
  const baseComposite = num(cp.composite);
  const rows: PositionTableRow[] = [{
    label: "Current (baseline)",
    basis: "evidence-supported",
    cells: [...base, baseComposite].map((v) => (v === null ? "—" : String(v))),
  }];
  for (const d of (cp.deltas ?? []) as Record<string, any>[]) {
    const cell = (b: number | null, delta: unknown) => {
      const m = num(delta);
      if (b === null || m === null) return "—";
      return `${round(b + m)} (${signed(m)})`;
    };
    rows.push({
      label: String(d.smp),
      basis: "modelled",
      cells: [...POSITION_DIMS.map(([k], i) => cell(base[i] ?? null, d[k])), cell(baseComposite, d.composite)],
    });
  }
  return rows;
}

/** Stages whose output shows the table: Stage 10, plus the final Headroom summary (Stage 13). */
export function positionTableStages(mode: string | null | undefined): string[] {
  return mode === "headroom" ? ["10", "13"] : ["10"];
}
