export type OutputGateMode = "live" | "test";

export type BannedWordHit = {
  word: string;
  match: string;
  index: number;
  rule: string;
  stageLabel: string;
  columnLabel: string;
};

export type OutputGateResult = {
  output: string;
  attempts: number;
  sanitised: boolean;
  hits: BannedWordHit[];
};

const REPLACEMENTS: Record<string, string> = {
  apology: "concession",
  apologies: "concessions",
  apologise: "respond",
  apologize: "respond",
  guilt: "burden",
  guilty: "burdened",
  permission: "approval",
  transformation: "change",
  transform: "change",
  transformed: "changed",
  transforming: "changing",
  journey: "path",
  authentic: "credible",
  authenticity: "credibility",
  unleash: "release",
  unleashed: "released",
  unleashing: "releasing",
  elevate: "improve",
  elevated: "improved",
  elevating: "improving",
  redefine: "reset",
  redefined: "reset",
  redefining: "resetting",
  empower: "enable",
  empowerment: "agency",
  innovative: "new",
  innovation: "new thinking",
  seamless: "frictionless",
  ecosystem: "system",
  synergy: "fit",
  holistic: "whole",
  "purpose-driven": "purposeful",
  storytelling: "narrative craft",
  engage: "involve",
  engagement: "involvement",
  passion: "commitment",
  passionate: "committed",
  "best-in-class": "leading",
  "world-class": "excellent",
  "cutting-edge": "advanced",
  "next-level": "stronger",
  reimagine: "rethink",
  reimagining: "rethinking",
  reward: "return",
  rewards: "returns",
  earn: "build",
  earned: "built",
  earning: "building",
  deserve: "merit",
  deserved: "merited",
  deserves: "merits",
};

function escapeRegex(term: string): string {
  return term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function termRegex(term: string): RegExp {
  const escaped = escapeRegex(term).replace(/\\ /g, "\\s+");
  return new RegExp(`(^|[^A-Za-z0-9])(${escaped})(?=$|[^A-Za-z0-9])`, "gi");
}

export function findBannedWordHits(args: {
  text: string;
  terms: readonly string[];
  rule: string;
  stageLabel: string;
  columnLabel: string;
}): BannedWordHit[] {
  const hits: BannedWordHit[] = [];
  const seen = new Set<string>();
  for (const word of args.terms) {
    const rx = termRegex(word);
    let match: RegExpExecArray | null;
    while ((match = rx.exec(args.text)) !== null) {
      const matchedWord = match[2] ?? match[0].trim();
      const index = match.index + (match[1]?.length ?? 0);
      const key = `${word}:${index}:${matchedWord.toLowerCase()}:${args.rule}`;
      if (seen.has(key)) continue;
      seen.add(key);
      hits.push({
        word,
        match: matchedWord,
        index,
        rule: args.rule,
        stageLabel: args.stageLabel,
        columnLabel: args.columnLabel,
      });
    }
  }
  return hits.sort((a, b) => a.index - b.index);
}

export function replaceBannedWordHits(text: string, hits: readonly BannedWordHit[]): string {
  const terms = Array.from(new Set(hits.map((hit) => hit.word))).sort((a, b) => b.length - a.length);
  let out = text;
  for (const term of terms) {
    out = out.replace(termRegex(term), (full, prefix: string, matched: string) => {
      const replacement = REPLACEMENTS[matched.toLowerCase()] ?? REPLACEMENTS[term.toLowerCase()] ?? "";
      return `${prefix}${replacement}`;
    });
  }
  return out.replace(/[ \t]{2,}/g, " ").replace(/\s+([.,;:!?])/g, "$1");
}

function wordsForLog(hits: readonly BannedWordHit[]): string {
  return Array.from(new Set(hits.map((hit) => `${hit.match}/${hit.rule}`))).join(", ");
}

function retryInstruction(hits: readonly BannedWordHit[], stageLabel: string, columnLabel: string): string {
  const words = Array.from(new Set(hits.map((hit) => hit.match))).join(", ");
  return `\n\nOUTPUT VALIDATION FAILURE — ${stageLabel} / ${columnLabel}\nThe previous attempt contained banned term(s): ${words}. Regenerate the entire ${columnLabel} output from a different strategic wording. Do not include those terms or close variants. Preserve the required structure and substance without using the banned language.`;
}

export async function generateWithBannedWordGate(args: {
  stageLabel: string;
  columnLabel: string;
  mode: OutputGateMode;
  maxAttempts?: number;
  generate: (attempt: number, retryNote: string | null) => Promise<string>;
  validate: (output: string) => BannedWordHit[];
}): Promise<OutputGateResult> {
  const maxAttempts = args.maxAttempts ?? 3;
  let retryNote: string | null = null;
  let output = "";
  let hits: BannedWordHit[] = [];

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    output = await args.generate(attempt, retryNote);
    hits = args.validate(output);
    if (hits.length === 0) return { output, attempts: attempt, sanitised: false, hits: [] };

    console.error(
      `[OUTPUT-GATE] stage="${args.stageLabel}" column="${args.columnLabel}" mode=${args.mode} attempt=${attempt}/${maxAttempts} event=reject words="${wordsForLog(hits)}"`,
    );

    if (attempt < maxAttempts) {
      retryNote = retryInstruction(hits, args.stageLabel, args.columnLabel);
    }
  }

  if (args.mode === "test") {
    throw new Error(
      `${args.stageLabel} ${args.columnLabel} failed banned-word gate after ${maxAttempts} runtime attempts: ${wordsForLog(hits)}`,
    );
  }

  console.error(
    `[OUTPUT-GATE] stage="${args.stageLabel}" column="${args.columnLabel}" mode=live event=last_resort_sanitise words="${wordsForLog(hits)}"`,
  );
  output = replaceBannedWordHits(output, hits);
  const remaining = args.validate(output);
  if (remaining.length > 0) {
    output = replaceBannedWordHits(output, remaining);
  }
  return { output, attempts: maxAttempts, sanitised: true, hits };
}
