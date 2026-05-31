import * as React from "react";

// Phase 2 reusable output card. Mirrors Phase 1 card styling
// (dark background, DM Mono uppercase title, DM Sans body, line-height 1.6)
// but uses the Phase 2 amber accent #D4924A. Renders a checkbox top-left;
// when unchecked, a Redirect text input slides into view beneath the
// content so the user can steer regeneration of just this card.
export interface DetonationOutputCardProps {
  cardId: string;
  title: string;
  content: string;
  isChecked: boolean;
  onCheckChange: (cardId: string, checked: boolean) => void;
  redirectText: string;
  onRedirectChange: (cardId: string, text: string) => void;
  smp?: string | null;
  children?: React.ReactNode;
}

const ACCENT = "#D4924A";

export function DetonationOutputCard({
  cardId,
  title,
  content,
  isChecked,
  onCheckChange,
  redirectText,
  onRedirectChange,
  smp,
  children,
}: DetonationOutputCardProps) {
  const inputId = `detonation-keep-${cardId}`;
  const showRedirect = !isChecked;

  return (
    <div
      className="transition-shadow"
      style={{
        backgroundColor: "#111111",
        border: "1px solid #2A2A2A",
        borderRadius: 8,
        padding: 24,
        marginTop: 16,
        boxShadow: "0 1px 2px rgba(0,0,0,0.4)",
      }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.boxShadow = `0 4px 14px ${ACCENT}1f`)
      }
      onMouseLeave={(e) =>
        (e.currentTarget.style.boxShadow = "0 1px 2px rgba(0,0,0,0.4)")
      }
    >
      <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
        <label
          htmlFor={inputId}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginTop: 2,
            cursor: "pointer",
          }}
        >
          <input
            id={inputId}
            type="checkbox"
            checked={isChecked}
            onChange={(e) => onCheckChange(cardId, e.target.checked)}
            style={{
              width: 18,
              height: 18,
              accentColor: ACCENT,
              cursor: "pointer",
            }}
            aria-label={`Keep "${title}" on next retry`}
          />
        </label>

        <div style={{ flex: 1, minWidth: 0 }}>
          {smp && smp.trim() ? (
            <div style={{ marginBottom: 18 }}>
              <div
                className="text-mono"
                style={{
                  color: ACCENT,
                  textTransform: "uppercase",
                  fontSize: 7,
                  letterSpacing: "0.18em",
                  margin: 0,
                }}
              >
                STRATEGIC PROPOSITION
              </div>
              <div
                className="text-body"
                style={{
                  color: ACCENT,
                  fontStyle: "italic",
                  marginTop: 6,
                  lineHeight: 1.5,
                }}
              >
                {smp.trim()}
              </div>
              <div
                style={{
                  marginTop: 12,
                  borderTop: `1px solid ${ACCENT}33`,
                }}
              />
            </div>
          ) : null}
          <h3
            className="text-mono"
            style={{
              color: ACCENT,
              textTransform: "uppercase",
              fontSize: 12,
              letterSpacing: "0.12em",
              margin: 0,
            }}
          >
            {title}
          </h3>

          <div
            className="text-body"
            style={{
              color: "#FFFFFF",
              lineHeight: 1.6,
              marginTop: 12,
              whiteSpace: "pre-wrap",
            }}
          >
            {content}
          </div>

          <div
            style={{
              overflow: "hidden",
              transition:
                "max-height 300ms ease, opacity 200ms ease, margin-top 200ms ease",
              maxHeight: showRedirect ? 120 : 0,
              opacity: showRedirect ? 1 : 0,
              marginTop: showRedirect ? 16 : 0,
            }}
          >
            <input
              type="text"
              value={redirectText}
              onChange={(e) => onRedirectChange(cardId, e.target.value)}
              placeholder="Redirect this — be specific."
              className="text-body-sm"
              style={{
                width: "100%",
                backgroundColor: "#1A1A1A",
                border: `1px solid ${ACCENT}40`,
                borderRadius: 6,
                color: "#FFFFFF",
                padding: "10px 12px",
                outline: "none",
              }}
              onFocus={(e) =>
                (e.currentTarget.style.borderColor = ACCENT)
              }
              onBlur={(e) =>
                (e.currentTarget.style.borderColor = `${ACCENT}40`)
              }
            />
          </div>

          {children ? (
            <div
              style={{
                marginTop: 16,
                display: "flex",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              {children}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default DetonationOutputCard;
