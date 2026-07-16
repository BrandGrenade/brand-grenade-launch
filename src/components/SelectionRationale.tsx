import { useState, useMemo } from "react";

interface SelectionRationaleProps {
  selectedSMP?: string;
  selectionSource?: "CORE" | "LOC" | "COMBINED";
  onConfirm: (values: Record<string, string>) => void;
  submitting?: boolean;
}


const BASE_FIELDS: {
  key: string;
  label: string;
  helper: string;
  height: number;
  required?: boolean;
}[] = [
  {
    key: "f1",
    label: "Why this proposition over the alternatives?",
    helper:
      "Reference the specific alternatives. The rationale must explain the choice, not just describe the selection.",
    height: 100,
    required: true,
  },
  {
    key: "f2",
    label: "What strategic priority drove this selection?",
    helper:
      "Longevity, creative ambition, commercial courage, or credibility — which mattered most and why.",
    height: 80,
    required: true,
  },
  {
    key: "f3",
    label: "What does this selection set in motion?",
    helper:
      "What strategic consequence follows from choosing this proposition for this brand at this moment.",
    height: 80,
    required: true,
  },
  {
    key: "f4",
    label: "What was sacrificed by not selecting the alternatives?",
    helper:
      "For each alternative not selected, note the specific strategic territory or opportunity this selection forecloses.",
    height: 80,
    required: true,
  },
  {
    key: "f5",
    label: "What must the brand commit to in order to own this?",
    helper:
      "Specific actions, communications, or product truths the brand must demonstrate — not just assert.",
    height: 80,
  },
  {
    key: "f6",
    label:
      "Is there anything about this selection that requires human strategic review?",
    helper:
      "Flag any brand fit conditions, credibility gaps, or competitive risks identified during the selection conversation.",
    height: 80,
  },
];

const LOC_LEGACY_FIELD = {
  key: "f_loc_legacy",
  label:
    "Does this LOC proposition sit alongside or extend the brand's existing legacy — or does it represent a deliberate break with it?",
  helper:
    "Name the legacy relationship explicitly. A deliberate break requires a stronger commitment story downstream.",
  height: 100,
  required: true,
};

export function SelectionRationale({
  selectedSMP = "",
  selectionSource = "CORE",
  onConfirm,
  submitting = false,
}: SelectionRationaleProps) {
  const [values, setValues] = useState<Record<string, string>>({});

  const FIELDS = useMemo(
    () =>
      selectionSource === "LOC" || selectionSource === "COMBINED"
        ? [...BASE_FIELDS, LOC_LEGACY_FIELD]
        : BASE_FIELDS,
    [selectionSource],
  );

  const canSubmit = FIELDS.filter((f) => f.required).every(
    (f) => (values[f.key] ?? "").trim().length > 0
  );


  return (
    <div>
      <header>
        <span className="text-label" style={{ color: "var(--color-warning)" }}>
          STRATEGY REVIEW — SELECTION
        </span>
        <h1 className="text-h2 mt-3 text-text-primary">
          Document your selection rationale.
        </h1>
        <p className="text-body mt-3 text-text-secondary">
          The rationale for this selection carries through every remaining
          stage and appears in the final deliverable. It must explain why this
          proposition over the specific alternatives — not just why it is good.
        </p>
        <hr className="my-6 h-px border-0 bg-border" />
      </header>

      {/* Selected proposition reminder — scrolls with the page (no overlay). */}
      <div
        style={{
          backgroundColor: "var(--color-surface-2)",
          border: "1px solid var(--color-primary)",
          borderRadius: 12,
          padding: 24,
          marginBottom: 32,
        }}
      >
        <span className="text-label text-primary">SELECTED PROPOSITION</span>
        <p
          className="text-h3 text-text-primary"
          style={{ marginTop: 8 }}
        >
          {selectedSMP}
        </p>
      </div>

      {/* Form card */}
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
              {f.required && (
                <span style={{ color: "var(--color-primary)", marginLeft: 4 }}>
                  *
                </span>
              )}
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
              style={{
                color: "var(--color-text-tertiary)",
                marginTop: 6,
              }}
            >
              {f.helper}
            </p>
          </div>
        ))}

        <button
          type="button"
          disabled={!canSubmit || submitting}
          onClick={() => canSubmit && !submitting && onConfirm(values)}
          style={{
            width: "100%",
            height: 52,
            marginTop: 32,
            borderRadius: 8,
            border: "none",
            fontWeight: 600,
            fontSize: 14,
            cursor: canSubmit && !submitting ? "pointer" : "not-allowed",
            backgroundColor: canSubmit
              ? "var(--color-primary)"
              : "var(--color-border)",
            color: canSubmit
              ? "var(--color-background)"
              : "var(--color-text-tertiary)",
            transition: "background-color 150ms",
          }}
        >
          {submitting ? "Saving…" : "Confirm selection — Continue →"}
        </button>


        <p
          className="text-body-sm"
          style={{
            color: "var(--color-text-tertiary)",
            textAlign: "center",
            marginTop: 12,
          }}
        >
          Brand Fit Validation begins after confirmation.
        </p>
      </div>
    </div>
  );
}
