// Wire the Stage 9 Distinctiveness Check outcome into the Stage 12 LOC pool.
//
// Stage 9 runs every LOC engine line through the same rubric as the Funnel
// candidates and closes with a CANDIDATE DISPOSITION ledger:
//
//   LOC-3 | REBUILT INTO | <stronger line> — <what changed and why>
//   LOC-4 | REJECTED     | <reason>
//   LOC-5 | SURVIVED     | <line>
//
// Until now that verdict was prose only: the selection screen still offered
// the raw pre-rebuild engine lines from loc_decision_packages. This module
// parses the ledger and applies it — REJECTED engines drop out of the pool,
// REBUILT engines are offered as the rebuilt line with the original kept
// visible underneath.

import type { LocEnginePackage } from "./decision-package";

export type LocVerdict = "SURVIVED" | "REBUILT" | "REJECTED";

export type LocDisposition = {
  /** 1-based candidate index, matching the LOC-n ids Stage 9 was given. */
  index: number;
  verdict: LocVerdict;
  /** The surviving/rebuilt line, when the ledger stated one. */
  line?: string;
  /** Reason (REJECTED) or what-changed note (REBUILT). */
  reason?: string;
};

export type LocPackageWithDisposition = LocEnginePackage & {
  /** Original engine line, present only when Stage 9 rebuilt it. */
  rebuiltFromLine?: string;
  /** One-line note on what Stage 9 changed and why. */
  rebuiltNote?: string;
  stage9Verdict?: LocVerdict;
};

export type LocRejection = {
  index: number;
  engine: string;
  line: string;
  reason: string;
};

function cleanCell(raw: string): string {
  return raw
    .replace(/\*\*/g, "")
    .replace(/\s+/g, " ")
    .replace(/^["“”'`]+|["“”'`]+$/g, "")
    .trim();
}

/** Split a "<line> — <why>" cell into the line and the explanation. */
function splitLineAndReason(cell: string): { line?: string; reason?: string } {
  const m = cell.match(/^(.*?)\s+[—–-]{1,2}\s+(.*)$/);
  if (m && cleanCell(m[1]!).length >= 4) {
    return { line: cleanCell(m[1]!), reason: cleanCell(m[2]!) };
  }
  const line = cleanCell(cell);
  return line.length >= 4 && line.length <= 200 ? { line } : { reason: line || undefined };
}

/**
 * Parse every `LOC-n | VERDICT | ...` row out of Stage 9 output.
 * First verdict per id wins (coverage-completion rows are only ever appended
 * for ids that had no row).
 */
export function parseLocDispositions(stage9Output: string | null | undefined): Map<number, LocDisposition> {
  const out = new Map<number, LocDisposition>();
  for (const raw of (stage9Output ?? "").split("\n")) {
    const line = raw.replace(/^[\s>|*-]+/, "").trim();
    const m = line.match(
      /^(?:\*\*)?LOC-(\d+)(?:\*\*)?\s*\|\s*(?:\*\*)?\s*(SURVIVED|REBUILT\s+INTO|REBUILT|REJECTED)\s*(?:\*\*)?\s*(?:\|\s*)?([\s\S]*)$/i,
    );
    if (!m) continue;
    const index = Number(m[1]);
    if (!Number.isFinite(index) || out.has(index)) continue;
    const verdictRaw = m[2]!.toUpperCase();
    const verdict: LocVerdict = verdictRaw.startsWith("REBUILT")
      ? "REBUILT"
      : verdictRaw.startsWith("REJECTED")
        ? "REJECTED"
        : "SURVIVED";
    const rest = (m[3] ?? "").replace(/\|+\s*$/, "").trim();
    if (verdict === "REJECTED") {
      out.set(index, { index, verdict, reason: cleanCell(rest) || undefined });
      continue;
    }
    const { line: parsedLine, reason } = splitLineAndReason(rest);
    out.set(index, {
      index,
      verdict,
      ...(parsedLine ? { line: parsedLine } : {}),
      ...(reason ? { reason } : {}),
    });
  }
  return out;
}

/**
 * Apply the ledger to the raw engine packages.
 *
 * Candidate index mapping mirrors `extractLocCandidates`: packages with a
 * non-empty proposition, in array order, numbered from 1.
 */
export function applyLocDispositions(
  packages: LocEnginePackage[] | null | undefined,
  stage9Output: string | null | undefined,
): {
  packages: LocPackageWithDisposition[];
  rejected: LocRejection[];
  rebuiltCount: number;
  ledgerFound: boolean;
} {
  const list = Array.isArray(packages) ? packages : [];
  const ledger = parseLocDispositions(stage9Output);
  if (ledger.size === 0) {
    return { packages: list as LocPackageWithDisposition[], rejected: [], rebuiltCount: 0, ledgerFound: false };
  }

  const kept: LocPackageWithDisposition[] = [];
  const rejected: LocRejection[] = [];
  let rebuiltCount = 0;
  let candidateIndex = 0;

  for (const pkg of list) {
    const original = (pkg.engineOutput?.proposition ?? "").toString().trim();
    if (!original) {
      kept.push(pkg as LocPackageWithDisposition);
      continue;
    }
    candidateIndex += 1;
    const d = ledger.get(candidateIndex);
    if (!d) {
      kept.push(pkg as LocPackageWithDisposition);
      continue;
    }
    if (d.verdict === "REJECTED") {
      rejected.push({
        index: candidateIndex,
        engine: String(pkg.engine ?? ""),
        line: original,
        reason: d.reason || "Rejected at the Stage 9 Distinctiveness Check (no reason recorded).",
      });
      continue;
    }
    const rebuiltLine = d.line && d.line.toLowerCase() !== original.toLowerCase() ? d.line : undefined;
    if (d.verdict === "REBUILT" && rebuiltLine) rebuiltCount += 1;
    kept.push({
      ...pkg,
      engineOutput: {
        ...pkg.engineOutput,
        ...(rebuiltLine ? { proposition: rebuiltLine } : {}),
      },
      ...(rebuiltLine ? { rebuiltFromLine: original } : {}),
      ...(rebuiltLine && d.reason ? { rebuiltNote: d.reason } : {}),
      stage9Verdict: d.verdict,
    });
  }

  return { packages: kept, rejected, rebuiltCount, ledgerFound: true };
}
