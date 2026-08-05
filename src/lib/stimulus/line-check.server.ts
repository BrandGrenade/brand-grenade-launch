// Independent on-strategy check for the 37 campaign lines.
//
// Deliberately run WITHOUT the idea's own rationale. A line is judged only
// against the SMP's specific meaning: a catchy line that expresses a nearby
// idea ("Your airline, your way" for "Fly it like you own it") must fail even
// when the idea underneath it was correct.

import { callClaude } from "../claude.server";
import type { LineCheck, LineVerdict } from "./line-check-types";

const SYSTEM = `BRAND GRENADE — CAMPAIGN LINE ON-STRATEGY CHECK

You judge campaign lines against ONE proposition. You are not given the ideas the lines came from, and you must not imagine them. A line either carries the proposition's specific meaning on its own, or it does not.

For each line, decide:
- on_strategy: the line carries the proposition's SPECIFIC meaning. Not a neighbouring meaning, not a softer meaning.
- drift: the line is clear and appealing but expresses a DIFFERENT idea from the proposition. Example of drift: for "Fly it like you own it", the line "Your airline, your way" expresses customisation, not ownership — it is drift, not on strategy.
- generic: the line could sit on almost any brand or proposition in this category unchanged.

Apply the swap test explicitly: put a plausible competitor's name behind the line. If it still works untouched, it is generic.

Be hard. Sounding accomplished is not evidence of being on strategy.

OUTPUT: a single JSON array, nothing else. One object per line, in the order given:
[{"id":"<the id given>","verdict":"on_strategy|drift|generic","says":"<what the line actually says, plain words, max 20 words>","reasoning":"<one or two sentences>","swap_test":"<one sentence on the competitor swap>"}]`;

export interface LineToCheck {
  id: string;
  lensName: string;
  line: string;
}

export async function checkCampaignLines(args: {
  sessionId: string;
  brandName: string;
  category: string;
  smp: string;
  lines: LineToCheck[];
}): Promise<Record<string, LineCheck>> {
  if (args.lines.length === 0) return {};

  const userMessage = [
    `BRAND: ${args.brandName}`,
    `CATEGORY: ${args.category}`,
    "",
    "THE PROPOSITION — VERBATIM. THIS IS THE ONLY STANDARD:",
    args.smp || "—",
    "",
    "LINES TO JUDGE:",
    ...args.lines.map((l) => `- id: ${l.id} | line: ${l.line}`),
    "",
    "Return the JSON array only.",
  ].join("\n");

  const raw = await callClaude({
    systemPrompt: SYSTEM,
    userMessage,
    skipUniversalWrapper: true,
    maxTokens: 8000,
    temperature: 0,
    sessionId: args.sessionId,
    stageLabel: "Campaign line on-strategy check",
  });

  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  if (start === -1 || end <= start) throw new Error("Line check returned no JSON array");
  const parsed = JSON.parse(raw.slice(start, end + 1)) as Array<{
    id?: string;
    verdict?: string;
    says?: string;
    reasoning?: string;
    swap_test?: string;
  }>;

  const checkedAt = new Date().toISOString();
  const out: Record<string, LineCheck> = {};
  for (const row of parsed) {
    if (!row?.id) continue;
    const verdict: LineVerdict =
      row.verdict === "on_strategy" || row.verdict === "drift" || row.verdict === "generic"
        ? row.verdict
        : "drift";
    out[row.id] = {
      verdict,
      says: row.says ?? "",
      reasoning: row.reasoning ?? "",
      swap_test: row.swap_test ?? "",
      checkedAt,
    };
  }
  return out;
}
