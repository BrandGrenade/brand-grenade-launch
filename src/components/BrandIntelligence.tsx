import { useState } from "react";

interface Props {
  onSubmit: () => void;
}

const FIELDS: {
  key: string;
  label: string;
  helper: string;
  height: number;
}[] = [
  {
    key: "positioning",
    label: "Current Brand Positioning",
    helper:
      "How the brand currently positions itself in the market. Include current tagline or campaign territory if applicable.",
    height: 100,
  },
  {
    key: "product",
    label: "Product Truth",
    helper:
      "What the product genuinely does — not what the marketing claims. What it delivers that competitors do not.",
    height: 100,
  },
  {
    key: "audience",
    label: "Audience Relationship",
    helper:
      "How the audience currently perceives and interacts with the brand. Include any significant trust, credibility, or perception issues.",
    height: 80,
  },
  {
    key: "tone",
    label: "Tone of Voice",
    helper:
      "The brand's established vocal register. Formal or informal, warm or cool, bold or restrained, serious or playful.",
    height: 80,
  },
  {
    key: "constraints",
    label: "Brand Constraints",
    helper:
      "Any commitments, communications, or positions the brand has taken publicly that may create tension with the selected proposition.",
    height: 80,
  },
  {
    key: "org",
    label: "Organisational Context (optional)",
    helper:
      "Internal factors — leadership appetite for change, budget reality, organisational readiness — that affect what the brand can realistically commit to.",
    height: 80,
  },
];

export function BrandIntelligence({ onSubmit }: Props) {
  const [values, setValues] = useState<Record<string, string>>({});

  const filled = FIELDS.filter((f) => (values[f.key] ?? "").trim().length > 0)
    .length;
  const completeness = Math.round((filled / FIELDS.length) * 100);

  return (
    <div>
      <header>
        <span className="text-label text-primary">
          STAGE 13 — BRAND INTELLIGENCE REQUIRED
        </span>
        <h1 className="text-h2 mt-3 text-text-primary">
          Supply brand intelligence.
        </h1>
        <p className="text-body mt-3 text-text-secondary">
          Brand Fit Validation cannot be automated. The following information
          must come from you — not from the pipeline. The quality of this input
          determines the accuracy of the brand fit assessment.
        </p>

        <div
          style={{
            backgroundColor: "oklch(0.5 0.09 70 / 0.07)",
            border: "1px solid var(--color-warning)",
            borderRadius: 8,
            padding: "12px 16px",
            marginTop: 16,
          }}
        >
          <p
            className="text-body-sm"
            style={{ color: "var(--color-warning)" }}
          >
            This stage pauses the pipeline. Provide all available information
            before proceeding. Partial information produces partial assessment.
          </p>
        </div>

        <hr className="my-6 h-px border-0 bg-border" />
      </header>

      <div
        style={{
          backgroundColor: "var(--color-surface-3)",
          border: "1px solid var(--color-border)",
          borderRadius: 12,
          padding: 40,
        }}
      >
        {FIELDS.map((f, i) => (
          <div key={f.key} style={{ marginTop: i === 0 ? 0 : 24 }}>
            <label
              className="text-body-sm"
              style={{
                display: "block",
                fontWeight: 500,
                color: "var(--color-text-secondary)",
                marginBottom: 8,
              }}
            >
              {f.label}
            </label>
            <textarea
              value={values[f.key] ?? ""}
              onChange={(e) =>
                setValues((v) => ({ ...v, [f.key]: e.target.value }))
              }
              style={{
                width: "100%",
                height: f.height,
                resize: "vertical",
                backgroundColor: "var(--color-surface-2)",
                border: "1px solid var(--color-border)",
                borderRadius: 8,
                color: "var(--color-text-primary)",
                padding: "12px 14px",
                fontFamily: "inherit",
                fontSize: 14,
                lineHeight: 1.6,
                outline: "none",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "var(--color-primary)";
                e.currentTarget.style.boxShadow =
                  "0 0 0 3px oklch(0.65 0.12 60 / 0.20)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "var(--color-border)";
                e.currentTarget.style.boxShadow = "none";
              }}
            />
            <p
              className="text-body-sm"
              style={{ color: "var(--color-text-tertiary)", marginTop: 6 }}
            >
              {f.helper}
            </p>
          </div>
        ))}

        {/* Completeness */}
        <div style={{ marginTop: 32 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              marginBottom: 8,
            }}
          >
            <span className="text-label text-primary">
              INTELLIGENCE COMPLETENESS
            </span>
            <span
              className="text-body-sm"
              style={{ color: "var(--color-text-secondary)" }}
            >
              {completeness}%
            </span>
          </div>
          <div
            style={{
              height: 6,
              width: "100%",
              borderRadius: 3,
              backgroundColor: "var(--color-border)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${completeness}%`,
                backgroundColor: "var(--color-primary)",
                transition: "width 200ms",
              }}
            />
          </div>
          {completeness < 80 && (
            <p
              className="text-body-sm"
              style={{ color: "var(--color-warning)", marginTop: 8 }}
            >
              Partial intelligence produces partial assessment. Consider
              completing all fields.
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={onSubmit}
          style={{
            width: "100%",
            height: 52,
            marginTop: 32,
            borderRadius: 8,
            border: "none",
            fontWeight: 600,
            fontSize: 14,
            cursor: "pointer",
            backgroundColor: "var(--color-primary)",
            color: "var(--color-background)",
          }}
        >
          Submit Brand Intelligence — Continue Pipeline →
        </button>
      </div>
    </div>
  );
}
