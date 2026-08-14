// CREATIVE STIMULUS ENGINE — BIG IDEA SWEEP (architecture revision).
//
// One sweep per session, run BEFORE any channel brief exists. Every lens
// answers the verbatim SMP, supported only by the Stage 1/2 strategic truths.
// No channel brief is read, referenced or implied here — that is the whole
// point of the revision: nothing channel-specific exists yet to hijack the
// interpretation of the proposition.

import type { StimulusLens } from "./lenses";

export const BIG_IDEA_SYSTEM_PROMPT = `BRAND GRENADE — CREATIVE STIMULUS ENGINE, BIG IDEA SWEEP

You are the creative department of a world-class agency. Each lens you are given is that department's specific angle of attack on ONE brief. You are not producing "a competent direction" — you are producing the strongest, most original, most compelling campaign idea that angle can possibly yield for this proposition.

WHAT YOU ARE ANSWERING
The approved Single Minded Proposition (SMP), verbatim, and nothing else. There are no channels yet. There is no media plan yet. Do not write for a channel, do not name a channel as the idea, and do not narrow the proposition to whatever a particular medium would find convenient. The idea comes first; channels adapt to it later.

FIDELITY TO MEANING — NON-NEGOTIABLE
The SMP's specific meaning governs. Not a nearby, easier, or more familiar meaning. Before you write, state to yourself what the SMP actually means and what it does NOT mean, and hold that line. An idea that answers a plausible neighbour of the proposition is a failed idea, however good it looks.

EVERY IDEA MUST SIMULTANEOUSLY BE — not three sequential checks, one idea carrying all three at once:
- ORIGINAL. Not a known campaign with the brand swapped in. Not a category cliché.
- CRAB. Clear, Relevant (grounded in a real human truth, not logical relevance), Appealing, Believable — and made with real craft.
- FAME-WORTHY. It would get talked about outside the category.

FIELD 1 — THE CANDIDATE MASTER LINE
Each lens produces ONE candidate master line, aimed at the highest standard on the FIRST attempt — the caliber of "Just Do It" or "We Try Harder". This is not a draft to be fixed later. It is a candidate to BECOME (or replace) the brand's master line, and it is judged as such.

Shape — mandatory, not aspirational:
- Three to seven words. No exceptions, no subordinate clauses, no conjunctions that soften.
- It must stand alone on a poster with ZERO context — no idea underneath it, no explanation beside it.
- It carries the idea. It does not explain, summarise, restate or annotate the idea.
- Declarative. Present tense. Active voice. Zero hedging.
- Read it aloud. If it needs a pause to process, it has failed. If it sounds like a headline for a strategy deck, it has failed.

Forbidden: a compressed restatement of the big idea above it. That is a thesis, not a line. Also forbidden: "A brand that…", "For people who…", "We help… to…", "The [adjective] way to [verb]", and any line that requires a second sentence to be understood.

FIVE MANDATORY STRESS TESTS — all five must pass before the line is output. Run them silently; do not print them.
Test 1 — Tension. Does the line hold a genuine felt contradiction or charge, rather than stating one? If the tension has to be explained, it has failed.
Test 2 — Exclusion. Could a direct competitor, or a different proposition in this category, run this line unchanged? If yes, it is generic — rewrite it.
Test 3 — Standalone. Does it survive with no context, no explanation and no second sentence? If it needs support, compress further.
Test 4 — Spoken Language. Read aloud, does it land with force in a single breath, as something a person would actually say?
Test 5 — Category Convention. Does it break the category's default way of speaking, or reproduce it?
A line that fails any test is rewritten before output, not shipped with a caveat.

FIELD 2 — EXPRESSION UNDER MASTER
Produce this field ONLY when the user message supplies a LOCKED MASTER LINE. If none is supplied, omit this field entirely — do not invent a master line, do not substitute your own candidate, and do not output the label with nothing under it.

When a locked master line IS supplied, it is fixed and mandatory. You are not rewriting it, not improving it, not competing with it and not defending it. Your job is the opposite: show how THIS lens's idea earns its place underneath it. Write one line of supporting expression that locks up with the master line — the kind of second line that would sit beneath it on the same poster, or run as this idea's specific execution tagline.
- Reproduce the master line verbatim, then the supporting expression, in the shape: <Master line> <Supporting expression>
- The supporting expression is itself short — under ten words — and specific to this idea, not a generic sub-line that would work under any idea.
- The pairing must read as one thought in two beats, not as two lines arguing with each other.

THE RATIONALE
A short, readable, narrative case for the idea, of the kind a creative director says out loud at first presentation: why it works, why it is relevant to this SMP and to the specific truths it draws on, and why it deserves to go forward relative to the rest of the field. Not a score, not a checklist.

THE IDEA IS A TERRITORY, NOT A TREATMENT
This is a divergence tool. You are producing the idea, not the film of the idea. Craft — casting, shot grammar, sequencing, sound — belongs to the Writer / AD / CD orchestration pass downstream and must not be pre-empted here.

DO NOT
- Write channel executions, media plans, or "and on social we could…".
- Write strategy prose ("resonates with", "leverages", "taps into").
- Hedge, grade, or apologise for your own work.
- Produce more than one idea per lens.
- Name talent, celebrities, or casting choices — no "a young father", cast as a type, is fine; a named or specified performer is not.
- Write shot lists, shot grammar or camera direction — no "rack-focus", "long take", "final frame", "cut to", "we open on", "close on".
- Write scene-by-scene or beat-by-beat sequencing. One territory, not a running order.
- Specify music or sound design — no mic choice, tempo, instrumentation, track references or sound-design beats.
If the idea can only be expressed by describing exactly how it would be filmed, it is not abstracted enough — push back to the underlying territory and state that instead.

ROOT TENSION — MANDATORY
Every idea rests on one underlying tension. Name it in one plain line: the human contradiction the idea runs on, stated at territory level, stripped of genre, wrapper, setting, tone and device. "A documentary about X" and "a comedy about X" have the SAME root tension. This field is what the collision check compares, so it must describe the engine of the idea, never its dressing.

IDEA COLLISION CHECK — MANDATORY
You will be given the ROOT TENSION of every idea already produced earlier in this sweep. Before you output, compare your idea's root tension against every one of them.
- Collision means SHARED UNDERLYING TERRITORY: the same contradiction, the same conceit, the same move — even where the genre, medium, setting, tone or device are completely different. Four different wrappers around one identical idea is four collisions, not four ideas.
- Not a collision: the same subject matter or the same brand truth approached through a genuinely different contradiction.
If you collide, do not ship the idea. Go back to this lens and generate a genuinely different territory from the same angle of attack, then re-check the new one against the full prior list. Only output CLEAR when the idea you are actually outputting has been compared against every prior root tension and collides with none.
If, after honest attempts, this lens can only produce a colliding idea, output the idea and declare the collision explicitly rather than disguising it.

OUTPUT CONTRACT — follow exactly. No preamble, no closing remarks.
For each lens given, output:

### LENS: <exact lens id given to you>
THE BIG IDEA
<40–70 words. HARD CEILING — count them. The single strongest idea this lens yields, at territory level. Present tense. What it is and why it bites, not how it is made.>

ROOT TENSION
<One line. The underlying contradiction, stripped of genre, setting, device and tone.>

IDEA COLLISION CHECK
<Either "CLEAR" or "COLLIDES WITH <prior lens id> — <one line on the shared root tension, naming the territory both share>". If it collides with more than one, list each on its own line.>

CANDIDATE MASTER LINE
<3–7 words. Standalone. No quotation marks, no explanation.>

EXPRESSION UNDER MASTER
<Only if a locked master line was supplied. One line: the master line verbatim, then this idea's supporting expression. Omit this label entirely if no master line was supplied.>

GUIDANCE ALIGNMENT
<Only if CREATIVE GUIDANCE was supplied for this sweep. Exactly "ALIGNED — <one clause>" or "NOT ALIGNED — <one clause>", judging this idea honestly against the guidance. Omit this label entirely if no guidance was supplied. Never mark an idea ALIGNED to hit a quota if it is not.>

WHY IT WINS
<70–120 words. Why it works, why it is relevant to this SMP and to the truths it uses, and why it is worthy of going forward against the field.>


If a lens genuinely has no honest purchase on this proposition, output:
THE BIG IDEA
NO HONEST IDEA — <one sentence saying why this lens has no purchase on this proposition>
and omit the other fields.`;

/** One already-generated idea, reduced to what the collision check compares. */
export interface PriorTension {
  lensId: string;
  lensName: string;
  rootTension: string;
}

/** Operator-authored steer for the whole sweep, plus live compliance arithmetic. */
export interface CreativeGuidance {
  /** Verbatim text the operator typed before the sweep started. */
  text: string;
  /** Optional minimum number of lenses (out of totalLenses) that must comply. */
  target?: number | null;
  totalLenses: number;
  /** Lenses generated so far in this sweep (any alignment). */
  generated: number;
  /** Of those, how many the model itself marked ALIGNED. */
  aligned: number;
  /** Lenses still to be generated after this call's batch is excluded. */
  remaining: number;
}

export function buildGuidanceBlock(g: CreativeGuidance): string {
  const lines = [
    "═══ CREATIVE GUIDANCE FOR THIS SWEEP — MANDATORY STEER ═══",
    g.text.trim(),
    "",
    "This guidance applies to every lens in this sweep. It steers register, framing and emphasis. It does NOT override the proposition, the lens's angle of attack, the collision check, the word ceilings, or any hard ban in the system prompt — an idea may never be twisted into dishonesty, or into a different proposition, to satisfy it.",
    "Output the GUIDANCE ALIGNMENT field for every lens, judged honestly. A false ALIGNED is a worse failure than a declared NOT ALIGNED.",
  ];

  if (g.target && g.target > 0) {
    const shortfall = Math.max(g.target - g.aligned, 0);
    const headroom = g.remaining - shortfall;
    lines.push(
      "",
      "COMPLIANCE LEDGER FOR THIS SWEEP — REAL COUNTS, NOT ESTIMATES",
      `Target: at least ${g.target} of ${g.totalLenses} lenses must be ALIGNED.`,
      `Generated so far: ${g.generated}. Of those, ALIGNED: ${g.aligned}.`,
      `Still to generate after this pass: ${g.remaining}. Shortfall against target: ${shortfall}.`,
    );
    if (shortfall === 0) {
      lines.push(
        "The target is already met. Do not force alignment — from here, take the strongest idea each lens yields and mark it honestly.",
      );
    } else if (headroom <= 0) {
      lines.push(
        "CRITICAL: the target is now only reachable if EVERY remaining lens is ALIGNED. Unless this lens's angle of attack makes alignment genuinely dishonest, the idea you output must be ALIGNED. If it is honestly impossible for this lens, say so in one clause and move on.",
      );
    } else if (headroom <= 4) {
      lines.push(
        `MANDATORY CORRECTION: only ${headroom} non-aligned lenses remain affordable. Treat alignment as a requirement for this pass, not a preference.`,
      );
    } else {
      lines.push(
        "Correct toward the target now rather than late. A sweep that leaves correction to the final batches cannot recover.",
      );
    }
  }
  return lines.join("\n");
}

export function buildBigIdeaUserMessage(args: {
  brandName: string;
  category: string;
  smp: string;
  detonationLine: string;
  truths: string;
  strategicEvidence: string;
  lenses: StimulusLens[];
  /** Root tensions of every idea already produced in this sweep. */
  priorTensions?: PriorTension[];
  /** Set when this call is a forced regeneration after a detected collision. */
  regenerationNote?: string;
  /** Operator guidance for this sweep; omitted entirely when absent. */
  creativeGuidance?: CreativeGuidance | null;
}): string {

  const lensBlocks = args.lenses
    .map((l) =>
      [
        `### LENS: ${l.id}`,
        `NAME: ${l.name}`,
        `APPROACH: ${l.approach}`,
        `CORE PROVOCATION: ${l.provocation}`,
        `SUB-PROMPTS: ${l.subPrompts}`,
        `FORMAT TAGS: ${l.formatTags.join(", ")}`,
      ].join("\n"),
    )
    .join("\n\n");

  return [
    `BRAND: ${args.brandName}`,
    `CATEGORY: ${args.category}`,
    "",
    "═══ THE PROPOSITION — VERBATIM, UNALTERED. THIS IS THE BRIEF ═══",
    args.smp || "—",
    "",
    "This proposition is the entire brief. There is no channel brief. Nothing below may be used to re-interpret, soften or narrow the meaning above.",
    "",
    "═══ SUPPORTING EVIDENCE — THE STRATEGIC TRUTHS (context only, never a substitute brief) ═══",
    "THREE TRUTHS",
    args.truths || "—",
    "",
    "DISCRIMINATORS, THORPE CANDIDATES, ANCHORED TENSION AND MOTIVATORS",
    args.strategicEvidence || "—",
    "",
    args.detonationLine
      ? [
          "═══ LOCKED MASTER LINE — FIXED AND MANDATORY ═══",
          args.detonationLine,
          "This master line is locked. You may not rewrite, improve, replace or argue with it. Produce FIELD 2 (EXPRESSION UNDER MASTER) for every lens, showing how that lens's idea sits underneath this exact line.",
        ].join("\n")
      : "NO MASTER LINE IS LOCKED FOR THIS SESSION. Produce FIELD 1 only. Omit the EXPRESSION UNDER MASTER label entirely — do not invent a master line to pair against.",
    "",
    (args.priorTensions ?? []).length > 0
      ? [
          "═══ ROOT TENSIONS ALREADY PRODUCED IN THIS SWEEP — RUN THE IDEA COLLISION CHECK AGAINST EVERY ONE ═══",
          ...(args.priorTensions ?? []).map(
            (p) => `${p.lensId} (${p.lensName}): ${p.rootTension}`,
          ),
          "Compare underlying territory, not genre, medium, setting, tone or device. Different dressing on the same contradiction is a collision.",
        ].join("\n")
      : "NO IDEAS HAVE BEEN PRODUCED YET IN THIS SWEEP. Output IDEA COLLISION CHECK: CLEAR, but still state the ROOT TENSION.",
    "",
    args.creativeGuidance?.text?.trim()
      ? buildGuidanceBlock(args.creativeGuidance)
      : "",

    args.regenerationNote
      ? [
          "═══ FORCED REGENERATION — THE PREVIOUS ATTEMPT COLLIDED ═══",
          args.regenerationNote,
          "Do not repair the previous idea. Abandon its root tension entirely and find a different contradiction from this same lens, then re-check it against EVERY root tension listed above — not only the one it previously collided with.",
        ].join("\n")
      : "",
    "",
    "═══ LENSES TO APPLY IN THIS PASS ═══",
    lensBlocks,
    "",
    `Produce exactly ${args.lenses.length} big ideas — one per lens, in the order given, using the output contract. Each must be genuinely different in underlying thinking from the others AND from every root tension listed above, not the same thought in a different device. Nothing else.`,
  ]
    .filter((s) => s !== "")
    .join("\n");
}

/** One declared collision between this idea and an earlier lens in the sweep. */
export interface IdeaCollision {
  lensId: string;
  why: string;
}

export interface ParsedBigIdea {
  idea: string;
  line: string;
  expressionUnderMaster: string;
  rationale: string;
  rootTension: string;
  /** Empty array = the model declared CLEAR. */
  collisions: IdeaCollision[];
}

/**
 * Parses "COLLIDES WITH <lens id> — <why>" lines. "CLEAR" (or an empty field)
 * yields []. The heading is IDEA COLLISION CHECK, deliberately NOT
 * "ANTI-CONVERGENCE": sanitize-output.ts strips any block under that label.
 */
export function parseCollisionField(v: string): IdeaCollision[] {
  const out: IdeaCollision[] = [];
  for (const rawLine of v.split("\n")) {
    const l = rawLine.replace(/^[\s*->]+/, "").trim();
    if (!l || /^clear\b/i.test(l)) continue;
    const m = l.match(/^collides?\s+with\s+([A-Za-z0-9_.#-]+)\s*(?:[—–:-]\s*(.*))?$/i);
    if (!m) continue;
    const lensId = (m[1] ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "");
    if (!lensId) continue;
    out.push({ lensId, why: (m[2] ?? "").trim() });
  }
  return out;
}

/** Splits a multi-lens big-idea response into { lensId: {idea, line, ...} }. */
export function parseBigIdeaResponse(raw: string): Record<string, ParsedBigIdea> {
  const out: Record<string, ParsedBigIdea> = {};
  const parts = raw.split(/^###\s*LENS:\s*/gim).slice(1);
  for (const part of parts) {
    const nl = part.indexOf("\n");
    if (nl === -1) continue;
    const id = part
      .slice(0, nl)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "");
    const body = part.slice(nl + 1);
    if (!id || !body.trim()) continue;

    // Section-split, not lookahead-terminated. The previous implementation
    // required the NEXT label to exist ("(?=^CAMPAIGN LINE$)"), so a lens that
    // legitimately omitted later fields (the "NO HONEST IDEA" contract) matched
    // nothing, and the final field terminated on "(?=$)" which, under /m,
    // matched the first end-of-line and always returned "".
    // "CAMPAIGN LINE" is retained as a legacy alias for the field now labelled
    // CANDIDATE MASTER LINE, so historical output still parses.
    const sections: Record<string, string> = {};
    {
      const re =
        /^[ \t]*(THE BIG IDEA|ROOT TENSION|IDEA COLLISION CHECK|CANDIDATE MASTER LINE|CAMPAIGN LINE|EXPRESSION UNDER MASTER|WHY IT WINS)[ \t]*:?[ \t]*$/gim;
      const hits: Array<{ label: string; start: number; end: number }> = [];
      for (let m = re.exec(body); m; m = re.exec(body))
        hits.push({ label: m[1].toUpperCase(), start: m.index, end: m.index + m[0].length });
      hits.forEach((h, i) => {
        sections[h.label] = body.slice(h.end, hits[i + 1]?.start ?? body.length).trim();
      });
    }

    const firstLine = (v: string) =>
      v.split("\n")[0]?.trim().replace(/^["“”']|["“”']$/g, "") ?? "";

    const idea = sections["THE BIG IDEA"] ?? "";
    const line = sections["CANDIDATE MASTER LINE"] ?? sections["CAMPAIGN LINE"] ?? "";
    const expression = sections["EXPRESSION UNDER MASTER"] ?? "";
    const rationale = sections["WHY IT WINS"] ?? "";
    const collisionField = sections["IDEA COLLISION CHECK"] ?? "";

    out[id] = {
      idea: idea || body.trim(),
      line: firstLine(line),
      expressionUnderMaster: firstLine(expression),
      rationale,
      rootTension: firstLine(sections["ROOT TENSION"] ?? ""),
      collisions: parseCollisionField(collisionField),
    };
  }
  return out;
}
