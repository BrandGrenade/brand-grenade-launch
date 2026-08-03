// LOC integrity assertions — the single source of truth for "is the
// Left-of-Centre track healthy?".
//
// Used by Tier Two Check 13. Deliberately server-only and orchestrator-
// agnostic: it reads the persisted result of a real LOC run and asserts the
// contract, so it cannot drift from the engine list the way the old
// scripts/loc-verify.ts (hardcoded 4 of 13 engines) did.
//
// NOTE ON THE CLASSIFIER: the current orchestrator (src/lib/loc.functions.ts)
// has NO classifier stage — loc_task_type / loc_task_runner_up /
// loc_classifier_rationale are written as null by design since the
// nine-engine rebuild. This module therefore asserts the *actual* contract
// (task type absent) rather than pretending a classifier runs. If a
// classifier is ever reinstated, flip EXPECT_CLASSIFIER to true.

import { LOC_ENGINES, type EngineName } from "./loc/task-types";

const EXPECT_CLASSIFIER = false;

/** Engines that must produce a genuinely single-word `word` field. */
const SINGLE_WORD_ENGINES: EngineName[] = ["one_word_ownership"];

const MIN_PROCESS_CHARS = 40;
const MIN_DESCRIPTOR_CHARS = 15;
const MIN_PROPOSITION_CHARS = 8;
const FRESH_TIMESTAMP_MS = 60 * 60 * 1000;

type EngineOutputShape = {
  engine?: string;
  process?: string;
  proposition?: string;
  descriptor?: string;
  word?: string;
  anchor?: string;
  anchored?: boolean;
  anchorSource?: string;
};

type PackageShape = {
  engine?: string;
  engineOutput?: EngineOutputShape;
  validation?: unknown;
  validationError?: string | null;
};

export type LocIntegrityRow = {
  loc_status: string | null;
  loc_error: string | null;
  loc_task_type: string | null;
  loc_generated_at: string | null;
  loc_engine_outputs: Record<string, { ok?: boolean; error?: string }> | null;
  loc_decision_packages: unknown;
  loc_validation: unknown;
  stage_9_leftofcentre_output: string | null;
};

/**
 * Throws on the first contract breach with a specific, actionable message.
 * Returns a one-line detail string on success.
 */
export function assertLocRunHealthy(row: LocIntegrityRow, runStartedAtMs: number): string {
  const problems: string[] = [];

  // ---- Terminal state -----------------------------------------------------
  if (row.loc_status !== "complete") {
    throw new Error(
      `loc_status is "${row.loc_status ?? "null"}" (expected "complete"). loc_error: ${row.loc_error ?? "none"}`,
    );
  }
  if (row.loc_error) problems.push(`loc_error is populated: ${row.loc_error}`);

  // ---- Fresh heartbeat/timestamp -----------------------------------------
  const genMs = row.loc_generated_at ? Date.parse(row.loc_generated_at) : NaN;
  if (!Number.isFinite(genMs)) {
    problems.push("loc_generated_at is missing or unparseable");
  } else if (genMs < runStartedAtMs - FRESH_TIMESTAMP_MS) {
    problems.push(
      `loc_generated_at (${row.loc_generated_at}) predates this run — stale timestamp, the run did not write a fresh completion`,
    );
  }

  // ---- Classifier ---------------------------------------------------------
  if (EXPECT_CLASSIFIER) {
    if (!row.loc_task_type) problems.push("loc_task_type is null but a classifier is expected");
  } else if (row.loc_task_type) {
    problems.push(
      `loc_task_type is "${row.loc_task_type}" but the orchestrator has no classifier stage — a column is being written by unexpected code`,
    );
  }

  // ---- Per-engine raw results --------------------------------------------
  const engineOutputs = row.loc_engine_outputs ?? {};
  const missingEngines = LOC_ENGINES.filter((e) => !(e in engineOutputs));
  if (missingEngines.length) {
    problems.push(`engines never reported at all: ${missingEngines.join(", ")}`);
  }
  const failedEngines = LOC_ENGINES.filter((e) => e in engineOutputs && !engineOutputs[e]?.ok).map(
    (e) => `${e} (${engineOutputs[e]?.error ?? "no error recorded"})`,
  );
  if (failedEngines.length) {
    problems.push(`engines returned no usable output: ${failedEngines.join("; ")}`);
  }

  // ---- Decision packages --------------------------------------------------
  const packages = Array.isArray(row.loc_decision_packages)
    ? (row.loc_decision_packages as PackageShape[])
    : [];
  if (packages.length === 0) {
    throw new Error("loc_decision_packages is empty — no candidates reached the selection pool");
  }
  const packagedEngines = new Set(packages.map((p) => String(p.engine ?? p.engineOutput?.engine ?? "")));
  const notPackaged = LOC_ENGINES.filter((e) => !packagedEngines.has(e));
  // The orchestrator packages the ANCHORED subset by design (loc.functions.ts:
  // `forSelection = anchored.length > 0 ? anchored : successful`). An engine that
  // returned usable output but was rejected by the universal anchor gate is a
  // correct outcome, not a track failure — record it, don't fail on it.
  const anchorExcluded = notPackaged.filter((e) => engineOutputs[e]?.ok === true);
  const genuinelyMissing = notPackaged.filter((e) => engineOutputs[e]?.ok !== true);
  if (genuinelyMissing.length) {
    problems.push(
      `engines missing from loc_decision_packages with no usable output: ${genuinelyMissing.join(", ")} (${packages.length}/${LOC_ENGINES.length} packaged)`,
    );
  }


  // ---- Field-level contract per package ----------------------------------
  let anchoredCount = 0;
  for (const pkg of packages) {
    const engine = String(pkg.engine ?? pkg.engineOutput?.engine ?? "unknown");
    const eo = pkg.engineOutput ?? {};
    const proposition = String(eo.proposition ?? "").trim();
    const descriptor = String(eo.descriptor ?? "").trim();
    const process = String(eo.process ?? "").trim();
    const isSingleWordEngine = SINGLE_WORD_ENGINES.includes(engine as EngineName);

    // Single-word engines have a DIFFERENT contract by design: their proposition
    // IS the owned word (see engine-prompts.ts — "EXACTLY ONE WORD"). Applying the
    // prose floor here would reject valid output like "Clean".
    if (isSingleWordEngine) {
      if (!proposition) problems.push(`${engine}: proposition (the owned word) is empty`);
      else if (/\s/.test(proposition) || !/^[A-Za-z][A-Za-z'’-]*$/.test(proposition))
        problems.push(`${engine}: proposition must be exactly one word — got "${proposition}"`);
    } else if (proposition.length < MIN_PROPOSITION_CHARS) {
      problems.push(`${engine}: proposition missing or too short ("${proposition}")`);
    }
    if (descriptor.length < MIN_DESCRIPTOR_CHARS)
      problems.push(`${engine}: descriptor missing or too short (${descriptor.length} chars)`);
    if (process.length < MIN_PROCESS_CHARS)
      problems.push(
        `${engine}: process chain-of-thought missing or too short (${process.length} chars, floor ${MIN_PROCESS_CHARS})`,
      );

    if (isSingleWordEngine) {
      const word = String(eo.word ?? "").trim();
      if (!word) {
        problems.push(`${engine}: required single-word "word" field is empty`);
      } else if (/\s/.test(word) || !/^[A-Za-z][A-Za-z'’-]*$/.test(word)) {
        problems.push(`${engine}: "word" is not a single word — got "${word}"`);
      }
    }


    const anchor = String(eo.anchor ?? "").trim();
    if (!anchor) problems.push(`${engine}: anchor is empty — the anchor gate did not resolve one`);
    if (!eo.anchorSource) problems.push(`${engine}: anchorSource unset — the anchor gate did not run`);
    if (eo.anchored) anchoredCount += 1;
  }
  if (anchoredCount === 0) {
    problems.push("no package passed the anchor gate — every proposition was rejected as unanchored");
  }

  // ---- Validation pass ----------------------------------------------------
  const validation = row.loc_validation as
    | { error?: string | null; entries?: Array<{ engine?: string; score?: unknown; error?: string }> }
    | null;
  if (!validation) {
    problems.push("loc_validation is null — the validation pass produced nothing");
  } else {
    if (validation.error) problems.push(`validation pass errored: ${validation.error}`);
    const entries = Array.isArray(validation.entries) ? validation.entries : [];
    if (entries.length === 0) {
      problems.push("loc_validation.entries is empty — validation returned no scored engines");
    } else {
      const scored = entries.filter((e) => e.score && typeof e.score === "object").length;
      if (scored === 0)
        problems.push(
          `validation produced ${entries.length} entries but every score is null — output was nulled rather than validated`,
        );
    }
  }

  // ---- Rendered markdown --------------------------------------------------
  const markdown = String(row.stage_9_leftofcentre_output ?? "");
  if (markdown.length < 500) {
    problems.push(`stage_9_leftofcentre_output too short (${markdown.length} chars) — markdown assembly failed`);
  }

  if (problems.length) throw new Error(problems.join(" | "));

  const validationEntries = Array.isArray(
    (row.loc_validation as { entries?: unknown[] } | null)?.entries,
  )
    ? ((row.loc_validation as { entries: unknown[] }).entries.length as number)
    : 0;

  return `All ${LOC_ENGINES.length} LOC engines returned usable output. ${packages.length}/${LOC_ENGINES.length} reached loc_decision_packages${anchorExcluded.length ? `; ${anchorExcluded.join(", ")} produced valid output but was held back by the anchor gate (expected behaviour, not a failure)` : ""}. Proposition / descriptor / process present on every package; one_word_ownership returned a genuine single word; anchor gate resolved on all ${packages.length} packages (${anchoredCount} passed the gate). Validation pass scored ${validationEntries} engines with no null-out. loc_status=complete with fresh loc_generated_at; markdown ${markdown.length} chars. Classifier intentionally absent (loc_task_type null) — current orchestrator has no classifier stage.`;
}

/** Synthetic Briefing Room workspace payload used to exercise the real LOC input path. */
export function buildPreflightLocWorkspace(brandName: string) {
  return {
    brand_name: brandName,
    category: "Australian premium energy drink",
    raw_brief:
      "Preflight LOC integrity fixture — synthetic Briefing Room workspace standing in for a real handoff.",
    supporting_evidence: [] as unknown[],
    status: "complete",
    selected_frame: "tension_1",
    selected_tension_index: 0,
    diagnosis: {
      real_problem: {
        statement:
          "Disciplined Australian men who train seriously read every label and find nothing in the energy category built to their standard.",
      },
      real_opportunity: {
        statement:
          "Own clean performance in Australian energy drinks — the standard the serious trainer already applies to food, applied to energy.",
      },
      why_are_we_here: {
        statement: "Red Bull owns urgency and youth and cannot credibly claim clean performance.",
      },
      problem_shapes: ["credibility gap", "category standard vacuum"],
    },
    truths: {
      truths: [
        {
          text: "He reads the ingredient panel before he reads the front of the can.",
          category: "consumer",
          source: "Preflight fixture",
          tag_type: "observed",
          role: "shape",
          thorpe_candidate: true,
        },
        {
          text: "Energy drinks are the one thing he consumes that he cannot defend to his training partner.",
          category: "cultural",
          source: "Preflight fixture",
          tag_type: "stated",
          role: "flip",
          thorpe_candidate: true,
        },
        {
          text: "Green-tea caffeine plus electrolytes is a formulation he would build himself.",
          category: "product",
          source: "Preflight fixture",
          tag_type: "evidence",
          role: "align",
          thorpe_candidate: false,
        },
      ],
    },
    tensions: {
      candidate_tensions: [
        {
          statement:
            "He holds every input to a standard, then drinks the one thing he cannot justify.",
          frame: "self-standard vs. convenience",
          why_it_matters:
            "The category asks him to lower his own standard to get through a session — that is the unresolved tension.",
        },
      ],
      no_tension_flag: false,
    },
  };
}
