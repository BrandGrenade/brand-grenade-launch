import { useMemo, useState } from "react";
import { parseStage11Verdicts, parseStage10Scores } from "@/lib/stage12-filter";


export interface SMPCard {
  cardNumber: number;
  smpLine: string;
  whatItOwns: string;
  truth: string;
  whatItChallenges: string;
  whatItMakesPossible: string;
  whatItRequires: string;
  scores: {
    differentiation?: number;
    truthStrength?: number;
    culturalRelevance?: number;
    commercialPlausibility?: number;
    creativeExpandability?: number;
    writerQuality?: number;
    composite?: number;
  };
  fieldName: string;
  iconicTierStatus: string;
  pressureTestNote: string;
}

// ----------------------------- PARSER -----------------------------

function extractScore(text: string, label: string): number | undefined {
  // Allow markdown bold/italic markers and stray punctuation between the
  // label and the number, e.g. "**Differentiation:**  9/10" or "Differentiation — 9/10".
  const pattern = new RegExp(
    label.replace(/\s+/g, "\\s+") + "[\\s*_:\\-—–]+(\\d+(?:\\.\\d+)?)\\s*\\/\\s*(?:10|60)",
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
  scores: SMPCard["scores"];
}

function parsePropositions(rawOutput: string): RawProp[] {
  const propositions: RawProp[] = [];
  if (!rawOutput) return propositions;

  // Only parse content within DELIVERABLE 1 — everything after (selection
  // framework, rationale stub, presentation order log, self-audit) contains
  // bold text that can be mis-detected as additional propositions.
  let scope = rawOutput;
  const endMarker = scope.search(
    /={2,}\s*DELIVERABLE\s+2|={2,}\s*DELIVERABLE\s+3|={2,}\s*PRESENTATION\s+ORDER|={2,}\s*SELF[-\s]AUDIT/i,
  );
  if (endMarker > 0) scope = scope.slice(0, endMarker);

  // Method 1: Split on === or ═══ dividers
  const dividerPattern = /[═=]{3,}/g;
  const blocks = scope.split(dividerPattern).filter((b) => b.trim().length > 50);

  // Method 2: Split on PROPOSITION N headers
  const propPattern = /\*{0,2}PROPOSITION\s+\d+\*{0,2}/gi;
  const propBlocks = scope.split(propPattern).filter((b) => b.trim().length > 50);

  const contentBlocks = propBlocks.length > blocks.length ? propBlocks : blocks;


  for (const block of contentBlocks) {
    if (
      !block.includes("**") &&
      !block.includes("Composite") &&
      !block.includes("Differentiation")
    ) {
      continue;
    }
    if (
      block.includes("[METADATA]") ||
      block.includes("SELF-AUDIT") ||
      block.includes("PRESENTATION ORDER") ||
      block.includes("SELECTION FRAMEWORK") ||
      block.includes("DELIVERABLE 2") ||
      block.includes("DELIVERABLE 3")
    ) {
      continue;
    }

    let propositionLine = "";
    const blockquoteBold = block.match(/>\s*\*\*([^*\n]+)\*\*/);
    if (blockquoteBold) propositionLine = blockquoteBold[1].trim();
    if (!propositionLine) {
      const boldMatches = block.match(/\*\*([^*\n]{10,80})\*\*/g);
      if (boldMatches && boldMatches.length > 0) {
        propositionLine = boldMatches[0].replace(/\*\*/g, "").trim();
      }
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

    const ownsMatch = block.match(
      /WHAT THIS PROPOSITION OWNS[\s\S]*?\n\n([\s\S]*?)(?:\n---|\n═|$)/i,
    );
    const owns = ownsMatch ? ownsMatch[1].trim().substring(0, 300) : "";

    const truthMatch = block.match(
      /THE TRUTH IT IS BUILT ON[\s\S]*?\n\n([\s\S]*?)(?:\n---|\n═|$)/i,
    );
    const truth = truthMatch ? truthMatch[1].trim().substring(0, 300) : "";

    const challengeMatch = block.match(
      /WHAT IT CHALLENGES[\s\S]*?\n\n([\s\S]*?)(?:\n---|\n═|$)/i,
    );
    const challenge = challengeMatch ? challengeMatch[1].trim().substring(0, 300) : "";

    const scores: SMPCard["scores"] = {
      differentiation: extractScore(block, "Differentiation"),
      truthStrength: extractScore(block, "Truth Strength"),
      culturalRelevance: extractScore(block, "Cultural Relevance"),
      commercialPlausibility: extractScore(block, "Commercial Plausibility"),
      creativeExpandability: extractScore(block, "Creative Expandability"),
      writerQuality: extractScore(block, "Writer Quality"),
      composite: extractScore(block, "Composite"),
    };

    propositions.push({ line: propositionLine, owns, truth, challenge, scores });
  }

  return propositions;
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
      smpLine: p.line,
      whatItOwns: p.owns,
      truth: p.truth,
      whatItChallenges: p.challenge,
      whatItMakesPossible: "",
      whatItRequires: "",
      scores: p.scores,
      fieldName: "",
      iconicTierStatus: "",
      pressureTestNote: "",
    }));
  }

  // Fallback: render the VALIDATED propositions from Stage 11 directly so the
  // human always sees the propositions, even when Stage 12 parsing fails or
  // Stage 12 output has not yet been produced.
  if (!stage11Fallback) return [];
  const verdicts = parseStage11Verdicts(stage11Fallback).filter(
    (v) => v.verdict === "VALIDATED" || v.verdict === "VALIDATED WITH STRATEGIC NOTE",
  );
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
            differentiation: s.differentiation,
            truthStrength: s.truthStrength,
            culturalRelevance: s.culturalRelevance,
            commercialPlausibility: s.commercialPlausibility,
            creativeExpandability: s.creativeExpandability,
            writerQuality: s.writerQuality,
            composite: s.composite,
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

// ----------------------------- COMPONENT -----------------------------

export function SMPSelection({
  stage12Output,
  stage11Output,
  stage10Output,
  onSelect,
  onResubmit,
  resubmitting = false,
  enhancing = false,
}: {
  stage12Output: string;
  stage11Output?: string;
  stage10Output?: string;
  onSelect: (card: SMPCard) => void;
  onResubmit?: (feedback: string) => void | Promise<void>;
  resubmitting?: boolean;
  /** True while Stage 12 Claude card formatting is still streaming in the background. */
  enhancing?: boolean;
}) {
  const cards = useMemo(
    () => parseSMPCards(stage12Output ?? "", stage11Output, stage10Output),
    [stage12Output, stage11Output, stage10Output],
  );
  const usingStage11Fallback = useMemo(
    () => (stage12Output ? parsePropositions(stage12Output).length === 0 : true) && cards.length > 0,
    [stage12Output, cards.length],
  );


  const [selected, setSelected] = useState<number | null>(null);
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

  const handleConfirm = () => {
    if (selected === null) return;
    onSelect(cards[selected]);
  };

  const handleManualConfirm = () => {
    const line = manualLine.trim();
    if (!line) return;
    onSelect({
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
        border: "1px solid var(--color-primary)",
        backgroundColor: "var(--color-surface-2)",
        position: "sticky",
        top: 12,
        zIndex: 20,
      }}
    >
      <p className="text-label" style={{ color: "var(--color-primary)", marginBottom: 8 }}>
        MANUAL SELECTION — ALWAYS AVAILABLE
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
            border: "1px solid var(--color-warning)",
            backgroundColor: "color-mix(in oklab, var(--color-warning) 10%, transparent)",
            color: "var(--color-text-primary)",
          }}
        >
          <p className="text-label" style={{ color: "var(--color-warning)", marginBottom: 6 }}>
            FALLBACK DISPLAY — STAGE 11 VALIDATED PROPOSITIONS
          </p>
          <p className="text-body-sm" style={{ color: "var(--color-text-secondary)" }}>
            Stage 12 card formatting could not be parsed, so the validated propositions from Stage 11
            are shown below so you can still select. You can retry Stage 12 from the controls above to
            regenerate the full proposition cards.
          </p>
        </div>
      )}

      <div className="mb-6">{ManualFallback}</div>


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
              </div>
              <p className="text-h3 mt-3 text-text-primary" style={{ lineHeight: 1.35 }}>
                {card.smpLine || "(line missing)"}
              </p>

              {card.whatItOwns && <Section title="What it owns" body={card.whatItOwns} />}
              {card.truth && <Section title="The truth it is built on" body={card.truth} />}
              {card.whatItChallenges && (
                <Section title="What it challenges" body={card.whatItChallenges} />
              )}
              {card.whatItMakesPossible && (
                <Section title="What it makes possible" body={card.whatItMakesPossible} />
              )}
              {card.whatItRequires && (
                <Section title="What it requires of the brand" body={card.whatItRequires} />
              )}

              <hr
                className="my-4 h-px border-0"
                style={{ backgroundColor: "var(--color-border)" }}
              />
              <div className="grid grid-cols-3 gap-2">
                <ScorePill label="Diff" value={card.scores.differentiation} />
                <ScorePill label="Truth" value={card.scores.truthStrength} />
                <ScorePill label="Cult" value={card.scores.culturalRelevance} />
                <ScorePill label="Comm" value={card.scores.commercialPlausibility} />
                <ScorePill label="Creat" value={card.scores.creativeExpandability} />
                <ScorePill label="Writer" value={card.scores.writerQuality} />
              </div>
              {card.scores.composite !== undefined && (
                <p
                  className="text-body-sm mt-3"
                  style={{ color: "var(--color-text-tertiary)" }}
                >
                  Composite {card.scores.composite}/60
                  {card.fieldName ? ` · ${card.fieldName}` : ""}
                </p>
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
