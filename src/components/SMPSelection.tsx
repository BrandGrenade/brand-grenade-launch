import { useMemo, useState } from "react";
import { parseStage11Verdicts, parseStage10Scores, type Stage11Verdict } from "@/lib/stage12-filter";
import type { LocEnginePackage } from "@/lib/loc/decision-package";


export type SMPCardSource = "CORE" | `LOC — ${string}`;

export interface SMPCard {
  cardNumber: number;
  smpLine: string;
  whatItOwns: string;
  truth: string;
  whatItChallenges: string;
  whatItMakesPossible: string;
  whatItRequires: string;
  scores: {
    fame?: number;
    truthStrength?: number;
    competitiveImpossibility?: number;
    brandPermission?: number;
    cleanAir?: number;
    commercialPrecedent?: number;
    weightedComposite?: number;
    flags?: string[];
  };
  fieldName: string;
  iconicTierStatus: string;
  pressureTestNote: string;
  source?: SMPCardSource;
  /** Machine engine key for LOC cards (e.g. "the_moment"). CORE = undefined. */
  engineKey?: string;
  /** Stage 11 verdict + binding conditions for CORE cards. */
  stage11Verdict?: string;
  stage11Conditions?: string;
  loc10?: {
    genuine_surprise?: number;
    credible_path?: number;
    territory_richness?: number;
    competitive_permanence?: number;
    category_escape?: number;
  };
}

/** Payload returned to the caller when the human confirms a selection.
 *  - Option A (single): { core } or { loc }
 *  - Option B (combined): { core, loc } — both travel downstream. */
export interface SMPSelectionPayload {
  core?: SMPCard;
  loc?: SMPCard;
  source: "CORE" | "LOC" | "COMBINED";
  engineKey?: string;
}


// ----------------------------- PARSER -----------------------------

function extractScore(text: string, label: string): number | undefined {
  // Allow markdown bold/italic markers and stray punctuation between the
  // label and the number, e.g. "**Differentiation:**  9/10" or "Differentiation — 9/10".
  const pattern = new RegExp(
    label.replace(/\s+/g, "\\s+") + "[\\s*_:\\-—–]+(\\d+(?:\\.\\d+)?)\\s*\\/\\s*(?:10|60|70)",
    "i",
  );
  const m = text.match(pattern);
  return m ? parseFloat(m[1]) : undefined;
}

interface RawProp {
  line: string;
  owns: string;
  truth: string;
  challenge: string;
  makesPossible: string;
  requires: string;
  scores: SMPCard["scores"];
  fieldName: string;
  iconicTierStatus: string;
  pressureTestNote: string;
}

function parsePropositions(rawOutput: string): RawProp[] {
  const propositions: RawProp[] = [];
  if (!rawOutput) return propositions;

  // Only parse content within DELIVERABLE 1 — everything after (selection
  // framework, rationale stub, presentation order log, self-audit) contains
  // bold text that can be mis-detected as additional propositions.
  let scope = rawOutput;
  const endMarker = scope.search(
    /={2,}\s*DELIVERABLE\s+2|={2,}\s*DELIVERABLE\s+3|={2,}\s*PRESENTATION\s+ORDER|={2,}\s*SELF[-\s]AUDIT|\n\s*(?:\*{0,2})?SECTION\s+3\b|STRATEGIC\s+LANDSCAPE\s+SUMMARY/i,
  );
  if (endMarker > 0) scope = scope.slice(0, endMarker);

  const propBlockPattern =
    /(?:^|\n)(?:[═=]{3,}\s*\n)?\s*\*{0,2}PROPOSITION\s+\d+\*{0,2}[\s\S]*?(?=\n(?:[═=]{3,}\s*\n)?\s*\*{0,2}PROPOSITION\s+\d+\*{0,2}|$)/gi;
  const propBlocks = Array.from(scope.matchAll(propBlockPattern), (m) => m[0]).filter(
    (b) => b.trim().length > 50,
  );

  // Prefer PROPOSITION blocks. Stage 12 cards contain many internal divider
  // lines, so divider-first splitting fragments a single card into unusable
  // sections and causes the UI to fall through to manual entry.
  const contentBlocks = propBlocks.length
    ? propBlocks
    : scope.split(/[═=]{3,}/g).filter((b) => b.trim().length > 50);


  for (const block of contentBlocks) {
    if (
      !block.includes("**") &&
      !block.includes("Composite") &&
      !block.includes("Fame") &&
      !block.includes("Truth Strength")
    ) {
      continue;
    }
    // Note: [METADATA]…[/METADATA] is a per-card footer inside each PROPOSITION
    // block — do NOT treat it as a skip signal or every card is discarded.
    if (
      block.includes("SELF-AUDIT") ||
      block.includes("PRESENTATION ORDER") ||
      block.includes("SELECTION FRAMEWORK") ||
      block.includes("DELIVERABLE 2") ||
      block.includes("DELIVERABLE 3")
    ) {
      continue;
    }

    const grabSection = (label: string, stops: string[]): string => {
      const stopPattern = stops.map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
      const pattern = new RegExp(
        `${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\n+([\\s\\S]*?)(?=\\n\\s*(?:[─═=\\-]{3,}\\s*\\n\\s*)?(?:${stopPattern})|\\n\\[METADATA\\]|$)`,
        "i",
      );
      const m = block.match(pattern);
      return m
        ? m[1]
            .replace(/^[─═=\-]{3,}$/gm, "")
            .replace(/\[\/?METADATA\]/gi, "")
            .trim()
            .substring(0, 300)
        : "";
    };

    let propositionLine = "";
    const blockquoteBold = block.match(/>\s*\*\*([^*\n]+)\*\*/);
    if (blockquoteBold) propositionLine = blockquoteBold[1].trim();
    if (!propositionLine) {
      const boldMatches = block.match(/\*\*([^*\n]{10,80})\*\*/g);
      if (boldMatches && boldMatches.length > 0) {
        propositionLine = boldMatches[0].replace(/\*\*/g, "").trim();
      }
    }
    if (!propositionLine) {
      const beforeOwns = block.split(/WHAT THIS PROPOSITION OWNS/i)[0] ?? "";
      const candidates = beforeOwns
        .replace(/\*{0,2}PROPOSITION\s+\d+\*{0,2}/gi, "")
        .replace(/^[\s═=─\-]+$/gm, "")
        .split("\n")
        .map((line) => line.replace(/^>\s*/, "").replace(/^\*\*|\*\*$/g, "").trim())
        .filter(
          (line) =>
            line.length >= 2 &&
            line.length <= 120 &&
            !/^(DELIVERABLE|SECTION|CARD METADATA|STRATEGIC QUALITY|Note:)/i.test(line),
        );
      propositionLine = candidates[0] ?? "";
    }
    if (!propositionLine) continue;
    if (
      propositionLine.includes("PROPOSITION") ||
      propositionLine.includes("WHAT THIS") ||
      propositionLine.includes("THE TRUTH") ||
      propositionLine.length > 100
    ) {
      continue;
    }

    const owns = grabSection("WHAT THIS PROPOSITION OWNS", [
      "THE TRUTH IT IS BUILT ON",
      "WHAT IT CHALLENGES",
      "WHAT IT MAKES POSSIBLE",
    ]);
    const truth = grabSection("THE TRUTH IT IS BUILT ON", [
      "WHAT IT CHALLENGES",
      "WHAT IT MAKES POSSIBLE",
      "WHAT IT REQUIRES OF THE BRAND",
    ]);
    const challenge = grabSection("WHAT IT CHALLENGES", [
      "WHAT IT MAKES POSSIBLE",
      "WHAT IT REQUIRES OF THE BRAND",
      "STRATEGIC QUALITY SCORES",
    ]);
    const makesPossible = grabSection("WHAT IT MAKES POSSIBLE", [
      "WHAT IT REQUIRES OF THE BRAND",
      "STRATEGIC QUALITY SCORES",
    ]);
    const requires = grabSection("WHAT IT REQUIRES OF THE BRAND", [
      "STRATEGIC QUALITY SCORES",
      "\\[METADATA\\]",
    ]);

    const compositeRe = /(?:Weighted\s+)?Composite\s*:\s*(\d+(?:\.\d+)?)\s*\/\s*100/i;
    const compMatch = block.match(compositeRe);
    const flagRe = /⚠\s+[A-Z][A-Z\s]+:[^\n]+/g;
    const flags = Array.from(block.matchAll(flagRe), (m) => m[0].trim());
    const scores: SMPCard["scores"] = {
      fame: extractScore(block, "Fame"),
      truthStrength: extractScore(block, "Truth Strength"),
      competitiveImpossibility: extractScore(block, "Competitive Impossibility"),
      brandPermission: extractScore(block, "Brand Permission"),
      cleanAir: extractScore(block, "Clean Air"),
      commercialPrecedent: extractScore(block, "Commercial Precedent"),
      weightedComposite: compMatch ? parseFloat(compMatch[1]) : undefined,
      flags: flags.length ? flags : undefined,
    };

    const grabMeta = (label: string): string => {
      const m = block.match(new RegExp(`${label}\\s*:\\s*([^\\n]+)`, "i"));
      return m ? m[1].trim() : "";
    };
    const fieldName = grabMeta("FIELD_NAME");
    const iconicTierStatus = grabMeta("ICONIC_TIER_STATUS");
    const pressureTestNote = grabMeta("PRESSURE_TEST_NOTE");

    propositions.push({
      line: propositionLine,
      owns,
      truth,
      challenge,
      makesPossible,
      requires,
      scores,
      fieldName,
      iconicTierStatus,
      pressureTestNote,
    });
  }

  return propositions;
}

function parseStage10PassingAsVerdicts(stage10Output: string): Stage11Verdict[] {
  const scores = parseStage10Scores(stage10Output);
  return scores.map((score) => ({
    smpLine: score.smpLine,
    fieldName: score.fieldName,
    verdict: "VALIDATED",
    iconicStatus: "N/A",
    block: `SMP: "${score.smpLine}" — FIELD: ${score.fieldName}\nSMP VERDICT: VALIDATED`,
  }));
}

export function parseSMPCards(
  primary: string,
  stage11Fallback?: string,
  stage10ForScores?: string,
): SMPCard[] {
  const raw = parsePropositions(primary);
  console.log("Propositions found (stage 12): " + raw.length);
  if (raw.length > 0) {
    return raw.map((p, idx) => ({
      cardNumber: idx + 1,
      smpLine: p.line.replace(/^["""]|["""]$/g, "").trim(),
      whatItOwns: p.owns,
      truth: p.truth,
      whatItChallenges: p.challenge,
      whatItMakesPossible: p.makesPossible,
      whatItRequires: p.requires,
      scores: p.scores,
      fieldName: p.fieldName,
      iconicTierStatus: p.iconicTierStatus,
      pressureTestNote: p.pressureTestNote,
    }));
  }

  // Fallback: render the VALIDATED propositions from Stage 11 directly so the
  // human always sees the propositions, even when Stage 12 parsing fails or
  // Stage 12 output has not yet been produced.
  const stage11Verdicts = stage11Fallback
    ? parseStage11Verdicts(stage11Fallback).filter(
        (v) => v.verdict === "VALIDATED" || v.verdict === "VALIDATED WITH STRATEGIC NOTE",
      )
    : [];
  const verdicts = stage11Verdicts.length
    ? stage11Verdicts
    : stage10ForScores
      ? parseStage10PassingAsVerdicts(stage10ForScores)
      : [];
  if (verdicts.length === 0) return [];
  console.log("Propositions found (stage 11 fallback): " + verdicts.length);
  const scores = stage10ForScores ? parseStage10Scores(stage10ForScores) : [];
  const scoreByField = new Map(scores.map((s) => [s.fieldName.trim().toLowerCase(), s]));
  const scoreByLine = new Map(scores.map((s) => [s.smpLine.trim().toLowerCase(), s]));

  return verdicts.map((v, idx) => {
    const s =
      scoreByField.get(v.fieldName.trim().toLowerCase()) ??
      scoreByLine.get(v.smpLine.trim().toLowerCase());
    // Pull as much strategic detail from the Stage 11 verdict block as we can,
    // so the fallback card is genuinely readable — not just a one-line stub.
    const block = v.block;
    const grab = (label: RegExp): string => {
      const m = block.match(label);
      return m ? m[1].trim().slice(0, 400) : "";
    };
    const strategicNote = grab(
      /(?:STRATEGIC\s+NOTE|VERDICT\s+RATIONALE|RATIONALE)\s*:?\s*([^\n]+(?:\n(?!\s*[A-Z][A-Z ]{3,}:)[^\n]+)*)/i,
    );
    const whatItOwns = grab(/WHAT\s+IT\s+OWNS\s*:?\s*([^\n]+(?:\n(?!\s*[A-Z][A-Z ]{3,}:)[^\n]+)*)/i);
    const truth = grab(
      /(?:THE\s+TRUTH(?:\s+IT(?:\s+IS)?\s+BUILT\s+ON)?|TRUTH)\s*:?\s*([^\n]+(?:\n(?!\s*[A-Z][A-Z ]{3,}:)[^\n]+)*)/i,
    );
    const challenges = grab(
      /(?:WHAT\s+IT\s+CHALLENGES|CHALLENGES)\s*:?\s*([^\n]+(?:\n(?!\s*[A-Z][A-Z ]{3,}:)[^\n]+)*)/i,
    );
    const ownsLine =
      whatItOwns ||
      [v.verdict, v.iconicStatus && v.iconicStatus !== "N/A" ? `Iconic: ${v.iconicStatus}` : ""]
        .filter(Boolean)
        .join(" · ");

    return {
      cardNumber: idx + 1,
      smpLine: v.smpLine,
      whatItOwns: ownsLine,
      truth,
      whatItChallenges: challenges,
      whatItMakesPossible: "",
      whatItRequires: strategicNote,
      scores: s
        ? {
            fame: s.fame,
            truthStrength: s.truthStrength,
            competitiveImpossibility: s.competitiveImpossibility,
            brandPermission: s.brandPermission,
            cleanAir: s.cleanAir,
            commercialPrecedent: s.commercialPrecedent,
            weightedComposite: s.weightedComposite,
            flags: s.flags,
          }
        : {},
      fieldName: v.fieldName,
      iconicTierStatus: v.iconicStatus,
      pressureTestNote: v.verdict,
    };
  });
}


// Strip internal blocks from any text being shown to the user.
function cleanForDisplay(text: string): string {
  if (!text) return text;
  return text
    .replace(/\[METADATA\][\s\S]*?\[\/METADATA\]/gi, "")
    .replace(/\[SELECTION_RATIONALE_STUB\][\s\S]*?\[\/SELECTION_RATIONALE_STUB\]/gi, "")
    .replace(/={2,}\s*PRESENTATION\s+ORDER\s+LOG[\s\S]*?(?=\n={2,}\s*\S|$)/gi, "")
    .replace(/={2,}\s*SELF[-\s]AUDIT[\s\S]*?(?=\n={2,}\s*\S|$)/gi, "")
    .split("\n")
    .filter(
      (l) =>
        !/FIELD_NAME\s*:|ICONIC_TIER_STATUS\s*:|PRESSURE_TEST_NOTE\s*:|Randomisation\s+(Status|Confirmed)|Plain\s+Language\s+Compliance|Structural\s+Neutrality|Selection\s+Framework\s+Quality|internal,?\s*not\s+client[-\s]facing|Stage\s+12\s+awaiting\s+review/i.test(
          l,
        ),
    )
    .join("\n");
}

// ----------------------------- LOC CARDS -----------------------------

const LOC_ENGINE_DISPLAY: Record<string, string> = {
  inversion: "INVERSION",
  constraint: "CONSTRAINT",
  wrong_room: "WRONG ROOM",
  delete_customer: "DELETE THE CUSTOMER",
  worst_case: "WORST CASE",
  random_connection: "RANDOM CONNECTION",
  time_displacement: "TIME DISPLACEMENT",
  enemy_first: "ENEMY FIRST",
  subtract: "SUBTRACT",
  the_unsayable: "THE UNSAYABLE",
  the_moment: "THE MOMENT",
  one_word_ownership: "ONE WORD OWNERSHIP",
  invented_authority: "INVENTED AUTHORITY",
  // Legacy — pre-nine-engine rebuild. Rendered for backward-compat if
  // a historic session still has them persisted.
  breach: "BREACH",
  synect: "SYNECT",
  displace: "DISPLACE",
  naive: "NAIVE",
};

function buildLocCards(packages: LocEnginePackage[] | null, offset: number): SMPCard[] {
  if (!packages || packages.length === 0) return [];
  const cards: SMPCard[] = [];
  let i = 0;
  for (const pkg of packages) {
    const eo = pkg.engineOutput as { proposition?: string; descriptor?: string } | null;
    if (!eo) continue;
    const smpLine = (eo.proposition ?? "").trim();
    if (!smpLine) continue;
    const engineKey = String(pkg.engine ?? "");
    const display = LOC_ENGINE_DISPLAY[engineKey] ?? engineKey.toUpperCase();
    const label: SMPCardSource = `LOC — ${display}`;
    const descriptor = (eo.descriptor ?? "").toString().trim();

    // Six-dimension validation gate — spec: Truth Strength >= 5,
    // Competitive Impossibility >= 6. Skip LOC propositions that fail either.
    const v = pkg.validation ?? null;
    if (!v) continue;
    if ((v.truth_strength ?? 0) < 5) continue;
    if ((v.competitive_impossibility ?? 0) < 6) continue;

    // Derive human flags (mirror STAGE_10_FLAG_THRESHOLDS in stage12-filter).
    const flags: string[] = [];
    if ((v.fame ?? 0) < 6) flags.push("⚠ FAME: below 6 — low unpaid-conversation potential");
    if ((v.brand_permission ?? 0) < 5) flags.push("⚠ BRAND PERMISSION: below 5 — credibility gap");
    if ((v.clean_air ?? 0) < 5) flags.push("⚠ CLEAN AIR: below 5 — territory partly claimed");
    if ((v.commercial_precedent ?? 0) < 4) flags.push("⚠ COMMERCIAL PRECEDENT: below 4 — no clear precedent");
    if (v.rationale) flags.push(`Rationale: ${v.rationale}`);

    cards.push({
      cardNumber: offset + i + 1,
      smpLine,
      whatItOwns: descriptor.slice(0, 400),
      truth: "",
      whatItChallenges: "",
      whatItMakesPossible: "",
      whatItRequires: "",
      scores: {
        fame: v.fame,
        truthStrength: v.truth_strength,
        competitiveImpossibility: v.competitive_impossibility,
        brandPermission: v.brand_permission,
        cleanAir: v.clean_air,
        commercialPrecedent: v.commercial_precedent,
        weightedComposite: v.weightedScore,
        flags: flags.length ? flags : undefined,
      },
      fieldName: label,
      iconicTierStatus: "",
      pressureTestNote: pkg.validationError ?? "",
      source: label,
      engineKey,
    });
    i += 1;
  }
  return cards;
}


export function SMPSelection({
  stage12Output,
  stage11Output,
  stage10Output,
  locPackages,
  onSelect,
  onResubmit,
  resubmitting = false,
  enhancing = false,
}: {
  stage12Output: string;
  stage11Output?: string;
  stage10Output?: string;
  /** Optional LOC engine decision packages (from session.loc_decision_packages).
   *  When provided, validated LOC propositions are appended to the unified
   *  selection pool alongside CORE propositions. Only LOC propositions that
   *  pass the six-dimension floors (Truth Strength >= 5, Competitive
   *  Impossibility >= 6) are shown. */
  locPackages?: LocEnginePackage[] | null;
  onSelect: (payload: SMPSelectionPayload) => void;
  onResubmit?: (feedback: string) => void | Promise<void>;
  resubmitting?: boolean;
  /** True while Stage 12 Claude card formatting is still streaming in the background. */
  enhancing?: boolean;
}) {
  const stage11ByLine = useMemo(() => {
    if (!stage11Output) return new Map<string, Stage11Verdict>();
    const map = new Map<string, Stage11Verdict>();
    for (const v of parseStage11Verdicts(stage11Output)) {
      map.set(v.smpLine.trim().toLowerCase(), v);
    }
    return map;
  }, [stage11Output]);

  const coreCards = useMemo(() => {
    const parsed = parseSMPCards(stage12Output ?? "", stage11Output, stage10Output);
    return parsed.map((c) => {
      const v = stage11ByLine.get(c.smpLine.trim().toLowerCase());
      let stage11Verdict: string | undefined;
      let stage11Conditions: string | undefined;
      if (v) {
        stage11Verdict = v.verdict;
        const cond = v.block.match(
          /(?:BINDING\s+CONDITIONS?|CONDITIONS?)\s*:?\s*([\s\S]*?)(?=\n\s*(?:[A-Z][A-Z ]{3,}:|SMP\s+VERDICT|ICONIC|$))/i,
        );
        if (cond) stage11Conditions = cond[1].trim().slice(0, 500);
      }
      return {
        ...c,
        source: "CORE" as SMPCardSource,
        stage11Verdict,
        stage11Conditions,
      };
    });
  }, [stage12Output, stage11Output, stage10Output, stage11ByLine]);
  const locCards = useMemo(() => buildLocCards(locPackages ?? null, coreCards.length), [locPackages, coreCards.length]);
  const cards = useMemo(() => [...coreCards, ...locCards], [coreCards, locCards]);
  const usingStage11Fallback = useMemo(
    () => (stage12Output ? parsePropositions(stage12Output).length === 0 : true) && coreCards.length > 0,
    [stage12Output, coreCards.length],
  );


  const [selectedCoreIdx, setSelectedCoreIdx] = useState<number | null>(null);
  const [selectedLocIdx, setSelectedLocIdx] = useState<number | null>(null);
  const [showRaw, setShowRaw] = useState(false);
  const [manualLine, setManualLine] = useState("");
  const [manualField, setManualField] = useState("");
  const [revisionFeedback, setRevisionFeedback] = useState("");

  const cleanedOutput = useMemo(() => cleanForDisplay(stage12Output), [stage12Output]);

  const context = useMemo(() => {
    const src = cleanedOutput;
    const d1 = src.search(/={2,}\s*DELIVERABLE\s+1[^=]*={2,}/i);
    const p1 = src.search(/PROPOSITION\s+1\b/i);
    if (p1 < 0) return "";
    return src
      .slice(d1 >= 0 ? d1 : 0, p1)
      .replace(/={2,}\s*DELIVERABLE\s+1[^=]*={2,}/i, "")
      .replace(/═+/g, "")
      .replace(/SECTION\s+1[^\n]*\n/i, "")
      .replace(/SECTION\s+2[^\n]*\n/i, "")
      .trim();
  }, [cleanedOutput]);

  const toggleSelect = (idx: number) => {
    const card = cards[idx];
    if (!card) return;
    const isLoc = card.source && card.source !== "CORE";
    if (isLoc) {
      setSelectedLocIdx((prev) => (prev === idx ? null : idx));
    } else {
      setSelectedCoreIdx((prev) => (prev === idx ? null : idx));
    }
  };

  const selectedCore = selectedCoreIdx !== null ? cards[selectedCoreIdx] : undefined;
  const selectedLoc = selectedLocIdx !== null ? cards[selectedLocIdx] : undefined;
  const hasCore = !!selectedCore;
  const hasLoc = !!selectedLoc;
  const combined = hasCore && hasLoc;

  const handleConfirm = () => {
    if (!hasCore && !hasLoc) return;
    if (combined && !window.confirm(
      "You have selected a CORE proposition and a LOC proposition.\n\n" +
      "The CORE proposition will be the strategic platform. The LOC proposition " +
      "will be the creative expression. Both will travel downstream together.\n\n" +
      "Confirm combined selection?",
    )) {
      return;
    }
    onSelect({
      core: selectedCore,
      loc: selectedLoc,
      source: combined ? "COMBINED" : hasLoc ? "LOC" : "CORE",
      engineKey: selectedLoc?.engineKey,
    });
  };

  const handleManualConfirm = () => {
    const line = manualLine.trim();
    if (!line) return;
    onSelect({
      core: {
        cardNumber: 1,
        smpLine: line,
        whatItOwns: "",
        truth: "",
        whatItChallenges: "",
        whatItMakesPossible: "",
        whatItRequires: "",
        scores: {},
        fieldName: manualField.trim() || line.slice(0, 60),
        iconicTierStatus: "",
        pressureTestNote: "",
        source: "CORE",
      },
      source: "CORE",
    });
  };

  const RawPanel = (
    <div style={{ marginTop: 24 }}>
      <button
        type="button"
        onClick={() => setShowRaw((v) => !v)}
        className="inline-flex items-center gap-2 text-body-sm"
        style={{ color: "#5A5652", background: "transparent", border: 0, cursor: "pointer", padding: 0 }}
      >
        <span
          style={{
            display: "inline-block",
            transform: showRaw ? "rotate(90deg)" : "rotate(0deg)",
            transition: "transform 150ms",
          }}
        >
          ›
        </span>
        View raw strategy output
      </button>
      {showRaw && (
        <pre
          style={{
            marginTop: 12,
            maxHeight: 400,
            overflow: "auto",
            background: "#141414",
            color: "#8A8680",
            padding: 20,
            borderRadius: 8,
            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
            fontSize: 12,
            lineHeight: 1.5,
            whiteSpace: "pre-wrap",
          }}
        >
          {stage12Output}
        </pre>
      )}
    </div>
  );

  const ManualFallback = (
    <div
      className="rounded-md p-5"
      style={{
        border: "1px solid var(--color-border)",
        backgroundColor: "var(--color-surface-2)",
      }}
    >
      <p className="text-label" style={{ color: "var(--color-text-secondary)", marginBottom: 8 }}>
        MANUAL SELECTION — FALLBACK
      </p>

      <p className="text-body-sm" style={{ color: "var(--color-text-secondary)", marginBottom: 12 }}>
        Type or paste any proposition line you want to confirm as the selected SMP. This overrides card selection.
      </p>
      <textarea
        value={manualLine}
        onChange={(e) => setManualLine(e.target.value)}
        placeholder="Paste proposition line here…"
        rows={2}
        style={{
          width: "100%",
          padding: 10,
          borderRadius: 8,
          border: "1px solid var(--color-border)",
          background: "var(--color-surface)",
          color: "var(--color-text-primary)",
          fontFamily: "inherit",
          fontSize: 14,
          lineHeight: 1.5,
        }}
      />
      <input
        type="text"
        value={manualField}
        onChange={(e) => setManualField(e.target.value)}
        placeholder="Optional: field name / short label"
        style={{
          marginTop: 8,
          width: "100%",
          padding: 10,
          borderRadius: 8,
          border: "1px solid var(--color-border)",
          background: "var(--color-surface)",
          color: "var(--color-text-primary)",
          fontSize: 14,
        }}
      />
      <button
        type="button"
        disabled={!manualLine.trim()}
        onClick={handleManualConfirm}
        className="mt-3 inline-flex h-10 items-center justify-center rounded-md px-5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
        style={{ backgroundColor: "var(--color-primary)", color: "var(--color-primary-foreground)" }}
      >
        Confirm manual selection
      </button>
    </div>
  );

  if (cards.length === 0) {
    return (
      <div style={{ paddingBottom: 80 }}>
        <header>
          <span className="text-label" style={{ color: "var(--color-warning)" }}>
            STRATEGY REVIEW — SELECTION
          </span>
          <h1 className="text-h2 mt-3 text-text-primary">Manual proposition entry</h1>
          <p className="text-body mt-3 text-text-secondary">
            Automatic parsing could not detect distinct proposition cards. You can still select a
            proposition by pasting it below, or expand the raw output to read the full strategy.
          </p>
          <hr className="my-6 h-px border-0 bg-border" />
        </header>
        {ManualFallback}
        {onResubmit && (
          <RevisionPanel
            feedback={revisionFeedback}
            onChange={setRevisionFeedback}
            onSubmit={() => {
              const fb = revisionFeedback.trim();
              if (fb.length >= 8 && !resubmitting) void onResubmit(fb);
            }}
            resubmitting={resubmitting}
          />
        )}
        {RawPanel}
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: 80 }}>
      <header>
        <span className="text-label" style={{ color: "var(--color-warning)" }}>
          STRATEGY REVIEW — SELECTION
        </span>
        <h1 className="text-h2 mt-3 text-text-primary">Select a proposition.</h1>
        <p className="text-body mt-3 text-text-secondary">
          Every proposition is presented with equal authority and in deliberately randomised order.
          Read each one before choosing. Your selection sets the direction for every remaining stage.
        </p>
        <hr className="my-6 h-px border-0 bg-border" />
      </header>

      {usingStage11Fallback && (
        <div
          className="mb-6 rounded-md p-4"
          style={{
            border: `1px solid var(${enhancing ? "--color-primary" : "--color-warning"})`,
            backgroundColor: `color-mix(in oklab, var(${enhancing ? "--color-primary" : "--color-warning"}) 10%, transparent)`,
            color: "var(--color-text-primary)",
          }}
        >
          <p
            className="text-label"
            style={{
              color: `var(${enhancing ? "--color-primary" : "--color-warning"})`,
              marginBottom: 6,
            }}
          >
            {enhancing
              ? "VALIDATED PROPOSITIONS — RICH CARDS LOADING IN BACKGROUND"
              : "FALLBACK DISPLAY — STAGE 11 VALIDATED PROPOSITIONS"}
          </p>
          <p className="text-body-sm" style={{ color: "var(--color-text-secondary)" }}>
            {enhancing
              ? "These are the validated propositions from Stage 11. You can select right now — the formatted Stage 12 cards will replace this view automatically when they finish generating."
              : "Stage 12 card formatting was not produced, so the validated propositions from Stage 11 are shown so you can still select. You can retry Stage 12 from the controls above to regenerate the full proposition cards."}
          </p>
        </div>
      )}





      {context && (
        <div
          className="mb-8 rounded-md p-5"
          style={{
            border: "1px solid var(--color-border)",
            backgroundColor: "var(--color-surface-2)",
            color: "var(--color-text-secondary)",
            whiteSpace: "pre-wrap",
            lineHeight: 1.7,
          }}
        >
          {context}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {cards.map((card, idx) => {
          const isSelected = selected === idx;
          return (
            <button
              key={card.cardNumber}
              type="button"
              onClick={() => setSelected(idx)}
              className="text-left transition-all animate-fade-in"
              style={{
                borderRadius: 12,
                border: `2px solid ${isSelected ? "var(--color-primary)" : "var(--color-border)"}`,
                backgroundColor: isSelected
                  ? "var(--color-primary-subtle)"
                  : "var(--color-surface-2)",
                padding: 24,
                cursor: "pointer",
                animationDelay: `${idx * 80}ms`,
                animationFillMode: "both",
              }}
            >
              <div className="flex items-center justify-between">
                <span className="text-label text-primary">PROPOSITION {card.cardNumber}</span>
                <span
                  className="text-label"
                  style={{
                    color: card.source && card.source !== "CORE" ? "var(--color-warning)" : "var(--color-text-tertiary)",
                    letterSpacing: "0.06em",
                  }}
                >
                  {card.source ?? "CORE"}
                </span>
              </div>
              <p className="text-h3 mt-3 text-text-primary" style={{ lineHeight: 1.35 }}>
                {card.smpLine || "(line missing)"}
              </p>

              {card.whatItOwns && <Section title={card.source && card.source !== "CORE" ? "Territory" : "What it owns"} body={card.whatItOwns} />}
              {card.truth && <Section title="The truth it is built on" body={card.truth} />}
              {card.whatItChallenges && (
                <Section title="What it challenges" body={card.whatItChallenges} />
              )}
              {card.whatItMakesPossible && (
                <Section title={card.source && card.source !== "CORE" ? "Courage assessment" : "What it makes possible"} body={card.whatItMakesPossible} />
              )}
              {card.whatItRequires && (
                <Section title="What it requires of the brand" body={card.whatItRequires} />
              )}

              <hr
                className="my-4 h-px border-0"
                style={{ backgroundColor: "var(--color-border)" }}
              />
              {card.source && card.source !== "CORE" ? (
                <>
                  <div className="grid grid-cols-5 gap-2">
                    <ScorePill label="Surprise" value={card.loc10?.genuine_surprise} />
                    <ScorePill label="Path" value={card.loc10?.credible_path} />
                    <ScorePill label="Rich" value={card.loc10?.territory_richness} />
                    <ScorePill label="Perm" value={card.loc10?.competitive_permanence} />
                    <ScorePill label="Escape" value={card.loc10?.category_escape} />
                  </div>
                  <p className="text-body-sm mt-3" style={{ color: "var(--color-text-tertiary)" }}>
                    LOC-10 provocation scores · scored on future potential, not current brand reality
                  </p>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    <ScorePill label="Fame" value={card.scores.fame} />
                    <ScorePill label="Truth" value={card.scores.truthStrength} />
                    <ScorePill label="CompImp" value={card.scores.competitiveImpossibility} />
                    <ScorePill label="Perm" value={card.scores.brandPermission} />
                    <ScorePill label="Clean" value={card.scores.cleanAir} />
                    <ScorePill label="Prec" value={card.scores.commercialPrecedent} />
                  </div>
                  {card.scores.weightedComposite !== undefined && (
                    <p
                      className="text-body-sm mt-3"
                      style={{ color: "var(--color-text-tertiary)" }}
                    >
                      Weighted {card.scores.weightedComposite}/100
                      {card.fieldName ? ` · ${card.fieldName}` : ""}
                    </p>
                  )}
                  {card.scores.flags && card.scores.flags.length > 0 && (
                    <ul className="mt-3 space-y-1" style={{ color: "var(--color-warning)", fontSize: 12, lineHeight: 1.5 }}>
                      {card.scores.flags.map((f, i) => (
                        <li key={i}>{f}</li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </button>
          );
        })}
      </div>

      <div
        className="mt-8 rounded-md p-5"
        style={{
          border: "1px solid var(--color-border)",
          backgroundColor: "var(--color-surface)",
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-body-sm" style={{ color: "var(--color-text-tertiary)" }}>
            {selected !== null
              ? `Selected: Proposition ${cards[selected].cardNumber}`
              : "Select a proposition above to continue."}
          </p>
          <button
            type="button"
            disabled={selected === null}
            onClick={handleConfirm}
            className="inline-flex h-11 items-center justify-center rounded-md px-6 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              backgroundColor: "var(--color-primary)",
              color: "var(--color-primary-foreground)",
            }}
          >
            Confirm selection → Capture rationale
          </button>
        </div>
      </div>

      <div className="mt-8">{ManualFallback}</div>

      {onResubmit && (

        <RevisionPanel
          feedback={revisionFeedback}
          onChange={setRevisionFeedback}
          onSubmit={() => {
            const fb = revisionFeedback.trim();
            if (fb.length >= 8 && !resubmitting) void onResubmit(fb);
          }}
          resubmitting={resubmitting}
        />
      )}
      {RawPanel}
    </div>
  );
}

function RevisionPanel({
  feedback,
  onChange,
  onSubmit,
  resubmitting,
}: {
  feedback: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  resubmitting: boolean;
}) {
  const canSubmit = feedback.trim().length >= 8 && !resubmitting;

  return (
    <div
      className="mt-8 rounded-md p-5"
      style={{
        border: "1px solid var(--color-border)",
        backgroundColor: "var(--color-surface-2)",
      }}
    >
      <label className="text-body-sm mb-2 block text-text-secondary" htmlFor="smp-revision-feedback">
        What needs to change?
      </label>
      <textarea
        id="smp-revision-feedback"
        value={feedback}
        onChange={(e) => onChange(e.target.value.slice(0, 5000))}
        className="input-base w-full resize-y"
        style={{ height: 120 }}
        placeholder="Be specific — these notes will be injected as mandatory constraints for the regenerated proposition set."
      />
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          disabled={!canSubmit}
          onClick={onSubmit}
          className="inline-flex h-10 items-center justify-center rounded-md px-5 text-[13px] font-semibold transition-colors disabled:cursor-not-allowed"
          style={
            canSubmit
              ? {
                  backgroundColor: "var(--color-primary)",
                  color: "var(--color-primary-foreground)",
                }
              : {
                  backgroundColor: "var(--color-border)",
                  color: "var(--color-text-tertiary)",
                }
          }
        >
          {resubmitting ? "Resubmitting…" : "Resubmit with direction"}
        </button>
      </div>
    </div>
  );
}

function Section({ title, body }: { title: string; body: string }) {
  return (
    <div style={{ marginTop: 14 }}>
      <p
        className="text-label"
        style={{ color: "var(--color-text-tertiary)", marginBottom: 4 }}
      >
        {title}
      </p>
      <p
        className="text-body-sm"
        style={{ color: "var(--color-text-primary)", lineHeight: 1.55 }}
      >
        {body}
      </p>
    </div>
  );
}

function ScorePill({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div
      className="text-mono"
      style={{
        borderRadius: 6,
        padding: "6px 8px",
        backgroundColor: "var(--color-surface-3)",
        color: "var(--color-text-secondary)",
        textAlign: "center",
        fontSize: 11,
      }}
    >
      <span style={{ color: "var(--color-text-tertiary)" }}>{label}</span>{" "}
      <strong style={{ color: "var(--color-text-primary)" }}>{value ?? "—"}</strong>
    </div>
  );
}
