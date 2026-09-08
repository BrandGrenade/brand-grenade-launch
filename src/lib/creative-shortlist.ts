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

/**
 * Process/telemetry fields. Rule 0: never surfaced in a client-facing document,
 * whichever dimension they are nested under.
 */
const TELEMETRY_FIELDS = new Set(["searches_run", "web_search_performed", "dramatizes_tension"]);

const titleise = (k: string) => k.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

const clean = (v: unknown) => String(v ?? "").replace(/\s+/g, " ").trim();

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

/** The written judgement behind the verdict. */
function reasonOf(key: string, value: Record<string, unknown>): string {
  const raw =
    value.rationale ?? value.judgement ?? value.verdict ?? value.note ?? value.flag_note ?? "";
  return clean(raw);
}

const sub = (label: string, text: unknown) => {
  const t = clean(text);
  return t ? `<p class="rating-sub"><span class="rating-sub-label">${esc(label)}:</span> ${esc(t)}</p>` : "";
};

const listSub = (label: string, items: unknown) => {
  if (!Array.isArray(items) || items.length === 0) return "";
  return `<p class="rating-sub"><span class="rating-sub-label">${esc(label)}:</span></p><ul class="rating-list">${items
    .map((i) => `<li>${esc(clean(i))}</li>`)
    .join("")}</ul>`;
};

/** The prose that sits beneath a dimension's row, per dimension. */
function detailOf(key: string, v: Record<string, unknown>): string {
  if (key === "crab") return sub("Relevant human truth", v.relevant_human_truth);
  if (key === "brand_glue") return sub("Reusable asset", v.reusable_asset);
  if (key === "producibility") return listSub("Concerns", v.concerns);
  if (key === "creative_uniqueness") {
    const prior = Array.isArray(v.prior_executions) ? v.prior_executions : [];
    if (prior.length === 0) return "";
    const items = prior
      .map((p) => {
        const r = (p ?? {}) as Record<string, unknown>;
        const head = [clean(r.brand), clean(r.campaign)].filter(Boolean).join(" — ");
        const year = clean(r.year);
        const url = clean(r.source_url);
        const link = url
          ? ` <a href="${esc(url)}" target="_blank" rel="noreferrer noopener">Source</a>`
          : "";
        return `<li>${esc(head)}${year ? esc(` (${year})`) : ""}: ${esc(clean(r.how_similar))}${link}</li>`;
      })
      .join("");
    return `<p class="rating-sub"><span class="rating-sub-label">Prior executions:</span></p><ul class="rating-list">${items}</ul>`;
  }
  if (key === "strategic_compliance") {
    return [
      sub("Proposition element", v.smp_element),
      sub("Tension", v.tension_note),
      sub("What can save it", v.what_can_save_it),
      sub("Journey placement", v.journey_placement),
    ].join("");
  }
  return "";
}

/** Rights/clearance callout markup, rendered as its own warning block. */
function ipCalloutHtml(ratings: unknown): string {
  const integrity =
    ratings && typeof ratings === "object"
      ? ((ratings as Record<string, unknown>).brand_integrity as Record<string, unknown> | undefined)
      : undefined;
  if (!integrity || typeof integrity !== "object") return "";
  const ip = clean(integrity.third_party_ip);
  if (!ip) return "";
  const note = clean(integrity.flag_note) || `Confirm legal review before production: ${ip}`;
  const extra = Array.isArray(integrity.concerns)
    ? integrity.concerns.map((c) => clean(c)).filter((c) => c && c !== note)
    : [];
  return `<div class="ip-callout"><p class="ip-callout-title">Rights and clearance — action required</p><p>${esc(
    note,
  )}</p><p class="rating-sub"><span class="rating-sub-label">Third-party IP</span>: ${esc(ip)}</p>${
    extra.length
      ? `<ul class="rating-list">${extra.map((c) => `<li>${esc(c)}</li>`).join("")}</ul>`
      : ""
  }</div>`;
}

/**
 * A formatted rating table. Never a JSON dump: an object whose shape this
 * renderer does not recognise is reported as unrated, and a rated object with
 * a missing dimension says so in plain language rather than falling back to
 * machine text.
 */
export function renderRatingTable(
  ratings: unknown,
  opts: { ipCallout?: boolean } = {},
): string {
  if (!ratings || typeof ratings !== "object") {
    return `<p class="muted">This direction was not rated.</p>`;
  }
  const rec = ratings as Record<string, unknown>;
  const present = DIMENSIONS.filter((d) => rec[d.key] && typeof rec[d.key] === "object");
  if (present.length === 0) return `<p class="muted">This direction was not rated.</p>`;

  const rows = present
    .map((d) => {
      const v = rec[d.key] as Record<string, unknown>;
      const detail = detailOf(d.key, v);
      const reason = reasonOf(d.key, v);
      return `<tr><th>${esc(d.label)}</th><td>${esc(verdictOf(d.key, v))}</td><td>${
        reason ? `<p>${esc(reason)}</p>` : ""
      }${detail}</td></tr>`;
    })
    .join("");

  const missing = DIMENSIONS.filter((d) => !rec[d.key] || typeof rec[d.key] !== "object").map(
    (d) => d.label,
  );
  const gap = missing.length
    ? `<p class="muted">[Incomplete score data — field missing: ${esc(missing.join(", "))}]</p>`
    : "";

  const callout = opts.ipCallout === false ? "" : ipCalloutHtml(rec);

  return `<table class="ratings"><thead><tr><th>Dimension</th><th>Rating</th><th>Judgement</th></tr></thead><tbody>${rows}</tbody></table>${gap}${callout}`;
}

/** Telemetry keys this renderer must never surface — exported for tests. */
export const SUPPRESSED_RATING_FIELDS = TELEMETRY_FIELDS;


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
