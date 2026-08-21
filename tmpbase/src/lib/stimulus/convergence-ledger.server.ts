// ROOM 04 — FULL-SET IDEA CONVERGENCE LEDGER (second pass).
//
// The in-sweep IDEA COLLISION CHECK only ever sees the ideas produced BEFORE
// the current batch, so it reliably catches pairwise collisions but not a
// cluster that only becomes visible once the whole field exists. This pass
// runs once, after all lenses have generated, over the ROOT TENSIONS only —
// cheap, and able to compare the full set rather than prior-in-sequence.
//
// It deliberately mirrors Stage 9's CANDIDATE DISPOSITION ledger: enumerated
// ids in, a mandatory pipe-format verdict row per id out, code-side coverage
// checking, and forced rows for anything the model refuses to account for.
//
// HEADING NOTE: the ledger heading is "IDEA CONVERGENCE LEDGER" and the
// per-idea field is "IDEA COLLISION CHECK". Neither uses the literal string
// "ANTI-CONVERGENCE", which sanitize-output.ts strips as a block header.

import { callClaude } from "@/lib/claude.server";

export const CONVERGENCE_LEDGER_HEADING =
  "==== IDEA CONVERGENCE LEDGER — EVERY LENS ACCOUNTED FOR ====";

export type LedgerIdea = {
  /** Lens id, used verbatim as the ledger row id. */
  lensId: string;
  lensName: string;
  rootTension: string;
};

export type LedgerVerdict = "CLEAR" | "COLLIDES";

export type LedgerEntry = {
  lensId: string;
  verdict: LedgerVerdict;
  /** Lens ids this idea shares a root tension with. */
  collidesWith: string[];
  /** One-line statement of the shared territory, or why it is clear. */
  why: string;
  /** True when code, not the model, wrote the row. */
  forced?: boolean;
};

const LEDGER_SYSTEM_PROMPT = `You are the convergence auditor for a creative big-idea sweep. You are not writing, rating or improving ideas. You compare them.

You are given the ROOT TENSION of every idea in the sweep — the underlying human contradiction each idea runs on, stripped of genre, medium, setting, tone and device.

WHAT COUNTS AS CONVERGENCE
Convergence is SHARED UNDERLYING TERRITORY: the same contradiction, the same conceit, the same move. Different genre, different wrapper, different execution, different tone — none of that makes two ideas different. Four ideas dressed as a documentary, a comedy, a stunt and a data piece, all running on one identical contradiction, are four converged ideas and must all be flagged against each other.

WHAT DOES NOT COUNT
Same subject matter, same brand truth, same audience or same category observation approached through a genuinely different contradiction is NOT convergence. Do not flag ideas merely for being about the same thing.

Cluster them. Where three or more share a root tension, every member of that cluster is flagged and each row names the other members.

Judge only what is written. Do not invent tensions the text does not state.`;

export function buildLedgerUserMessage(ideas: LedgerIdea[]): string {
  return [
    "IDEAS IN THIS SWEEP — id | lens | root tension",
    ...ideas.map((i) => `${i.lensId} | ${i.lensName} | ${i.rootTension || "(no root tension recorded)"}`),
    "",
    CONVERGENCE_LEDGER_HEADING,
    `This is the whole of your output. Produce exactly one row for EVERY one of the ${ideas.length} ids above, in the order given, using exactly this pipe format and nothing else:`,
    "",
    "<lens id> | CLEAR | <one line on what makes this root tension its own territory>",
    "<lens id> | COLLIDES | <comma-separated ids it shares a root tension with> | <one line naming the shared territory>",
    "",
    "Every id must appear exactly once. No preamble, no summary, no headings, no blank verdicts, no \"as above\". If an id is clear, say so explicitly — silence is not a verdict.",
  ].join("\n");
}

const ID_TOKEN = /[A-Za-z0-9_.#-]+/;

function normId(v: string): string {
  return v.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
}

/** Parses the pipe-format ledger. Unknown ids are dropped. */
export function parseLedger(raw: string, ideas: LedgerIdea[]): LedgerEntry[] {
  const known = new Map(ideas.map((i) => [normId(i.lensId), i.lensId]));
  const byId = new Map<string, LedgerEntry>();

  for (const rawLine of (raw ?? "").split("\n")) {
    const line = rawLine.replace(/^[\s*>|-]+/, "").trim();
    if (!line.includes("|")) continue;
    const cells = line.split("|").map((c) => c.trim());
    const id = known.get(normId(cells[0] ?? ""));
    if (!id) continue;
    const verdictCell = (cells[1] ?? "").toUpperCase();
    if (!/CLEAR|COLLIDE/.test(verdictCell)) continue;

    if (/COLLIDE/.test(verdictCell)) {
      const idsCell = cells[2] ?? "";
      const collidesWith = (idsCell.match(new RegExp(ID_TOKEN, "g")) ?? [])
        .map((t) => known.get(normId(t)))
        .filter((v): v is string => Boolean(v) && v !== id);
      byId.set(id, {
        lensId: id,
        verdict: "COLLIDES",
        collidesWith: Array.from(new Set(collidesWith)),
        why: (cells.slice(3).join(" — ") || cells[2] || "").trim(),
      });
    } else {
      byId.set(id, {
        lensId: id,
        verdict: "CLEAR",
        collidesWith: [],
        why: cells.slice(2).join(" — ").trim(),
      });
    }
  }
  return Array.from(byId.values());
}

export function missingLedgerIds(ideas: LedgerIdea[], entries: LedgerEntry[]): LedgerIdea[] {
  const have = new Set(entries.map((e) => normId(e.lensId)));
  return ideas.filter((i) => !have.has(normId(i.lensId)));
}

export function buildLedgerRetryNote(missing: LedgerIdea[]): string {
  return [
    "",
    "==== LEDGER COVERAGE FAILURE — CORRECTION REQUIRED ====",
    `Your ledger did not account for every id. These ${missing.length} have no verdict row:`,
    ...missing.map((m) => `${m.lensId} | ${m.rootTension}`),
    "",
    "Reply with ONLY the missing rows, in the exact pipe format, one per line. No preamble.",
  ].join("\n");
}

/** Makes the collision graph symmetric — if A names B, B names A. */
export function symmetrise(entries: LedgerEntry[]): LedgerEntry[] {
  const map = new Map(entries.map((e) => [e.lensId, { ...e, collidesWith: [...e.collidesWith] }]));
  for (const e of entries) {
    for (const other of e.collidesWith) {
      const target = map.get(other);
      if (!target) continue;
      if (!target.collidesWith.includes(e.lensId)) target.collidesWith.push(e.lensId);
      if (target.verdict === "CLEAR") {
        target.verdict = "COLLIDES";
        target.why = target.why || `Shares a root tension with ${e.lensId}.`;
      }
    }
  }
  return Array.from(map.values());
}

/**
 * Runs the full-set pass with a coverage loop. Anything still unaccounted for
 * after the retries is written into the ledger as an explicit forced row —
 * never silently dropped.
 */
export async function runConvergenceLedger(args: {
  sessionId: string;
  ideas: LedgerIdea[];
  maxCoverageRetries?: number;
}): Promise<LedgerEntry[]> {
  const { ideas } = args;
  if (ideas.length === 0) return [];

  const maxRetries = args.maxCoverageRetries ?? 2;
  let transcript = buildLedgerUserMessage(ideas);
  let entries: LedgerEntry[] = [];

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const raw = await callClaude({
      systemPrompt: LEDGER_SYSTEM_PROMPT,
      userMessage: transcript,
      skipUniversalWrapper: true,
      maxTokens: 4000,
      temperature: 0.2,
      sessionId: args.sessionId,
      stageLabel: "Creative Stimulus — idea convergence ledger",
    });
    const parsed = parseLedger(raw, ideas);
    const merged = new Map(entries.map((e) => [e.lensId, e]));
    for (const e of parsed) merged.set(e.lensId, e);
    entries = Array.from(merged.values());

    const missing = missingLedgerIds(ideas, entries);
    if (missing.length === 0) break;
    if (attempt === maxRetries) {
      for (const m of missing) {
        entries.push({
          lensId: m.lensId,
          verdict: "CLEAR",
          collidesWith: [],
          why: "No verdict returned after coverage retries — recorded unaudited rather than dropped.",
          forced: true,
        });
      }
      break;
    }
    transcript = `${transcript}${buildLedgerRetryNote(missing)}`;
  }

  const order = new Map(ideas.map((i, idx) => [i.lensId, idx]));
  return symmetrise(entries).sort(
    (a, b) => (order.get(a.lensId) ?? 0) - (order.get(b.lensId) ?? 0),
  );
}
