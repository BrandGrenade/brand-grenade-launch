import * as React from "react";

// Phase 2 reusable brief section. Renders one section of the Master
// Detonation Brief. Click anywhere on the section to reveal a feedback
// field; when feedback is entered, a "Regenerate This Section" button
// appears. Pressing it calls onRegenerate(sectionId, feedback) and on
// completion swaps the section content via onContentUpdate.
export interface DetonationBriefSectionProps {
  sectionId: string;
  label: string;
  content: React.ReactNode;
  onRegenerate: (sectionId: string, feedback: string) => Promise<string>;
  onContentUpdate: (sectionId: string, newContent: string) => void;
}

const ACCENT = "#C81E1E";

export function DetonationBriefSection({
  sectionId,
  label,
  content,
  onRegenerate,
  onContentUpdate,
}: DetonationBriefSectionProps) {
  const [open, setOpen] = React.useState(false);
  const [feedback, setFeedback] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const handleRegenerate = async () => {
    const trimmed = feedback.trim();
    if (!trimmed || loading) return;
    setLoading(true);
    try {
      const next = await onRegenerate(sectionId, trimmed);
      onContentUpdate(sectionId, next);
      setFeedback("");
      setOpen(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        padding: "20px 0",
        borderBottom: `1px solid ${ACCENT}33`, // ~15% opacity
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "block",
          width: "100%",
          textAlign: "left",
          background: "transparent",
          border: "none",
          padding: 0,
          cursor: "pointer",
        }}
        aria-expanded={open}
      >
        <div
          style={{
            color: ACCENT,
            textTransform: "uppercase",
            fontSize: "7pt",
            letterSpacing: "0.18em",
            fontFamily: "'DM Mono', monospace",
            fontWeight: 500,
          }}
        >
          {label}
        </div>
        <div
          className="text-body"
          style={{
            color: "#EDE8E0",
            lineHeight: 1.6,
            marginTop: 10,
            whiteSpace: "pre-wrap",
          }}
        >
          {content}
        </div>
      </button>

      <div
        style={{
          overflow: "hidden",
          transition:
            "max-height 300ms ease, opacity 200ms ease, margin-top 200ms ease",
          maxHeight: open ? 220 : 0,
          opacity: open ? 1 : 0,
          marginTop: open ? 14 : 0,
        }}
      >
        <div
          style={{
            backgroundColor: "#1C1A18",
            border: `1px solid ${ACCENT}33`,
            borderRadius: 6,
            padding: 12,
          }}
        >
          <input
            type="text"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="What needs to change — be specific."
            className="text-body-sm"
            style={{
              width: "100%",
              backgroundColor: "#0A0908",
              border: `1px solid ${ACCENT}40`,
              borderRadius: 6,
              color: "#EDE8E0",
              padding: "10px 12px",
              outline: "none",
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = ACCENT)}
            onBlur={(e) =>
              (e.currentTarget.style.borderColor = `${ACCENT}40`)
            }
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void handleRegenerate();
              }
            }}
          />

          {feedback.trim().length > 0 ? (
            <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={handleRegenerate}
                disabled={loading}
                className="text-mono"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  backgroundColor: "transparent",
                  color: ACCENT,
                  border: `1px solid ${ACCENT}`,
                  borderRadius: 6,
                  padding: "8px 14px",
                  textTransform: "uppercase",
                  fontSize: 11,
                  letterSpacing: "0.12em",
                  cursor: loading ? "not-allowed" : "pointer",
                  opacity: loading ? 0.7 : 1,
                }}
              >
                {loading ? (
                  <span
                    aria-hidden="true"
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: "50%",
                      border: `2px solid ${ACCENT}`,
                      borderTopColor: "transparent",
                      display: "inline-block",
                      animation: "spin 0.8s linear infinite",
                    }}
                  />
                ) : null}
                {loading ? "Regenerating…" : "Regenerate This Section"}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default DetonationBriefSection;
