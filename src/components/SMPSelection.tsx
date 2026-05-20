import { useMemo, useState } from "react";

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

// Parse Stage 12 output into an ordered list of SMP cards.
export function parseSMPCards(stage12Output: string): SMPCard[] {
  if (!stage12Output) return [];

  // Split on "PROPOSITION N" markers. The full marker line is
  // "PROPOSITION 1", "PROPOSITION 2", etc.
  const cardRegex = /PROPOSITION\s+(\d+)\s*\n([\s\S]*?)(?=PROPOSITION\s+\d+\s*\n|====\s*DELIVERABLE\s+2|====\s*PRESENTATION\s+ORDER\s+LOG|$)/gi;
  const cards: SMPCard[] = [];
  let match: RegExpExecArray | null;
  while ((match = cardRegex.exec(stage12Output)) !== null) {
    const cardNumber = Number(match[1]);
    const body = match[2];
    cards.push(parseCard(cardNumber, body));
  }
  return cards;
}

const SECTIONS: Array<{ key: keyof Omit<SMPCard, "cardNumber" | "scores" | "fieldName" | "iconicTierStatus" | "pressureTestNote" | "smpLine">; heading: RegExp }> = [
  { key: "whatItOwns", heading: /WHAT\s+THIS\s+PROPOSITION\s+OWNS/i },
  { key: "truth", heading: /THE\s+TRUTH\s+IT\s+IS\s+BUILT\s+ON/i },
  { key: "whatItChallenges", heading: /WHAT\s+IT\s+CHALLENGES/i },
  { key: "whatItMakesPossible", heading: /WHAT\s+IT\s+MAKES\s+POSSIBLE/i },
  { key: "whatItRequires", heading: /WHAT\s+IT\s+REQUIRES\s+OF\s+THE\s+BRAND/i },
];

function parseCard(cardNumber: number, body: string): SMPCard {
  // The SMP line lives between the "═══" header close and the first "WHAT THIS PROPOSITION OWNS"
  const ownsIdx = body.search(/WHAT\s+THIS\s+PROPOSITION\s+OWNS/i);
  const headerEnd = body.indexOf("═══════════════════════════════════════════════════");
  const preamble = body.substring(headerEnd > -1 ? headerEnd + 51 : 0, ownsIdx > -1 ? ownsIdx : body.length);
  // Strip horizontal rule lines and surrounding whitespace
  const smpLine = preamble
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !/^[═─]+$/.test(l))
    .join(" ")
    .trim()
    .replace(/^["']|["']$/g, "");

  const result: SMPCard = {
    cardNumber,
    smpLine,
    whatItOwns: "",
    truth: "",
    whatItChallenges: "",
    whatItMakesPossible: "",
    whatItRequires: "",
    scores: {},
    fieldName: "",
    iconicTierStatus: "",
    pressureTestNote: "",
  };

  for (let i = 0; i < SECTIONS.length; i++) {
    const s = SECTIONS[i];
    const startMatch = s.heading.exec(body);
    if (!startMatch) continue;
    const startIdx = startMatch.index + startMatch[0].length;
    // End at next section heading or at "STRATEGIC QUALITY SCORES" or "[METADATA]"
    let endIdx = body.length;
    for (let j = i + 1; j < SECTIONS.length; j++) {
      const next = SECTIONS[j].heading.exec(body);
      if (next && next.index > startIdx) {
        endIdx = Math.min(endIdx, next.index);
      }
    }
    const stopRegexes = [/STRATEGIC\s+QUALITY\s+SCORES/i, /\[METADATA\]/i, /═══/];
    for (const sr of stopRegexes) {
      const m = sr.exec(body.slice(startIdx));
      if (m) endIdx = Math.min(endIdx, startIdx + m.index);
    }
    const text = body
      .slice(startIdx, endIdx)
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !/^[─]+$/.test(l))
      .join(" ")
      .trim();
    result[s.key] = text;
  }

  // Scores
  const sg = (re: RegExp) => {
    const m = re.exec(body);
    return m ? Number(m[1]) : undefined;
  };
  result.scores.differentiation = sg(/Differentiation:\s*(\d+)\s*\/\s*10/i);
  result.scores.truthStrength = sg(/Truth\s+Strength:\s*(\d+)\s*\/\s*10/i);
  result.scores.culturalRelevance = sg(/Cultural\s+Relevance:\s*(\d+)\s*\/\s*10/i);
  result.scores.commercialPlausibility = sg(/Commercial\s+Plausibility:\s*(\d+)\s*\/\s*10/i);
  result.scores.creativeExpandability = sg(/Creative\s+Expandability:\s*(\d+)\s*\/\s*10/i);
  result.scores.writerQuality = sg(/Writer\s+Quality:\s*(\d+)\s*\/\s*10/i);
  result.scores.composite = sg(/Composite:\s*(\d+)\s*\/\s*60/i);

  // Metadata block
  const meta = /\[METADATA\]([\s\S]*?)\[\/METADATA\]/i.exec(body);
  if (meta) {
    const m = meta[1];
    const fn = /FIELD_NAME:\s*(.+)/i.exec(m);
    const it = /ICONIC_TIER_STATUS:\s*(.+)/i.exec(m);
    const pn = /PRESSURE_TEST_NOTE:\s*(.+)/i.exec(m);
    result.fieldName = fn ? fn[1].trim() : "";
    result.iconicTierStatus = it ? it[1].trim() : "";
    result.pressureTestNote = pn ? pn[1].trim() : "";
  }

  return result;
}

export function SMPSelection({
  stage12Output,
  onSelect,
}: {
  stage12Output: string;
  onSelect: (card: SMPCard) => void;
}) {
  const cards = useMemo(() => parseSMPCards(stage12Output), [stage12Output]);
  const [selected, setSelected] = useState<number | null>(null);

  // Extract Section 1 (Presentation Context) — everything between DELIVERABLE 1 and "PROPOSITION 1"
  const context = useMemo(() => {
    const d1 = stage12Output.search(/====\s*DELIVERABLE\s+1[^=]*====/i);
    const p1 = stage12Output.search(/PROPOSITION\s+1\s*\n/i);
    if (d1 < 0 || p1 < 0) return "";
    return stage12Output.slice(d1, p1)
      .replace(/====\s*DELIVERABLE\s+1[^=]*====/i, "")
      .replace(/═+/g, "")
      .replace(/SECTION\s+1[^\n]*\n/i, "")
      .replace(/SECTION\s+2[^\n]*\n/i, "")
      .trim();
  }, [stage12Output]);

  const handleSelect = (idx: number) => setSelected(idx);
  const handleConfirm = () => {
    if (selected === null) return;
    onSelect(cards[selected]);
  };

  if (cards.length === 0) {
    return (
      <div style={{ paddingBottom: 80 }}>
        <header>
          <span className="text-label" style={{ color: "var(--color-warning)" }}>
            CHECKPOINT C — SMP SELECTION
          </span>
          <h1 className="text-h2 mt-3 text-text-primary">No propositions detected</h1>
          <p className="text-body mt-3 text-text-secondary">
            Stage 12 did not produce parseable proposition cards. Inspect the raw output below.
          </p>
          <hr className="my-6 h-px border-0 bg-border" />
        </header>
        <pre
          className="text-body-sm overflow-auto rounded-md p-4"
          style={{
            border: "1px solid var(--color-border)",
            backgroundColor: "var(--color-surface-2)",
            color: "var(--color-text-secondary)",
            whiteSpace: "pre-wrap",
          }}
        >
          {stage12Output}
        </pre>
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: 80 }}>
      <header>
        <span className="text-label" style={{ color: "var(--color-warning)" }}>
          CHECKPOINT C — SMP SELECTION
        </span>
        <h1 className="text-h2 mt-3 text-text-primary">Select a proposition.</h1>
        <p className="text-body mt-3 text-text-secondary">
          Every proposition is presented with equal authority and in deliberately randomised order.
          Read each one before choosing. Your selection sets the direction for every remaining
          pipeline stage.
        </p>
        <hr className="my-6 h-px border-0 bg-border" />
      </header>

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
              onClick={() => handleSelect(idx)}
              className="text-left transition-all"
              style={{
                borderRadius: 12,
                border: `2px solid ${isSelected ? "var(--color-primary)" : "var(--color-border)"}`,
                backgroundColor: isSelected ? "var(--color-primary-subtle)" : "var(--color-surface-2)",
                padding: 24,
                cursor: "pointer",
              }}
            >
              <div className="flex items-center justify-between">
                <span className="text-label text-primary">PROPOSITION {card.cardNumber}</span>
                {card.iconicTierStatus === "CONFIRMED" && (
                  <span
                    className="text-label rounded-sm px-2 py-0.5"
                    style={{
                      backgroundColor: "oklch(0.5 0.09 70 / 0.10)",
                      color: "var(--color-warning)",
                    }}
                  >
                    Iconic
                  </span>
                )}
              </div>
              <p
                className="text-h3 mt-3 text-text-primary"
                style={{ lineHeight: 1.35 }}
              >
                {card.smpLine || "(line missing)"}
              </p>

              {card.whatItOwns && (
                <Section title="What it owns" body={card.whatItOwns} />
              )}
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
        className="sticky bottom-0 mt-8 rounded-md p-5"
        style={{
          border: "1px solid var(--color-border)",
          backgroundColor: "var(--color-surface)",
        }}
      >
        <div className="flex items-center justify-between gap-4">
          <p
            className="text-body-sm"
            style={{ color: "var(--color-text-tertiary)" }}
          >
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
