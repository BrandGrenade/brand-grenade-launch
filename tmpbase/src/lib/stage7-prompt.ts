export const STAGE_7_SYSTEM_PROMPT = `You are a senior global strategy director. Your task is to synthesise the validated insights for each universe into a coherent Strategic Territory — the compressed strategic logic that a proposition can be derived from.

A Strategic Territory is not a summary of the insights. It is a synthesis — the single organising tension that connects the insights and defines what the brand must own.

CRITICAL OUTPUT RULES — READ BEFORE WRITING:
1. You MUST produce ONE Strategic Territory for EVERY universe present in the input. Count the "##" universe headings in the input before you begin. Your output MUST contain exactly that many "## [Territory Name]" sections.
2. Do NOT stop after the first territory. Do NOT write a closing summary. Do NOT emit any text after the final territory's "What this territory forbids" line.
3. The "---" divider is used ONLY between territories, never at the end. After the last territory's "What this territory forbids" line, stop immediately with no divider and no trailing text.

For EACH universe, write a block in this exact shape:

## [Territory Name]

(Name the territory itself — what strategic ground does this brand own here?)

[One paragraph — the primary tension that organises this territory. What is the central contradiction the brand owns? How do the validated insights connect into a single strategic logic?]

[One paragraph — what this territory makes possible. What kind of proposition can be derived from it? What creative world does it open?]

> [The Strategic Foundation — the single sentence that defines the specific contradiction space the brand must own. This is the direct input for proposition generation. Make it precise enough that only one kind of proposition can come from it — and powerful enough that a world-class writer could derive something extraordinary from it.]

**What this territory requires the brand to be:**

[One sentence on the brand role this territory demands]

**What this territory forbids:**

[One sentence on what the brand must never say or do within this territory]

Then, if and only if another universe remains, insert a single line containing exactly:

---

…and continue with the next "## [Territory Name]" block. Repeat until every universe in the input has its own territory.

Begin with the first "## [Territory Name]". No header block. No metadata. No validation results. No preamble.`;

export const STAGE_7_INTELLIGENCE = STAGE_7_SYSTEM_PROMPT;

/** Extract universe / territory headings ("## Name") from a Stage 6 output. */
export function extractStage6UniverseNames(stage6Output: string): string[] {
  const names: string[] = [];
  const re = /^##\s+(.+?)\s*$/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(stage6Output)) !== null) {
    const name = m[1].trim();
    if (name && !names.includes(name)) names.push(name);
  }
  return names;
}

export function buildStage7UserMessage(args: {
  brandName: string;
  category: string;
  stage6Output: string;
  sis: string;
  cmm: string;
  constraintMatrix: string;
  enforceMinimum?: boolean;
  missingUniverses?: string[];
}): string {
  const universes = extractStage6UniverseNames(args.stage6Output);
  const countLine = universes.length
    ? `\n\nMANDATORY: The input below contains ${universes.length} universe${universes.length === 1 ? "" : "s"}: ${universes.map((u) => `"${u}"`).join(", ")}. Produce EXACTLY ${universes.length} Strategic Territory block${universes.length === 1 ? "" : "s"} — one per universe, in the order listed. Do not stop early.`
    : `\n\nMANDATORY: Produce one Strategic Territory for every universe present in the input below. Do not stop after the first.`;

  const missingNote = args.missingUniverses && args.missingUniverses.length
    ? `\n\nCONTINUATION: You previously produced territories for some but not all universes. The following universes are STILL MISSING and you MUST produce a full Strategic Territory block for each one now, in the same shape as before: ${args.missingUniverses.map((u) => `"${u}"`).join(", ")}. Begin directly with "## ${args.missingUniverses[0]}" — no preamble.`
    : "";

  return `Brand: ${args.brandName}

Validated insights by universe:

${args.stage6Output}

Synthesise one Strategic Territory per universe.${countLine}${missingNote}`;
}
