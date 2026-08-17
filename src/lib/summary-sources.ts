// Jaguar summary — scoped source readers.
//
// Every section of the rebuild reads its content through a named reader here
// rather than dumping a whole stage output into a card. That is the single
// mechanism behind the boundary-bleed class of defect: a section can only ever
// contain the block it asked for, so a stage that carries several sections'
// worth of material cannot leak into a neighbour.

export interface MdBlock {
  heading: string;
  body: string;
}

/** Removes standalone rule lines and un-collapses "--- ## Heading" runs. */
export function normaliseMd(text: string): string {
  return text
    .split("\n")
    .flatMap((line) => {
      const t = line.trim();
      const glued = t.match(/^[-*_]{3,}\s*(#{1,6}\s+.+)$/);
      if (glued) return ["", glued[1]];
      if (/^[-*_]{3,}$/.test(t)) return [""];
      return [line];
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Splits markdown into `## heading` blocks. Text before the first heading is dropped. */
export function mdBlocks(text: string): MdBlock[] {
  const out: MdBlock[] = [];
  let current: MdBlock | null = null;
  for (const line of normaliseMd(text).split("\n")) {
    const m = line.match(/^#{2,4}\s+(.+?)\s*$/);
    if (m) {
      if (current) out.push(current);
      current = { heading: m[1].replace(/\*\*/g, "").trim(), body: "" };
      continue;
    }
    if (current) current.body += `${line}\n`;
  }
  if (current) out.push(current);
  return out.map((b) => ({ heading: b.heading, body: b.body.trim() }));
}

/** The named `## heading` block of a stage output, body only. */
export function mdBlock(text: string, match: RegExp): string {
  return mdBlocks(text).find((b) => match.test(b.heading))?.body ?? "";
}

/** Blocks introduced by an ALL-CAPS label line (`TERRITORY NAME:` style). */
export function labelledBlocks(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  let key = "";
  for (const raw of normaliseMd(text).split("\n")) {
    const m = raw.match(/^([A-Z][A-Z0-9 '’/&-]{3,60}):\s*(.*)$/);
    if (m) {
      key = m[1].trim();
      out[key] = m[2].trim();
      continue;
    }
    if (key) out[key] = `${out[key]}\n${raw}`.trim();
  }
  return out;
}

/**
 * The Recognition Test written at Stage 22 — the closing paragraph of the
 * locked creative idea, stating when the work passes and when it fails.
 * Reproduced verbatim; never clamped.
 */
export function extractRecognitionTest(stage22: string): string {
  const text = normaliseMd(stage22);
  const i = text.search(/THE RECOGNITION TEST\s*:?/i);
  if (i < 0) return "";
  const tail = text.slice(i).replace(/^THE RECOGNITION TEST\s*:?\s*/i, "");
  return tail
    .split(/\n(?=[A-Z][A-Z ()]{3,}\s*:)/)[0]
    .replace(/\s+/g, " ")
    .trim();
}

export interface BrandArchitecture {
  assets: string[];
  principles: string[];
  reflection: string;
  personality: string;
}

/** Stage 22, read once, with no block returned twice. */
export function extractBrandArchitecture(stage22: string): BrandArchitecture {
  const text = normaliseMd(stage22);
  const grab = (label: RegExp): string => {
    const i = text.search(label);
    if (i < 0) return "";
    const rest = text.slice(i).replace(label, "");
    // A block ends at the next LABEL: line OR the next markdown heading —
    // stage 22 is written both ways depending on the session.
    return rest.split(/\n(?=(?:#{1,4}\s)|(?:[A-Z][A-Z ()]{3,}\s*:))/)[0].trim();
  };
  const bullets = (s: string) =>
    s
      .split("\n")
      .map((l) => l.replace(/^\s*(?:[-*•]|\d+\.)\s*/, "").trim())
      .filter((l) => l.length > 2);

  return {
    // Stage 22 labels its two lists differently depending on the session.
    assets: bullets(grab(/(?:RECOMMENDED|OWNABLE|DISTINCTIVE)\s+ASSETS\s*:?\s*/i)),
    principles: bullets(
      grab(/(?:DEPLOYMENT PRINCIPLES|ACTIVATION RULES|DEPLOYMENT RULES)\s*:?\s*/i),
    ),
    reflection: grab(/REFLECTION\s*:\s*/i).split("\n")[0]?.trim() ?? "",
    personality: grab(/PERSONALITY\s*:\s*/i).split("\n")[0]?.trim() ?? "",
  };
}

export interface DetonationCandidate {
  label: string;
  line: string;
  statement: string;
}

/** The three Detonation candidates written at Stage 18. */
export function extractDetonationCandidates(stage18: string): DetonationCandidate[] {
  const text = normaliseMd(stage18);
  const marks = [...text.matchAll(/^\s*#{0,4}\s*DETONATION (?:CANDIDATE\s+)?(ONE|TWO|THREE)\b.*$/gim)];
  const out: DetonationCandidate[] = [];
  const byOrdinal = new Map<string, DetonationCandidate>();
  marks.forEach((m, i) => {
    const body = text.slice(m.index! + m[0].length, marks[i + 1]?.index ?? text.length);
    const fields = labelledBlocks(body);
    // Stage 18 labels these fields two ways depending on the session.
    const pick = (...keys: string[]) => keys.map((k) => fields[k]).find((v) => (v ?? "").trim()) ?? "";
    const line = pick("THE DETONATION LINE", "DETONATION LINE")
      .split("\n")[0]
      .replace(/^["“]|["”]$/g, "")
      .trim();
    const statement = pick(
      "THE DETONATION STATEMENT",
      "DETONATION STATEMENT",
      "WHY THIS DETONATION SERVES THE SMP",
    )
      .replace(/\s+/g, " ")
      .trim();

    if (line || statement) {
      // A "DETONATION ONE — REPLACEMENT" block supersedes the original: keep
      // the last block written for each ordinal, never both.
      byOrdinal.set(m[1].toUpperCase(), {
        label: `Detonation ${m[1].toLowerCase()}`,
        line,
        statement,
      });
    }
  });
  for (const key of ["ONE", "TWO", "THREE"]) {
    const hit = byOrdinal.get(key);
    if (hit) out.push(hit);
  }
  return out;
}

/**
 * A channel brief's own CHANNEL ROLE statement. Process narration ("Before any
 * brief is written…") is never a role, so it is filtered out explicitly.
 */
const PROCESS_NARRATION =
  /^(before any|this brief|the following|note[: ]|first,|to begin|we begin|as with)/i;

export function extractChannelRole(brief: string, maxSentences = 2): string | null {
  const text = normaliseMd(brief);
  const roleIdx = text.search(/CHANNEL ROLE\s*:?/i);
  let scope =
    roleIdx >= 0
      ? text.slice(roleIdx).replace(/^[\s\S]*?CHANNEL ROLE\s*:?\s*/i, "")
      : text;
  scope = scope.split(/\n(?=#{1,4}\s|[A-Z][A-Z ()]{5,}\s*:)/)[0];

  const sentences = scope
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#") && !l.startsWith(">") && !/^[A-Z][A-Z ()]{5,}:?$/.test(l))
    .join(" ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 40 && !PROCESS_NARRATION.test(s));

  const picked = sentences.slice(0, maxSentences).join(" ").trim();
  return picked || null;
}

/** Drops internal review annotations from a scoring rationale. */
export function stripAuditMarkers(note: string): string {
  return note
    .replace(
      /\b(CORRECTED ON REVIEW|RE-?RUN UNDER CORRECTED ANCHORS|RECENCY RE-?EVALUATION|RE-?SCORED ON REVIEW|CONFIRMED ON REVIEW)\b\s*(\([^)]*\))?\s*[.:—-]*\s*/gi,
      "",
    )
    .replace(/\bwas \d{1,2}\/10\b\s*[.)]?\s*/gi, "")
    .replace(/^\(\s*\)\s*/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Cuts to a sentence boundary, and never mid-word. */
export function safeClamp(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const head = text.slice(0, maxChars);
  const sentence = Math.max(head.lastIndexOf(". "), head.lastIndexOf(".\n"));
  if (sentence > maxChars * 0.4) return head.slice(0, sentence + 1).trim();
  const word = head.lastIndexOf(" ");
  return `${(word > 0 ? head.slice(0, word) : head).replace(/[,;:—-]+$/, "").trim()}…`;
}

export function sentences(text: string, count: number): string {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .slice(0, count)
    .join(" ")
    .trim();
}

export interface WinnerScore {
  dimension: string;
  score: string;
  rationale: string;
}

/**
 * The six-dimension score block written against the selected proposition.
 * Read from the last block that names it, which is the independent re-score.
 */
export function extractWinnerScores(stage10: string, smp: string): WinnerScore[] {
  const text = normaliseMd(stage10);
  const needle = smp.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  const marks = [...text.matchAll(new RegExp(`SMP:\\s*["“]?${needle}["”]?`, "gi"))];
  if (!marks.length) return [];
  const start = marks[marks.length - 1].index!;
  const endRel = text.slice(start).search(/\n\s*(?:CODE VERDICT|====|##\s)/);
  const block = text.slice(start, endRel > 0 ? start + endRel : text.length);

  const out: WinnerScore[] = [];
  // Review annotations are removed before this parser runs. That can leave
  // either the original score separator ("7/10 — rationale") or a sentence
  // stop ("7/10. Rationale"). Accept both forms: the latter previously made
  // the regex consume Brand Permission, Clean Air and Commercial Precedent as
  // part of the preceding Competitive Impossibility rationale.
  const scoreLine = String.raw`\n\s*\**[A-Z][A-Za-z /-]{3,40}\**\s*:\**\s*\d{1,2}\s*\/\s*10`;
  const re = new RegExp(
    String.raw`^\s*\**([A-Z][A-Za-z /-]{3,40})\**\s*:\**\s*(\d{1,2})\s*\/\s*10\s*(?:[—–-]|\.)\s*([\s\S]*?)(?=${scoreLine}|$)`,
    "gm",
  );
  let m: RegExpExecArray | null;
  while ((m = re.exec(block))) {
    const rationale = stripAuditMarkers(m[3].replace(/\s+/g, " ").trim());
    out.push({ dimension: m[1].trim(), score: `${m[2]}/10`, rationale });
  }
  return out;
}

export interface ImpossibilityAnalysis {
  heading: string;
  /** True when the block read is the stage's own commentary, not a named candidate. */
  generic: boolean;
  foundation: string;
  rivals: string[];
  proof: string;
}

/**
 * One candidate's Left-of-Centre analysis, read whole.
 *
 * Section 08 previously condensed the raw stage output, which cut the rival
 * list after its first bullet (Tesla) and deleted Porsche, Mercedes, BMW,
 * Lucid/Rivian and Bentley outright. The block is now read structurally so the
 * "cannot run this" argument always renders complete.
 */
export function extractImpossibilityAnalysis(
  stage9: string,
  preferred = "",
): ImpossibilityAnalysis | null {
  const blocks = mdBlocks(stage9);
  if (!blocks.length) return null;
  const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  // A leading "Distinctiveness Assessment"/"Overview" block is the stage's own
  // preamble, not a candidate. Never pressure-test the preamble.
  const GENERIC =
    /^(distinctiveness assessment|overview|summary|introduction|assessment|category differentiation|strategic uniqueness|territory claimed|conclusion|verdict|strategic impossibility analysis|impossibility analysis|distinctiveness testing|set assessment|assessment summary|analysis)$/;
  const candidates = blocks.filter((b) => !GENERIC.test(key(b.heading)));
  const pool = candidates.length ? candidates : blocks;
  const want = key(preferred);
  const wantWords = new Set(want.split(" ").filter((w) => w.length > 3));
  const overlap = (b: MdBlock) => {
    const words = key(`${b.heading} ${b.body}`).split(" ");
    let hit = 0;
    for (const w of wantWords) if (words.includes(w)) hit++;
    return hit;
  };
  const named =
    want && pool.find((b) => key(b.heading).includes(want) || want.includes(key(b.heading)));
  const scored = wantWords.size
    ? [...pool].sort((a, b) => overlap(b) - overlap(a))[0]
    : undefined;
  const block = named || (scored && overlap(scored) > 0 ? scored : pool[0]);

  const body = block.body;
  const label = (re: RegExp) => {
    const i = body.search(re);
    if (i < 0) return "";
    const rest = body.slice(i).replace(re, "");
    return rest.split(/\n\s*\n(?=\**[A-Z])/)[0].trim();
  };

  let foundation = label(/\*\*The Foundation\.\*\*\s*/i).replace(/\s+/g, " ").trim();
  const analysis = label(/\*\*Strategic-Impossibility Analysis\.\*\*\s*/i);
  const rivals = analysis
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /^[-*•]\s/.test(l))
    .map((l) => l.replace(/^[-*•]\s*/, "").trim())
    .filter(Boolean);
  const proof = (body.match(/^>\s*(.+)$/m)?.[1] ?? "").trim();

  // Sessions whose stage 9 is written without the labelled sub-blocks still
  // have exactly one candidate block of their own: read it whole as prose,
  // scoped to this candidate, rather than rendering an empty section.
  if (!foundation && !rivals.length) {
    const prose = body
      .split("\n")
      .filter((l) => !/^>\s/.test(l) && !/^#{1,4}\s/.test(l))
      .join("\n")
      .replace(/\*\*/g, "")
      .trim();
    if (!prose) return null;
    foundation = prose.replace(/\s+/g, " ").trim();
  }

  return { heading: block.heading, generic: GENERIC.test(key(block.heading)), foundation, rivals, proof };
}

/**
 * Every named strategic territory in a Stage 7 output. Used to build the
 * foreign-marker set: a territory name owned by another session must never
 * appear in this session's document.
 */
export function extractTerritoryNames(stage7: unknown): string[] {
  if (typeof stage7 !== "string" || !stage7.trim()) return [];
  const names = mdBlocks(stage7)
    .map((b) => b.heading.replace(/^territory\s*\d*\s*[:—–-]\s*/i, "").replace(/["“”]/g, "").trim())
    // Section labels a stage writes about itself are not territory names.
    .filter((h) => !/^(overview|summary|introduction|conclusion|verdict|assessment|analysis|the territories|territories|recommendation|next steps)$/i.test(h));
  return [...new Set(names)].filter((n) => n.length > 8 && n.split(/\s+/).length <= 12);
}

/**
 * Markers owned by other sessions, with anything this session legitimately
 * says itself removed — a name shared by two sessions is not contamination.
 */
export function buildForeignMarkers(
  others: Array<Record<string, unknown>>,
  ownCorpus: string,
): string[] {
  const own = ownCorpus.toLowerCase();
  const raw = others.flatMap((row) => [
    typeof row.selected_smp === "string" ? row.selected_smp : "",
    typeof row.locked_campaign_line === "string" ? row.locked_campaign_line : "",
    ...extractTerritoryNames(row.stage_7_output),
  ]);
  return [...new Set(raw.map((v) => v.trim()).filter((v) => v.length > 12))].filter(
    (v) => !own.includes(v.toLowerCase()),
  );
}

/** All stage text a session owns, for own-content comparison. */
export function ownStageCorpus(session: Record<string, unknown>): string {
  return Object.entries(session)
    .filter(([k, v]) => /^stage_/.test(k) && v != null)
    .map(([, v]) => (typeof v === "string" ? v : JSON.stringify(v)))
    .join("\n");
}

export interface SelectedDetonation {
  line: string;
  statement: string;
  rationale: string;
}

/**
 * The Stage 18 Detonation the session actually selected, read whole.
 *
 * Sessions that ran before the Creative Engine existed have no locked big
 * idea; their creative decision is the selected Detonation. Section 17 falls
 * back to this so the document states what was actually chosen rather than
 * printing an empty section.
 */
export function extractSelectedDetonation(
  stage18: string,
  selectedStatement = "",
  selectedLine = "",
): SelectedDetonation | null {
  if (!stage18?.trim()) return null;
  const text = normaliseMd(stage18);
  const marks = [...text.matchAll(/^\s*#{0,4}\s*DETONATION (?:CANDIDATE\s+)?(ONE|TWO|THREE)\b.*$/gim)];
  if (!marks.length) return null;

  const blocks = marks.map((m, i) => ({
    ordinal: m[1].toUpperCase(),
    body: text.slice(m.index! + m[0].length, marks[i + 1]?.index ?? text.length),
  }));

  const needle = selectedStatement.replace(/\s+/g, " ").trim().slice(0, 70).toLowerCase();
  const lineNeedle = selectedLine.replace(/\s+/g, " ").trim().toLowerCase();
  const ordinalFromLabel = lineNeedle.match(/^detonation (one|two|three)$/)?.[1]?.toUpperCase();
  const chosen =
    (needle &&
      blocks.find((b) => b.body.replace(/\s+/g, " ").toLowerCase().includes(needle))) ||
    (ordinalFromLabel && blocks.find((b) => b.ordinal === ordinalFromLabel)) ||
    (lineNeedle &&
      !ordinalFromLabel &&
      blocks.find((b) => b.body.toLowerCase().includes(lineNeedle))) ||
    blocks[blocks.length - 1];
  if (!chosen) return null;

  const fields = labelledBlocks(chosen.body);
  const clean = (v: string) => (v ?? "").replace(/\*\*/g, "").trim();
  let line = clean((fields["THE DETONATION LINE"] ?? "").split("\n")[0]).replace(
    /^["“]|["”]$/g,
    "",
  );
  if (!line) {
    // Some sessions title the Detonation on its own line instead of labelling it.
    line =
      chosen.body
        .split("\n")
        .map((l) => clean(l))
        .find((l) => l && !/:/.test(l) && l.length < 80) ?? "";
    if (/^detonation (one|two|three)$/i.test(line)) line = "";
  }
  if (ordinalFromLabel && !line) line = "";

  const rationale = clean(fields["WHY THIS DETONATION SERVES THE SMP"] ?? "")
    .split(/\n(?=[A-Z][A-Z '’/&-]{6,}:)/)[0]
    .replace(/\s+/g, " ")
    .trim();
  const statement =
    clean(selectedStatement) ||
    clean(fields["THE DETONATION STATEMENT"] ?? "").replace(/\s+/g, " ").trim();

  if (!line && !statement && !rationale) return null;
  return { line, statement, rationale };
}

/* ───────────────────────────────────── territory / proposition outcomes ── */

export interface TerritoryOutcome {
  /** Territory or field name as the pipeline named it. */
  name: string;
  /** The proposition written under it, when the stage records one. */
  line?: string;
  status: "survived" | "eliminated";
  /** Stage at which it was eliminated, e.g. "Stage 10". */
  stage?: string;
  /** Why it was eliminated, first sentence of the recorded pathway. */
  reason?: string;
}

const okey = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();

/**
 * The outcome of every strategic territory in the run: survived, or eliminated
 * and at which stage. Read from the pipeline's own records — Stage 11's per-SMP
 * verdict blocks, plus any explicit "ELIMINATED at Stage N" note in Stage 10 or
 * 11 — so a document can never profile a territory without stating what
 * happened to it. Nothing here is brand-specific.
 */
export function extractTerritoryOutcomes(
  stage10: string,
  stage11: string,
  territories: string[],
): TerritoryOutcome[] {
  const s10 = normaliseMd(stage10 ?? "");
  const s11 = normaliseMd(stage11 ?? "");
  const byName = new Map<string, TerritoryOutcome>();

  const put = (o: TerritoryOutcome) => {
    const k = okey(o.name);
    if (!k) return;
    const prior = byName.get(k);
    if (!prior) return void byName.set(k, o);
    byName.set(k, {
      ...prior,
      ...o,
      // an elimination recorded anywhere wins over a survival
      status: prior.status === "eliminated" ? "eliminated" : o.status,
      line: o.line || prior.line,
      stage: o.stage || prior.stage,
      reason: o.reason || prior.reason,
    });
  };

  // Every territory named at Stage 7 starts as surviving.
  for (const name of territories) put({ name, status: "survived" });

  // Stage 11 per-SMP verdict blocks: ### SMP 1: "line" — FIELD: <territory>
  for (const block of mdBlocks(s11)) {
    const m = block.heading.match(
      /SMP\s*\d*\s*[:.]?\s*["“]?(.+?)["”]?\s*[—–-]\s*FIELD\s*[:.]?\s*([^—–]+)/i,
    );
    if (!m) continue;
    const line = m[1].replace(/["“”]/g, "").trim();
    const field = m[2].replace(/["“”]/g, "").trim();
    // Some runs write the brand/category into FIELD rather than a territory.
    // Only trust FIELD when it names a Stage 7 territory; otherwise the entry
    // is identified by the proposition itself.
    const known = territories.find(
      (t) => okey(t) === okey(field) || okey(field).includes(okey(t)) || okey(t).includes(okey(field)),
    );
    const name = known ?? (territories.length ? `"${line}"` : field);
    const verdict = block.body.match(/SMP VERDICT\s*[:.]?\s*\**\s*([A-Z][A-Z ]{2,})/i)?.[1] ?? "";
    const eliminated = /ELIMINAT/i.test(verdict);
    let reason = (block.body.match(/ELIMINATION PATHWAY\s*[:.]?\s*\**\s*([^\n]+)/i)?.[1] ?? "")
      .replace(/\*\*/g, "")
      .split(/(?<=[.!?])\s/)[0]
      .trim();
    if (reason) reason = reason.charAt(0).toUpperCase() + reason.slice(1);
    put({
      name,
      line,
      status: eliminated ? "eliminated" : "survived",
      stage: eliminated ? "Stage 11" : undefined,
      reason: eliminated ? reason || undefined : undefined,
    });

  }

  // Explicit "…ELIMINATED at Stage N" notes, wherever the pipeline wrote them.
  for (const source of [s10, s11]) {
    for (const m of source.matchAll(
      /([A-Z][^\n(*]{6,70}?)\s*[（(]?\s*ELIMINATED\s+at\s+Stage\s+(\d+[A-Za-z]?)/gi,
    )) {
      const raw = m[1].replace(/^\s*\d+[.)]\s*/, "").replace(/["“”*]/g, "").trim();
      const match = territories.find(
        (t) => okey(t) === okey(raw) || okey(raw).endsWith(okey(t)) || okey(raw).includes(okey(t)),
      );
      if (!match) continue;
      put({ name: match, status: "eliminated", stage: `Stage ${m[2]}` });
    }
  }

  return [...byName.values()];
}

/** The recorded outcome for a named territory, matched loosely. */
export function outcomeFor(
  outcomes: TerritoryOutcome[],
  name: string,
): TerritoryOutcome | undefined {
  const k = okey(name);
  if (!k) return undefined;
  const near = (a: string, b: string) =>
    !!a && !!b && (a === b || (a.length > 8 && b.includes(a)) || (b.length > 8 && a.includes(b)));
  return outcomes.find((o) => near(okey(o.name), k) || near(okey(o.line ?? ""), k));

}

/** "Eliminated at Stage 10" / "Carried forward". */
export function outcomeLabel(outcome?: TerritoryOutcome): string {
  if (!outcome) return "No elimination recorded against it";
  return outcome.status === "eliminated"
    ? `Eliminated at ${outcome.stage ?? "the pressure test"}`
    : "Carried forward";
}
