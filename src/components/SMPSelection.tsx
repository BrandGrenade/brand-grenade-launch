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

// ----------------------------- PARSER -----------------------------

// Detect proposition blocks using four methods, then merge by block range.
export function parseSMPCards(stage12Output: string): SMPCard[] {
  if (!stage12Output) return [];
  const text = stage12Output;

  // Collect candidate start indices from each detection method.
  const starts = new Set<number>();

  // METHOD 3 — "PROPOSITION N" label
  for (const m of text.matchAll(/^[ \t>*_#-]*\**\s*PROPOSITION\s+(\d+)\b/gim)) {
    if (m.index !== undefined) starts.add(m.index);
  }

  // METHOD 4 — "Composite:" anchors — walk back to nearest separator/bold
  for (const m of text.matchAll(/Composite\s*:\s*\d+/gi)) {
    if (m.index === undefined) continue;
    const back = text.slice(0, m.index);
    // walk back to nearest separator or double newline
    const sepIdx = Math.max(
      back.lastIndexOf("\n═══"),
      back.lastIndexOf("\n==="),
      back.lastIndexOf("\n---"),
      back.lastIndexOf("\n\n"),
    );
    starts.add(sepIdx > 0 ? sepIdx + 1 : 0);
  }

  // METHOD 1 — blockquote lines containing **bold**
  for (const m of text.matchAll(/^>\s+.*\*\*[^*\n]+\*\*.*$/gim)) {
    if (m.index !== undefined) starts.add(m.index);
  }

  // METHOD 2 — separator-delimited blocks containing **bold** near top
  const sepSplits = [...text.matchAll(/\n(?:={3,}|—{3,}|═{3,}|-{3,})\s*\n/g)];
  for (let i = 0; i < sepSplits.length; i++) {
    const idx = (sepSplits[i].index ?? 0) + sepSplits[i][0].length;
    const next = sepSplits[i + 1]?.index ?? text.length;
    const chunk = text.slice(idx, next);
    if (/\*\*[^*\n]{3,}\*\*/.test(chunk.slice(0, 400))) starts.add(idx);
  }

  if (starts.size === 0) return [];

  const sorted = [...starts].sort((a, b) => a - b);
  // Merge near-duplicate starts (within 50 chars)
  const merged: number[] = [];
  for (const s of sorted) {
    if (merged.length === 0 || s - merged[merged.length - 1] > 80) merged.push(s);
  }

  // Stop boundary — DELIVERABLE 2, SECTION 3, STRATEGIC LANDSCAPE
  const stopMatch =
    text.search(/={2,}\s*DELIVERABLE\s+2/i) >= 0
      ? text.search(/={2,}\s*DELIVERABLE\s+2/i)
      : text.search(/SECTION\s+3\s*—\s*STRATEGIC\s+LANDSCAPE/i) >= 0
        ? text.search(/SECTION\s+3\s*—\s*STRATEGIC\s+LANDSCAPE/i)
        : text.length;

  const cards: SMPCard[] = [];
  for (let i = 0; i < merged.length; i++) {
    const startIdx = merged[i];
    if (startIdx >= stopMatch) break;
    const endIdx = Math.min(merged[i + 1] ?? text.length, stopMatch);
    const body = text.slice(startIdx, endIdx);
    cards.push(parseCard(i + 1, body, text));
  }
  return cards;
}

function extractSection(body: string, headings: RegExp[]): string {
  for (const h of headings) {
    const m = h.exec(body);
    if (!m) continue;
    const start = m.index + m[0].length;
    const rest = body.slice(start);
    const stopRe = /(?:\n[A-Z][A-Z \-]{6,}\n|═══|---|\n\n[A-Z][A-Z ]{4,}|\[METADATA\]|STRATEGIC\s+QUALITY\s+SCORES|Composite\s*:)/i;
    const stop = stopRe.exec(rest);
    const end = stop ? stop.index : Math.min(600, rest.length);
    return rest
      .slice(0, end)
      .split("\n")
      .map((l) => l.replace(/^[>*\s-]+/, "").trim())
      .filter((l) => l && !/^[─=*]+$/.test(l))
      .join(" ")
      .trim();
  }
  return "";
}

function parseCard(cardNumber: number, body: string, _full: string): SMPCard {
  // Proposition line — prefer first blockquote with bold; else largest bold; else first non-trivial line
  let smpLine = "";
  const bq = /^>\s+(.*\*\*[^*\n]+\*\*.*)$/m.exec(body);
  if (bq) {
    smpLine = bq[1].replace(/\*\*/g, "").trim();
  } else {
    const bolds = [...body.matchAll(/\*\*([^*\n]{6,300})\*\*/g)].map((m) => m[1].trim());
    if (bolds.length) {
      bolds.sort((a, b) => b.length - a.length);
      smpLine = bolds[0];
    }
  }
  if (!smpLine) {
    // fallback — text after PROPOSITION N header line, first non-empty meaningful line
    const lines = body.split("\n").map((l) => l.trim()).filter(Boolean);
    for (const l of lines) {
      if (/^PROPOSITION\s+\d+/i.test(l)) continue;
      if (/^[═─=*\-]+$/.test(l)) continue;
      if (l.length < 8) continue;
      smpLine = l.replace(/^[>*\s]+/, "").replace(/\*\*/g, "").trim();
      break;
    }
  }
  smpLine = smpLine.replace(/^["']|["']$/g, "").trim();

  const whatItOwns = extractSection(body, [
    /WHAT\s+THIS\s+PROPOSITION\s+OWNS/i,
    /What\s+it\s+owns/i,
    /What\s+this\s+owns/i,
  ]);
  const truth = extractSection(body, [
    /THE\s+TRUTH\s+IT\s+IS\s+BUILT\s+ON/i,
    /Truth(?:\s+it\s+is\s+built\s+on)?\s*[:\-—]/i,
    /^\s*Truth\s*$/im,
  ]);
  const whatItChallenges = extractSection(body, [
    /WHAT\s+IT\s+CHALLENGES/i,
    /Challenge[s]?\s*[:\-—]?/i,
  ]);
  const whatItMakesPossible = extractSection(body, [/WHAT\s+IT\s+MAKES\s+POSSIBLE/i]);
  const whatItRequires = extractSection(body, [/WHAT\s+IT\s+REQUIRES\s+OF\s+THE\s+BRAND/i]);

  const sg = (re: RegExp): number | undefined => {
    const m = re.exec(body);
    return m ? Number(m[1]) : undefined;
  };
  const scores = {
    differentiation: sg(/Differentiation\s*:\s*(\d+)/i),
    truthStrength: sg(/Truth\s+Strength\s*:\s*(\d+)/i),
    culturalRelevance: sg(/Cultural\s+Relevance\s*:\s*(\d+)/i),
    commercialPlausibility: sg(/Commercial\s+Plausibility\s*:\s*(\d+)/i),
    creativeExpandability: sg(/Creative\s+Expandability\s*:\s*(\d+)/i),
    writerQuality: sg(/Writer\s+Quality\s*:\s*(\d+)/i),
    composite: sg(/Composite\s*:\s*(\d+)/i),
  };

  // Metadata block
  let fieldName = "";
  let iconicTierStatus = "";
  let pressureTestNote = "";
  const meta = /\[METADATA\]([\s\S]*?)\[\/METADATA\]/i.exec(body);
  if (meta) {
    const m = meta[1];
    fieldName = /FIELD_NAME\s*:\s*(.+)/i.exec(m)?.[1].trim() ?? "";
    iconicTierStatus = /ICONIC_TIER_STATUS\s*:\s*(.+)/i.exec(m)?.[1].trim() ?? "";
    pressureTestNote = /PRESSURE_TEST_NOTE\s*:\s*(.+)/i.exec(m)?.[1].trim() ?? "";
  }

  return {
    cardNumber,
    smpLine,
    whatItOwns,
    truth,
    whatItChallenges,
    whatItMakesPossible,
    whatItRequires,
    scores,
    fieldName,
    iconicTierStatus,
    pressureTestNote,
  };
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
  onSelect,
}: {
  stage12Output: string;
  onSelect: (card: SMPCard) => void;
}) {
  const cards = useMemo(() => parseSMPCards(stage12Output), [stage12Output]);
  const [selected, setSelected] = useState<number | null>(null);
  const [showRaw, setShowRaw] = useState(false);
  const [manualLine, setManualLine] = useState("");
  const [manualField, setManualField] = useState("");

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
      className="mt-8 rounded-md p-5"
      style={{
        border: "1px solid var(--color-border)",
        backgroundColor: "var(--color-surface-2)",
      }}
    >
      <p className="text-label" style={{ color: "var(--color-text-tertiary)", marginBottom: 8 }}>
        MANUAL SELECTION
      </p>
      <p className="text-body-sm" style={{ color: "var(--color-text-secondary)", marginBottom: 12 }}>
        Type or paste the proposition line you want to select, then confirm.
      </p>
      <textarea
        value={manualLine}
        onChange={(e) => setManualLine(e.target.value)}
        placeholder="Paste proposition line here…"
        rows={3}
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
        style={{ backgroundColor: "#C8873A", color: "#0A0A0A" }}
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
        className="sticky bottom-0 mt-8 rounded-md p-5"
        style={{
          border: "1px solid var(--color-border)",
          backgroundColor: "var(--color-surface)",
        }}
      >
        <div className="flex items-center justify-between gap-4">
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

      {ManualFallback}
      {RawPanel}
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
