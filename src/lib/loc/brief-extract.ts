// Extract the ONLY three inputs LOC engines are permitted to see:
//   1. Anchored tension (verbatim from the Briefing Room handoff)
//   2. Raw human truths from Briefing Room Step 2 (unfiltered)
//   3. Product facts as stated in the brief
//
// LOC engines must NOT see any Stage 2/3/4/4B/5/6/7/8 output. Their value
// is structural independence from the pipeline's frame.
//
// Preferred source of unfiltered human truths is briefing_room_workspaces
// (workspace.truths). Fallback: extract from the composed brief_text.

export type LocInputs = {
  brandName: string;
  category: string;
  anchoredTension: string; // verbatim from Briefing Room Step 4
  anchoredTensionMeta: string; // frame + why it matters
  rawHumanTruths: string; // Step 2, unfiltered
  productFacts: string; // brief RTB / f9 as stated
  audienceStatement: string; // brief f6 as stated
  primaryBarrier: string; // brief f4 as stated
  realProblem: string;
  realOpportunity: string;
  culturalMoment: string; // if present in truths
  briefingRoomDiagnosisSummary: string; // one paragraph for classifier
  sourceNote: string; // where each field came from
  rawBrief: string; // the full brief_text as pasted, verbatim
};

type WorkspaceTruths = {
  truths?: Array<{
    text: string;
    category?: string;
    source?: string;
    tag_type?: string;
    role?: string;
    thorpe_candidate?: boolean;
  }>;
};

type WorkspaceDiagnosis = {
  real_problem?: { statement?: string };
  real_opportunity?: { statement?: string };
  why_are_we_here?: { statement?: string };
  problem_shapes?: string[];
};

type WorkspaceTensions = {
  candidate_tensions?: Array<{
    statement?: string;
    frame?: string;
    why_it_matters?: string;
  }>;
  no_tension_flag?: boolean;
  no_tension_reason?: string;
};

export type WorkspaceInputSnapshot = {
  truths: WorkspaceTruths | null;
  diagnosis: WorkspaceDiagnosis | null;
  tensions: WorkspaceTensions | null;
  selected_tension_index: number | null;
  selected_frame: string | null;
};

function extractAnchorBlock(briefText: string): string {
  const startTag = "=== BRIEFING ROOM STRATEGIC ANCHOR ===";
  const endTag = "=== END BRIEFING ROOM STRATEGIC ANCHOR ===";
  const i = briefText.indexOf(startTag);
  const j = briefText.indexOf(endTag);
  if (i === -1 || j === -1 || j <= i) return "";
  return briefText.slice(i, j + endTag.length);
}

function extractSection(briefText: string, sectionNum: string): string {
  // Sections composed as "## <num>. <title>\n<body>"
  const re = new RegExp(`^##\\s+${sectionNum}\\.\\s+.*?$([\\s\\S]*?)(?=^##\\s+\\d|\\z)`, "m");
  const m = briefText.match(re);
  return m ? m[1].trim() : "";
}

function extractAnchoredTensionFromBlock(anchor: string): { tension: string; meta: string } {
  // Look for "ANCHORED TENSION" label; capture the two lines that follow.
  const m = anchor.match(/ANCHORED TENSION[^\n]*:\s*\n\s*(.*)\n\s*(Frame:[^\n]*)/);
  if (m) return { tension: m[1].trim(), meta: m[2].trim() };
  const none = anchor.match(/ANCHORED TENSION:\s*NONE[^\n]*(?:\n\s*Reason:\s*([^\n]+))?/);
  if (none) return { tension: "NONE — no genuine tension surfaced from the material.", meta: none[1] ? `Reason: ${none[1].trim()}` : "" };
  return { tension: "", meta: "" };
}

function extractRealProblem(anchor: string): string {
  const m = anchor.match(/REAL PROBLEM:\s*([^\n]+)/);
  return m ? m[1].trim() : "";
}
function extractRealOpportunity(anchor: string): string {
  const m = anchor.match(/REAL OPPORTUNITY:\s*([^\n]+)/);
  return m ? m[1].trim() : "";
}

export function buildLocInputs(args: {
  brandName: string;
  category: string;
  briefText: string;
  workspace: WorkspaceInputSnapshot | null;
}): LocInputs {
  const anchor = extractAnchorBlock(args.briefText);

  // 1. Anchored tension — prefer workspace (raw), fall back to anchor block.
  let anchoredTension = "";
  let anchoredTensionMeta = "";
  if (
    args.workspace?.tensions?.candidate_tensions &&
    typeof args.workspace.selected_tension_index === "number" &&
    args.workspace.tensions.candidate_tensions[args.workspace.selected_tension_index]
  ) {
    const t = args.workspace.tensions.candidate_tensions[args.workspace.selected_tension_index];
    anchoredTension = (t.statement ?? "").trim();
    anchoredTensionMeta = `Frame: ${t.frame ?? "unspecified"} | Why it matters: ${t.why_it_matters ?? ""}`.trim();
  } else if (args.workspace?.tensions?.no_tension_flag) {
    anchoredTension = "NONE — Step 4 no-tension flag raised.";
    anchoredTensionMeta = `Reason: ${args.workspace.tensions.no_tension_reason ?? "unspecified"}`;
  } else {
    const fromAnchor = extractAnchoredTensionFromBlock(anchor);
    anchoredTension = fromAnchor.tension;
    anchoredTensionMeta = fromAnchor.meta;
  }

  // 2. Raw human truths — prefer workspace (unfiltered), fall back to f6.
  let rawHumanTruths = "";
  let culturalMoment = "";
  if (args.workspace?.truths?.truths?.length) {
    const humans = args.workspace.truths.truths.filter((t) => t.category === "human");
    const cultural = args.workspace.truths.truths.filter((t) => t.category === "cultural");
    rawHumanTruths = humans.length
      ? humans
          .map(
            (t) =>
              `- ${t.text} [source: ${t.source ?? "unspecified"}${t.tag_type ? ` | type: ${t.tag_type}` : ""}${t.role ? ` | role: ${t.role}` : ""}${t.thorpe_candidate ? " | thorpe-candidate" : ""}]`,
          )
          .join("\n")
      : "(no human/behavioural truths captured in Briefing Room Step 2)";
    culturalMoment = cultural.length ? cultural.map((t) => `- ${t.text}`).join("\n") : "";
  } else {
    rawHumanTruths = extractSection(args.briefText, "6") || "(no audience section captured)";
  }

  // 3. Product facts — prefer workspace, fall back to f9.
  let productFacts = "";
  if (args.workspace?.truths?.truths?.length) {
    const product = args.workspace.truths.truths.filter((t) => t.category === "product");
    const brand = args.workspace.truths.truths.filter((t) => t.category === "brand");
    const combined = [...product, ...brand];
    productFacts = combined.length
      ? combined.map((t) => `- ${t.text} [source: ${t.source ?? "unspecified"}${t.tag_type ? ` | type: ${t.tag_type}` : ""}]`).join("\n")
      : "(no product/brand truths captured in Briefing Room Step 2)";
  } else {
    productFacts = extractSection(args.briefText, "9") || "(no reason-to-believe section captured)";
  }

  const audienceStatement = extractSection(args.briefText, "6");
  const primaryBarrier = extractSection(args.briefText, "4");
  const realProblem =
    args.workspace?.diagnosis?.real_problem?.statement?.trim() ||
    extractRealProblem(anchor) ||
    "(not diagnosed)";
  const realOpportunity =
    args.workspace?.diagnosis?.real_opportunity?.statement?.trim() ||
    extractRealOpportunity(anchor) ||
    "(not diagnosed)";

  const diagSummaryParts: string[] = [];
  if (realProblem && realProblem !== "(not diagnosed)")
    diagSummaryParts.push(`Real problem: ${realProblem}`);
  if (realOpportunity && realOpportunity !== "(not diagnosed)")
    diagSummaryParts.push(`Real opportunity: ${realOpportunity}`);
  if (args.workspace?.diagnosis?.why_are_we_here?.statement)
    diagSummaryParts.push(
      `Why we are here: ${args.workspace.diagnosis.why_are_we_here.statement}`,
    );
  if (args.workspace?.diagnosis?.problem_shapes?.length)
    diagSummaryParts.push(
      `Problem shape(s): ${args.workspace.diagnosis.problem_shapes.join(", ")}`,
    );
  const briefingRoomDiagnosisSummary =
    diagSummaryParts.join("\n") || "(no Briefing Room diagnosis captured)";

  const sourceNote = args.workspace
    ? "Inputs sourced from the Briefing Room workspace (raw, unfiltered Step 2 truths and Step 4 tension)."
    : "Inputs extracted from brief_text only (Briefing Room workspace not linked to this session — human truths shown are the relevance-filtered set that shipped to Stage 1).";

  return {
    brandName: args.brandName,
    category: args.category,
    anchoredTension,
    anchoredTensionMeta,
    rawHumanTruths,
    productFacts,
    audienceStatement,
    primaryBarrier,
    realProblem,
    realOpportunity,
    culturalMoment,
    briefingRoomDiagnosisSummary,
    sourceNote,
  };
}

// A compact block engines can drop into their user message. Deliberately
// omits Stage 2/3/4/etc — that is the whole point of the LOC track.
export function renderLocInputsBlock(inputs: LocInputs): string {
  return `Brand: ${inputs.brandName}
Category: ${inputs.category}

[Source] ${inputs.sourceNote}

=== ANCHORED TENSION (verbatim from Briefing Room Step 4) ===
${inputs.anchoredTension || "(none)"}
${inputs.anchoredTensionMeta}

=== RAW HUMAN TRUTHS (verbatim from Briefing Room Step 2 — UNFILTERED) ===
${inputs.rawHumanTruths}

${inputs.culturalMoment ? `=== CULTURAL TRUTHS (Briefing Room Step 2) ===\n${inputs.culturalMoment}\n` : ""}=== PRODUCT FACTS (as stated in the brief) ===
${inputs.productFacts}

=== BRIEFING ROOM DIAGNOSIS (real problem / real opportunity — for task-type context only, NOT to be treated as a strategic conclusion) ===
${inputs.briefingRoomDiagnosisSummary}

=== AUDIENCE (as stated) ===
${inputs.audienceStatement || "(not captured)"}

=== PRIMARY BARRIER (as stated) ===
${inputs.primaryBarrier || "(not captured)"}

You have NOT been shown, and MUST NOT infer or reconstruct: the Stage 2 category intelligence map, Stage 3 strategic frameworks, Stage 4 territory universes, Stage 4B distinctive asset mining, Stage 5 audience insights, Stage 6 validated insights, Stage 7 territory synthesis, or Stage 8 core SMPs. Your value is structural independence from the pipeline's frame.`;
}
