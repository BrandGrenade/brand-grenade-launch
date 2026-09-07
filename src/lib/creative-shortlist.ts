// BRAND GRENADE — CREATIVE SHORTLIST (shared render)
// ============================================================================
// One renderer for rated creative directions, used by every surface that shows
// them: the Board Strategy Recommendation and the Creative Stimulus exports.
// Ratings are stored as a JSON object per direction; rendering them as a raw
// JSON dump was a defect in one place, so the formatter lives here and both
// callers read it — a fix to the table can never leave one surface behind.

export interface ShortlistDirection {
  lens_name?: string | null;
  direction?: string | null;
  campaign_line?: string | null;
  rationale?: string | null;
  status?: string | null;
  rating_status?: string | null;
  gate_one_approved?: boolean | null;
  ratings?: unknown;
}

const esc = (v: unknown): string =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

/** Canonical dimension order and display names, in the order a reader needs. */
const DIMENSIONS: Array<{ key: string; label: string }> = [
  { key: "crab", label: "CRAB (clear, relevant, appealing, believable)" },
  { key: "fame", label: "Fame" },
  { key: "brand_glue", label: "Brand glue" },
  { key: "producibility", label: "Producibility" },
  { key: "brand_integrity", label: "Brand integrity / IP" },
  { key: "creative_ambition", label: "Creative ambition" },
  { key: "creative_uniqueness", label: "Creative uniqueness" },
  { key: "strategic_compliance", label: "Strategic compliance" },
];

const titleise = (k: string) => k.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

/** The score/verdict a dimension carries, written the way a reader reads it. */
function verdictOf(key: string, value: Record<string, unknown>): string {
  if (key === "crab") {
    const parts = ["clear", "relevant", "appealing", "believable"]
      .filter((k) => value[k])
      .map((k) => `${titleise(k)} ${String(value[k])}`);
    return parts.join(" · ");
  }
  if (key === "producibility") {
    const concerns = Array.isArray(value.concerns) ? value.concerns.length : 0;
    return value.pass === false
      ? "Does not clear production"
      : concerns
        ? `Producible — ${concerns} concern${concerns === 1 ? "" : "s"} noted`
        : "Producible";
  }
  if (key === "brand_integrity") {
    const concerns = Array.isArray(value.concerns) ? value.concerns.length : 0;
    if (value.third_party_ip) return "Third-party rights involved";
    return concerns ? `${concerns} concern${concerns === 1 ? "" : "s"} noted` : "Clear";
  }
  return String(value.rating ?? value.score ?? value.verdict ?? "—");
}

/** The written judgement behind the verdict, trimmed to a readable length. */
function reasonOf(key: string, value: Record<string, unknown>): string {
  const raw =
    value.rationale ??
    value.judgement ??
    value.verdict ??
    value.note ??
    value.flag_note ??
    (key === "crab" ? value.relevant_human_truth : "") ??
    "";
  const text = String(raw ?? "").replace(/\s+/g, " ").trim();
  return text.length > 420 ? `${text.slice(0, 417)}…` : text;
}

/**
 * A formatted rating table. Never a JSON dump: an object the shape of which
 * this renderer does not recognise is reported as unrated rather than pasted
 * into a client document as machine text.
 */
export function renderRatingTable(ratings: unknown): string {
  if (!ratings || typeof ratings !== "object") {
    return `<p class="muted">This direction was not rated.</p>`;
  }
  const rec = ratings as Record<string, unknown>;
  const rows = DIMENSIONS.filter((d) => rec[d.key] && typeof rec[d.key] === "object")
    .map((d) => {
      const v = rec[d.key] as Record<string, unknown>;
      return `<tr><th>${esc(d.label)}</th><td>${esc(verdictOf(d.key, v))}</td><td>${esc(
        reasonOf(d.key, v),
      )}</td></tr>`;
    })
    .join("");
  if (!rows) return `<p class="muted">This direction was not rated.</p>`;
  return `<table class="ratings"><thead><tr><th>Dimension</th><th>Rating</th><th>Judgement</th></tr></thead><tbody>${rows}</tbody></table>`;
}

/**
 * Any rights or clearance obligation attached to a direction. A board reading
 * a recommendation has to see these, so they are returned separately and
 * rendered as their own callout rather than buried in a table row.
 */
export function ipClearanceFlag(ratings: unknown): string | null {
  if (!ratings || typeof ratings !== "object") return null;
  const integrity = (ratings as Record<string, unknown>).brand_integrity;
  if (!integrity || typeof integrity !== "object") return null;
  const v = integrity as Record<string, unknown>;
  const parts: string[] = [];
  if (v.third_party_ip) parts.push(String(v.third_party_ip));
  if (v.flag_note) parts.push(String(v.flag_note));
  if (Array.isArray(v.concerns)) parts.push(...v.concerns.map((c) => String(c)));
  const text = parts.filter(Boolean).join(" · ").replace(/\s+/g, " ").trim();
  return text || null;
}

/** True when the direction reached the keep list of the rated sweep. */
export function isShortlisted(d: ShortlistDirection): boolean {
  return d.status === "keep" || d.rating_status === "rated" || Boolean(d.gate_one_approved);
}
