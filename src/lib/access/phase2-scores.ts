// Read-only Phase 2 score exposure for the Partner Hub (stage17, stage18,
// stage20). Every value is copied verbatim from saved stage text or saved
// fields — never converted, mapped, recomputed or estimated. A value that
// cannot be found exactly once returns not_produced with a named reason.
export const PARSED = "parsed from stage text" as const;
export const SAVED_FIELD = "saved field" as const;

export type Found = { status: "produced"; value: string; source: { stage: string; field: string; text: string }; source_flag: typeof PARSED | typeof SAVED_FIELD };
export type Missing = { status: "not_produced"; reason: string; source: { stage: string; field: string } };
export type Value = Found | Missing;

const miss = (stage: string, field: string, reason: string): Missing => ({ status: "not_produced", reason, source: { stage, field } });
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** One line `<label>: <value>` exactly once in `text`; value must match `allowed`. */
function labelled(text: string, label: string, allowed: RegExp, stage: string, field: string): Value {
  const re = new RegExp(`^[ \\t]*${esc(label)}:[ \\t]*(.+?)[ \\t]*$`, "gm");
  const hits = [...text.matchAll(re)];
  if (hits.length === 0) return miss(stage, field, `"${label}" not found in saved text`);
  if (hits.length > 1) return miss(stage, field, `"${label}" appears ${hits.length} times; ambiguous`);
  const v = hits[0][1];
  if (!allowed.test(v)) return miss(stage, field, `"${label}" value "${v}" is not in the expected form`);
  return { status: "produced", value: v, source: { stage, field, text: hits[0][0].trim() }, source_flag: PARSED };
}

function savedField(v: unknown, stage: string, field: string): Value {
  return typeof v === "string" && v.trim() !== ""
    ? { status: "produced", value: v, source: { stage, field, text: v }, source_flag: SAVED_FIELD }
    : miss(stage, field, `${field} is empty`);
}

// ── Stage 17 ──────────────────────────────────────────────────────────────
export const CSOV_LABELS = ["Emotional Weight", "Fame Potential", "Distinctive Asset Leverage"] as const;
const HML = /^(HIGH|MEDIUM|LOW)$/;
const heading = (s: string) => s.replace(/^#+\s*/, "").trim();

export function stage17Scores(output: unknown, selected: unknown) {
  const F = "stage_17_output";
  if (typeof output !== "string" || !output.trim()) return null;
  const lines = output.split("\n");
  const starts: { name: string; at: number }[] = [];
  lines.forEach((l, i) => {
    if (l.trim() !== "WHY THIS TERRITORY SERVES THE SMP:") return;
    let j = i - 1;
    while (j >= 0 && !lines[j].trim()) j--;
    starts.push({ name: j >= 0 ? heading(lines[j]) : "", at: j >= 0 ? j : i });
  });
  const territories = starts.map((s, k) => {
    const block = lines.slice(s.at, k + 1 < starts.length ? starts[k + 1].at : lines.length).join("\n");
    const scores = Object.fromEntries(CSOV_LABELS.map((l) => [l, labelled(block, l, HML, "17", F)]));
    return { territory: s.name || null, creative_share_of_voice: scores };
  });
  const firstLine = typeof selected === "string" ? selected.split("\n").find((l) => l.trim()) : undefined;
  const selName = firstLine ? heading(firstLine) : null;
  const matches = selName ? territories.filter((t) => t.territory === selName) : [];
  const selectedTerritory = !selName
    ? miss("17", "stage_17_selected_territory", "No territory selected")
    : matches.length !== 1
      ? miss("17", "stage_17_selected_territory", matches.length ? `Selected territory "${selName}" appears ${matches.length} times; ambiguous` : `Selected territory "${selName}" not found in saved Stage 17 text`)
      : ({ status: "produced", value: firstLine!.trim(), source: { stage: "17", field: "stage_17_selected_territory", text: firstLine!.trim() }, source_flag: PARSED } as Found);
  const selectedScores = matches.length === 1 ? matches[0].creative_share_of_voice
    : Object.fromEntries(CSOV_LABELS.map((l) => [l, miss("17", F, "Selected territory could not be matched unambiguously")]));
  return { scale: "HIGH / MEDIUM / LOW (as written)", selected_territory: selectedTerritory, selected_creative_share_of_voice: selectedScores, territories };
}

// ── Stage 18 ──────────────────────────────────────────────────────────────
const NUM = /^\d+(?:\.\d+)?$/;
export function stage18Scores(output: unknown, detonation: unknown, line: unknown) {
  const F = "stage_18_output";
  if (typeof output !== "string" || !output.trim()) return null;
  const header = "EIGHT DIMENSION STRESS TEST RESULTS:";
  const n = output.split(header).length - 1;
  let dimensions: Value[] | Missing;
  let section = "";
  if (n !== 1) dimensions = miss("18", F, n ? `"${header}" appears ${n} times; ambiguous` : `"${header}" not found in saved text`);
  else {
    section = output.slice(output.indexOf(header) + header.length);
    const end = section.search(/^COMPOSITE:/m);
    const body = end >= 0 ? section.slice(0, end) : section;
    const hits = [...body.matchAll(/^([A-Z][^,\n]{2,60}), (\d+(?:\.\d+)?)\.(?=\s|$)/gm)];
    const names = new Set(hits.map((h) => h[1]));
    dimensions = hits.length === 8 && names.size === 8
      ? hits.map((h) => ({ status: "produced", value: h[2], dimension: h[1], source: { stage: "18", field: F, text: `${h[1]}, ${h[2]}.` }, source_flag: PARSED }) as Found & { dimension: string })
      : miss("18", F, `Expected 8 distinct "<dimension>, <score>." lines; found ${hits.length}`);
  }
  return {
    // Runs scored before 25 Nov 2026 wrote "/90"; the corrected prompt writes "/80". Report the scale as written.
    scale: { dimension: "as written per dimension", composite: /\/80\b/.test(output) && !/\/90\b/.test(output) ? "/80" : "/90" },
    dimensions,
    composite: labelled(output, "COMPOSITE", /^\d+(?:\.\d+)?\/(?:80|90)$/, "18", F),
    status: labelled(output, "STATUS", /^\S.*$/, "18", F),
    selected_detonation: savedField(detonation, "18", "stage_18_selected_detonation"),
    detonation_line: savedField(line, "18", "stage_18_detonation_line"),
  };
}
void NUM;

// ── Stage 20 ──────────────────────────────────────────────────────────────
export const BQS_LABELS = ["Emotional Clarity", "Fame Invitation", "Distinctive Asset Integration", "Psychological Leverage", "Creative SoV Ambition"] as const;
export function stage20Scores(output: unknown, approved: unknown) {
  const F = "stage_20_output";
  if (typeof output !== "string" || !output.trim()) return null;
  return {
    scale: { dimension: "/10", composite: "/50" },
    dimensions: Object.fromEntries(BQS_LABELS.map((l) => [l, labelled(output, l, /^\d+(?:\.\d+)?\/10$/, "20", F)])),
    composite: labelled(output, "COMPOSITE", /^\d+(?:\.\d+)?\/50$/, "20", F),
    status: labelled(output, "STATUS", /^\S.*$/, "20", F),
    approved: typeof approved === "boolean" ? approved : null,
  };
}

export const PHASE2_FIELD_SCHEMA = {
  value_shape: "{ status: 'produced', value: string (verbatim), source: { stage, field, text }, source_flag } | { status: 'not_produced', reason, source: { stage, field } }",
  stage17: { "selected_territory": "value", "selected_creative_share_of_voice": CSOV_LABELS.join(" | ") + ": value (HIGH/MEDIUM/LOW as written)", territories: "array of { territory, creative_share_of_voice }" },
  stage18: { dimensions: "8 values with dimension name (score as written)", composite: "value (n/80; runs scored before 25 Nov 2026 read n/90)", status: "value", selected_detonation: "value (saved field)", detonation_line: "value (saved field)" },
  stage20: { dimensions: BQS_LABELS.join(" | ") + ": value (n/10)", composite: "value (n/50)", status: "value", approved: "boolean | null" },
} as const;
