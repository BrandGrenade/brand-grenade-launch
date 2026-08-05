// SMP Anchor — permanent left-panel reference for Phase 2 (Brand Detonation).
// Displays the validated SMP and a Three Truths status indicator.
// This anchor never scrolls out of view and cannot be collapsed.

type SMPAnchorProps = {
  smp: string;
  truths: [boolean, boolean, boolean];
};

const AMBER = "#C81E1E";

const labelStyle: React.CSSProperties = {
  color: AMBER,
  fontFamily: '"DM Mono", ui-monospace, monospace',
  fontSize: 7,
  lineHeight: 1,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  fontWeight: 500,
};

const smpTextStyle: React.CSSProperties = {
  color: "#EDE8E0",
  fontFamily: '"DM Sans", system-ui, sans-serif',
  fontSize: 9,
  lineHeight: 1.5,
  marginTop: 8,
  whiteSpace: "pre-wrap",
};

export function SMPAnchor({ smp, truths }: SMPAnchorProps) {
  return (
    <div
      style={{
        padding: "16px 20px",
        backgroundColor: "var(--color-background)",
        borderBottom: "1px solid var(--color-border)",
      }}
    >
      <div style={labelStyle}>SMP</div>
      <p style={smpTextStyle}>{smp || "—"}</p>

      <div
        style={{
          height: 1,
          width: "100%",
          backgroundColor: AMBER,
          opacity: 0.2,
          margin: "12px 0",
        }}
      />

      <div style={labelStyle}>Three Truths</div>
      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
        {truths.map((confirmed, i) => (
          <span
            key={i}
            aria-label={confirmed ? "Truth confirmed" : "Truth unconfirmed"}
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              backgroundColor: confirmed ? AMBER : "transparent",
              border: `1px solid ${AMBER}`,
              display: "inline-block",
            }}
          />
        ))}
      </div>
    </div>
  );
}
