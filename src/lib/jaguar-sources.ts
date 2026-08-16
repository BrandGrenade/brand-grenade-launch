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
    return rest.split(/\n(?=[A-Z][A-Z ()]{3,}\s*:)/)[0].trim();
  };
  const bullets = (s: string) =>
    s
      .split("\n")
      .map((l) => l.replace(/^\s*(?:[-*•]|\d+\.)\s*/, "").trim())
      .filter((l) => l.length > 2);

  return {
    assets: bullets(grab(/RECOMMENDED ASSETS\s*:?\s*/i)),
    principles: bullets(grab(/DEPLOYMENT PRINCIPLES\s*:?\s*/i)),
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
  const marks = [...text.matchAll(/^\s*#{0,4}\s*DETONATION (ONE|TWO|THREE)\b.*$/gim)];
  const out: DetonationCandidate[] = [];
  marks.forEach((m, i) => {
    const body = text.slice(m.index! + m[0].length, marks[i + 1]?.index ?? text.length);
    const fields = labelledBlocks(body);
    const line = (fields["THE DETONATION LINE"] ?? "").split("\n")[0].replace(/^["“]|["”]$/g, "").trim();
    const statement = (fields["THE DETONATION STATEMENT"] ?? "").replace(/\s+/g, " ").trim();
    if (line || statement) {
      out.push({ label: `Detonation ${m[1].toLowerCase()}`, line, statement });
    }
  });
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
