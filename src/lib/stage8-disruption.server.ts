// Stage 8 — Disruption engine runner (server-only).
//
// Fires Breach / Fuse / Flashpoint PER TERRITORY, in parallel, and merges
// each result back into that territory's own Stage 8 block as a sibling
// candidate. No separate bottom-of-document block; no pre-selected winner.
//
// Isolated from the 13-engine LOC system — no shared state, no shared code.

import { callClaude } from "./claude.server";
import {
  STAGE_8_DISRUPTION_ENGINES,
  DISRUPTION_ENGINE_LABEL,
  MIN_PROPOSITION_WORDS,
  MAX_PROPOSITION_WORDS,
  countPropositionWords,
  buildDisruptionUserMessage,
  buildCompressionMessage,
  getDisruptionSystemPrompt,
  COMPRESSION_SYSTEM_PROMPT,
  type DisruptionEngine,
} from "./stage8-disruption-engines";
import { enforcePropositionAnchor } from "./proposition-anchor.server";
import { renderAnchorFailure } from "./proposition-anchor";

export type DisruptionCandidate = {
  engine: DisruptionEngine;
  territoryName: string;
  proposition: string | null;
  anchor: string | null;
  anchored?: boolean;
  anchorReason?: string | null;
  earlierDraft: string | null;
  cut: string | null;
  words: number | null;
  raw: string | null;
  error?: string;
};

export type TerritoryBlock = { name: string; markdown: string };

/** Split a Stage 8 markdown output into blocks, one per `## ` heading. */
export function splitStage8Blocks(text: string): TerritoryBlock[] {
  const lines = text.split("\n");
  const blocks: Array<{ name: string; lines: string[] }> = [];
  let current: { name: string; lines: string[] } | null = null;
  for (const raw of lines) {
    const m = raw.match(/^##\s+(.+?)\s*$/);
    if (m) {
      if (current) blocks.push(current);
      const name = m[1]
        .replace(/^\*+|\*+$/g, "")
        .replace(/^FIELD\s*\d+\s*[—\-:]\s*/i, "")
        .trim();
      current = { name, lines: [raw] };
    } else if (current) {
      current.lines.push(raw);
    }
  }
  if (current) blocks.push(current);
  return blocks.map((b) => ({ name: b.name, markdown: b.lines.join("\n").replace(/\s+$/g, "") }));
}

/** Best-effort pull of the base proposition line from a territory block. */
export function extractBaseProposition(markdown: string): string | null {
  for (const raw of markdown.split("\n")) {
    const line = raw.trim();
    if (/^>\s+\S/.test(line)) {
      return line.replace(/^>\s*/, "").replace(/^\*+|\*+$/g, "").trim();
    }
  }
  return null;
}

function pickLine(text: string, label: RegExp): string | null {
  for (const raw of text.split("\n")) {
    const m = raw.match(label);
    if (m) return m[1].trim().replace(/^["“”'‘’]+|["“”'‘’]+$/g, "").trim();
  }
  return null;
}

async function runOne(args: {
  engine: DisruptionEngine;
  sessionId: string;
  territoryName: string;
  territoryBlock: string;
  baseProposition: string | null;
  brandName: string;
  category: string;
  stage2Output: string;
  stage4bOutput?: string | null;
  stage6Output?: string | null;
  briefText?: string | null;
}): Promise<DisruptionCandidate> {
  const { engine, sessionId, territoryName } = args;
  try {
    const raw = (
      await callClaude({
        systemPrompt: getDisruptionSystemPrompt(engine),
        userMessage: buildDisruptionUserMessage(args),
        maxTokens: 2000,
        sessionId,
        stageLabel: `Stage 8 ${DISRUPTION_ENGINE_LABEL[engine]} — ${territoryName}`,
        stageNumber: "8",
        stageName: "Proposition Generation",
      })
    ).trim();
    if (!raw) throw new Error("empty output");

    let proposition = pickLine(raw, /^\s*PROPOSITION:\s*(.+)$/i);
    const anchor = pickLine(raw, /^\s*Anchor:\s*(.+)$/i);
    const earlierDraft = pickLine(raw, /^\s*Earlier draft:\s*(.+)$/i);
    const cut = pickLine(raw, /^\s*Cut:\s*(.+)$/i);

    const isRefusal = !!proposition && /^no credible/i.test(proposition);

    // HARD LENGTH GATE — compress rather than accept an over-length line.
    if (proposition && !isRefusal) {
      let line: string = proposition;
      let words = countPropositionWords(line);
      let tries = 0;
      while ((words > MAX_PROPOSITION_WORDS || words < MIN_PROPOSITION_WORDS) && tries < 2) {
        tries++;
        const reply: string = await callClaude({
          systemPrompt: COMPRESSION_SYSTEM_PROMPT,
          userMessage: buildCompressionMessage({ engine, territoryName, line }),
          maxTokens: 200,
          sessionId,
          stageLabel: `Stage 8 ${DISRUPTION_ENGINE_LABEL[engine]} length gate — ${territoryName}`,
          stageNumber: "8",
          stageName: "Proposition Generation",
        });
        const fixed = reply
          .trim()
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean)[0];
        if (!fixed) break;
        line = fixed.replace(/^["“”'‘’]+|["“”'‘’]+$/g, "").trim();
        words = countPropositionWords(line);
      }
      proposition = line;
      if (words > MAX_PROPOSITION_WORDS) {
        console.warn(
          `[stage8-disruption] session=${sessionId} ${engine}/${territoryName} still ${words} words after compression`,
        );
      }
    }


    // UNIVERSAL ANCHOR GATE — the single shared gate every proposition
    // path in this platform calls through. Never re-implemented per engine.
    let anchorFinal = anchor;
    let anchored = false;
    let anchorReason: string | null = null;
    if (proposition && !isRefusal) {
      const verdict = await enforcePropositionAnchor({
        sessionId,
        proposition,
        suppliedAnchor: anchor,
        brandName: args.brandName,
        category: args.category,
        capabilityEvidence: [args.stage4bOutput, args.briefText].filter(Boolean).join("\n\n"),
        label: `Stage 8 ${DISRUPTION_ENGINE_LABEL[engine]} — ${territoryName}`,
      });
      anchored = verdict.anchored;
      anchorFinal = verdict.anchor || anchor;
      anchorReason = verdict.reason;
    }

    return {
      engine,
      territoryName,
      proposition,
      anchor: anchorFinal,
      anchored,
      anchorReason,
      earlierDraft,
      cut,
      words: proposition ? countPropositionWords(proposition) : null,
      raw,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[stage8-disruption] session=${sessionId} ${engine}/${territoryName}: ${msg}`);
    return {
      engine,
      territoryName,
      proposition: null,
      anchor: null,
      earlierDraft: null,
      cut: null,
      words: null,
      raw: null,
      error: msg,
    };
  }
}

/**
 * Run all three engines against every territory, in parallel.
 * Returns candidates keyed by territory name.
 */
export async function runStage8DisruptionEngines(args: {
  sessionId: string;
  brandName: string;
  category: string;
  territories: TerritoryBlock[];
  stage2Output: string;
  stage4bOutput?: string | null;
  stage6Output?: string | null;
  briefText?: string | null;
}): Promise<Map<string, DisruptionCandidate[]>> {
  const jobs: Array<Promise<DisruptionCandidate>> = [];
  for (const t of args.territories) {
    for (const engine of STAGE_8_DISRUPTION_ENGINES) {
      jobs.push(
        runOne({
          engine,
          sessionId: args.sessionId,
          territoryName: t.name,
          territoryBlock: t.markdown,
          baseProposition: extractBaseProposition(t.markdown),
          brandName: args.brandName,
          category: args.category,
          stage2Output: args.stage2Output,
          stage4bOutput: args.stage4bOutput,
          stage6Output: args.stage6Output,
          briefText: args.briefText,
        }),
      );
    }
  }
  const results = await Promise.all(jobs);
  const byTerritory = new Map<string, DisruptionCandidate[]>();
  for (const r of results) {
    const list = byTerritory.get(r.territoryName) ?? [];
    list.push(r);
    byTerritory.set(r.territoryName, list);
  }
  // preserve engine order within each territory
  for (const [k, list] of byTerritory) {
    list.sort(
      (a, b) =>
        STAGE_8_DISRUPTION_ENGINES.indexOf(a.engine) - STAGE_8_DISRUPTION_ENGINES.indexOf(b.engine),
    );
    byTerritory.set(k, list);
  }
  return byTerritory;
}

export const CANDIDATE_SET_HEADING = "### CANDIDATE SET — select one";

/**
 * HARD LENGTH GATE for the BASE generator's proposition lines (the `> ` line
 * in each territory block). Any line outside 4–12 words is compressed by a
 * dedicated call. Returns the rewritten Stage 8 markdown.
 */
export async function enforceBaseLengthGate(
  coreStage8: string,
  sessionId: string,
): Promise<string> {
  const lines = coreStage8.split("\n");
  let territory = "this territory";
  for (let i = 0; i < lines.length; i++) {
    const h = lines[i].match(/^##\s+(.+?)\s*$/);
    if (h) {
      territory = h[1].replace(/^\*+|\*+$/g, "").trim();
      continue;
    }
    const m = lines[i].match(/^(\s*>\s+)(.+)$/);
    if (!m) continue;
    const prefix = m[1];
    let line = m[2].trim();
    const bold = line.startsWith("**") && line.endsWith("**");
    let bare = bold ? line.slice(2, -2).trim() : line;
    let words = countPropositionWords(bare);
    let tries = 0;
    while ((words > MAX_PROPOSITION_WORDS || words < MIN_PROPOSITION_WORDS) && tries < 2) {
      tries++;
      try {
        const reply: string = await callClaude({
          systemPrompt: COMPRESSION_SYSTEM_PROMPT,
          userMessage: buildCompressionMessage({ engine: "breach", territoryName: territory, line: bare }),
          maxTokens: 200,
          sessionId,
          stageLabel: `Stage 8 base length gate — ${territory}`,
          stageNumber: "8",
          stageName: "Proposition Generation",
        });
        const fixed = reply
          .trim()
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean)[0];
        if (!fixed) break;
        bare = fixed.replace(/^["“”'‘’]+|["“”'‘’]+$/g, "").trim();
        words = countPropositionWords(bare);
      } catch {
        break;
      }
    }
    line = bold ? `**${bare}**` : bare;
    lines[i] = `${prefix}${line}`;
  }
  return lines.join("\n");
}


function renderCandidateSet(base: string | null, candidates: DisruptionCandidate[]): string {
  const rows: string[] = [];
  const baseWords = base ? countPropositionWords(base) : null;
  rows.push(
    `**A · BASE** — ${base ?? "_no base proposition parsed_"}${baseWords ? `  _(${baseWords}w)_` : ""}`,
  );
  const letters = ["B", "C", "D"];
  candidates.forEach((c, i) => {
    const label = `**${letters[i] ?? String(i + 2)} · ${DISRUPTION_ENGINE_LABEL[c.engine]}**`;
    if (!c.proposition) {
      rows.push(`${label} — _no output — ${c.error ?? "engine returned nothing"}_`);
      return;
    }
    const w = c.words ? `  _(${c.words}w)_` : "";
    if (c.anchored === false) {
      rows.push(
        `${label} — ~~${c.proposition}~~${w}\n  ${renderAnchorFailure(c.anchorReason ?? "no real capability defends this line")}`,
      );
      return;
    }
    const anchor = c.anchor ? `\n  _Anchor: ${c.anchor}_` : "";
    rows.push(`${label} — ${c.proposition}${w}${anchor}`);
  });
  return `${CANDIDATE_SET_HEADING}\n\n${rows.join("\n\n")}\n\n_Human selection required — no candidate is pre-selected._`;
}

/**
 * Merge candidates into the core Stage 8 markdown, per territory.
 * Territory matching is exact-name first, then case-insensitive.
 */
export function mergeCandidatesIntoStage8(
  coreStage8: string,
  byTerritory: Map<string, DisruptionCandidate[]>,
): string {
  const blocks = splitStage8Blocks(coreStage8);
  if (blocks.length === 0) return coreStage8;

  const lookup = new Map<string, DisruptionCandidate[]>();
  for (const [name, list] of byTerritory) lookup.set(name.toLowerCase(), list);

  const merged = blocks.map((b) => {
    const list = byTerritory.get(b.name) ?? lookup.get(b.name.toLowerCase()) ?? [];
    if (list.length === 0) return b.markdown;
    return `${b.markdown}\n\n${renderCandidateSet(extractBaseProposition(b.markdown), list)}`;
  });

  const preamble = coreStage8.slice(0, coreStage8.indexOf(blocks[0].markdown.split("\n")[0]));
  return `${preamble}${merged.join("\n\n")}`.replace(/\s+$/, "");
}


/**
 * UNIVERSAL ANCHOR GATE for the BASE generator's proposition in each
 * territory block. Same shared gate as the Disruption engines and the 13
 * LOC engines — no separate implementation.
 */
export async function enforceBaseAnchorGate(
  coreStage8: string,
  ctx: {
    sessionId: string;
    brandName: string;
    category: string;
    stage4bOutput?: string | null;
    briefText?: string | null;
  },
): Promise<string> {
  const blocks = splitStage8Blocks(coreStage8);
  if (blocks.length === 0) return coreStage8;
  const capabilityEvidence = [ctx.stage4bOutput, ctx.briefText].filter(Boolean).join("\n\n");

  const out = await Promise.all(
    blocks.map(async (b) => {
      const base = extractBaseProposition(b.markdown);
      if (!base) return b.markdown;
      const supplied = pickLine(b.markdown, /^\s*(?:\*\*)?Anchor:(?:\*\*)?\s*(.+)$/i);
      const verdict = await enforcePropositionAnchor({
        sessionId: ctx.sessionId,
        proposition: base,
        suppliedAnchor: supplied,
        brandName: ctx.brandName,
        category: ctx.category,
        capabilityEvidence,
        label: `Stage 8 BASE — ${b.name}`,
      });
      const stripped = b.markdown
        .split("\n")
        .filter((l) => !/^\s*(?:\*\*)?Anchor:/i.test(l))
        .join("\n")
        .replace(/\s+$/g, "");
      const line = verdict.anchored
        ? `**Anchor:** ${verdict.anchor}`
        : renderAnchorFailure(verdict.reason || "no real capability defends this line");
      return `${stripped}\n\n${line}`;
    }),
  );
  return out.join("\n\n");
}
