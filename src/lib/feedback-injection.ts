/**
 * Shared helper for injecting human-reviewer feedback into a regeneration
 * prompt. The previous version simply appended the feedback as a polite
 * suggestion ("address the feedback above"). Models routinely ignored
 * this and produced near-identical output.
 *
 * This helper produces a hard, mandatory-constraint block that:
 *   1. Is injected at the TOP of the user message so the model reads the
 *      constraints before the source material.
 *   2. Repeats the constraints at the BOTTOM as the final instruction.
 *   3. Includes the previous output verbatim and forbids reproducing it.
 *
 * The goal: regenerated output must be demonstrably different from the
 * previous set and must directly address the specific changes requested.
 */
export function buildFeedbackInjection(args: {
  feedback: string;
  previousOutput?: string | null;
  stageLabel: string;
}): { prefix: string; suffix: string } {
  const fb = args.feedback.trim();
  if (!fb) return { prefix: "", suffix: "" };

  const prev = (args.previousOutput ?? "").trim();
  const prevBlock = prev
    ? `\n\nPREVIOUS OUTPUT (REJECTED — DO NOT REPRODUCE, DO NOT PARAPHRASE):\n<<<\n${prev}\n>>>\n`
    : "";

  const prefix = `==== MANDATORY HUMAN REDIRECT — ${args.stageLabel} REGENERATION ====
The previous output was rejected by the human reviewer. You MUST follow the
direction below precisely. It overrides any default direction in this prompt
where they conflict. Do not soften it, do not partially apply it, and do not
revert to the previous framing.

HUMAN DIRECTION (mandatory constraints — apply to every element generated):
${fb}

REGENERATION RULES — NON-NEGOTIABLE:
1. Start fresh from the human direction above. Do not start from the previous
   output and edit it.
2. The new output MUST be demonstrably different from the previous output in
   substance, framing, and language.
3. Every directive in the human direction MUST be visibly applied. If a
   directive contradicts the default prompt, the human direction wins.
4. Any "stop", "avoid", "remove", "zero", or "do not generate" instruction
   is a hard exclusion. The regenerated output must contain zero instances of
   the rejected pattern, territory, narrative, or framing.
5. Any benchmark, example, or named standard provided by the human direction
   is a mandatory quality and territory reference for the regenerated output.
6. Do not reproduce any line, phrase, or proposition from the previous output
   unless the human direction explicitly asks you to keep it.${prevBlock}
==== END MANDATORY HUMAN REDIRECT ====

`;

  const suffix = `\n\n---\n\n==== FINAL REMINDER — MANDATORY HUMAN REDIRECT ====
Before you write a single line, re-read the HUMAN DIRECTION at the top of
this message. The output you produce will be checked against it.

HUMAN DIRECTION (repeated):
${fb}

Produce a fresh ${args.stageLabel} output that visibly and substantively
applies every part of the human direction above. Do not repeat the rejected
previous output.
==== END FINAL REMINDER ====`;

  return { prefix, suffix };
}
