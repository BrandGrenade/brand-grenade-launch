import { useState } from "react";
import {
  CheckCircle2,
  RefreshCw,
  Flag,
  AlertTriangle,
} from "lucide-react";

export type CheckpointLetter = "A" | "B" | "C";

const COPY: Record<
  CheckpointLetter,
  { label: string; heading: string; subtext: string; questions: string[] }
> = {
  A: {
    label: "Strategy Review — Brief",
    heading: "Is this the right strategic problem?",
    subtext:
      "Review the analysed brief below. Confirm the strategic reframe is correct before category intelligence begins.",
    questions: [
      "Is the strategic reframe genuinely surprising — or merely well-structured? Does it reveal the hidden problem rather than restate the brief in cleaner language?",
      "Is the strategic tension specific to this brand and category — or could this reframe apply to any challenger in any category?",
      "Is the analysed brief strong enough to power genuinely original insight generation — or will it produce category-average insights?",
    ],
  },
  B: {
    label: "Strategy Review — Propositions",
    heading: "Do these propositions represent genuinely different worldviews?",
    subtext:
      "Review all generated propositions. Confirm the set represents genuinely competing worldviews before scoring and integrity testing begins.",
    questions: [
      "Does this set represent genuinely competing worldviews — or do some feel like variations on the same theme?",
      "Which proposition is most unexpected — the one that challenges your assumption about what this brand should say?",
      "Is there at least one proposition here that would make you slightly uncomfortable presenting it to a client — and if so, which one and why?",
    ],
  },
  C: {
    label: "Strategy Review — Selection",
    heading: "Which proposition do we select?",
    subtext:
      "This is the selection moment. Your selection and rationale carry through every remaining stage.",
    questions: [
      "Which proposition do you believe will still feel true and distinctive in five years?",
      "Which proposition gives your creative team the most room to surprise you?",
      "Which proposition can this brand credibly own today — given its product reality and audience relationship?",
    ],
  },
};

type Action = "confirm" | "revise" | "escalate" | null;

export function Checkpoint({
  letter,
  reviewContent,
  showLowScoreAlert = false,
  onConfirm,
  onResubmit,
  onEscalate,
  resubmitting = false,
}: {
  letter: CheckpointLetter;
  reviewContent: React.ReactNode;
  showLowScoreAlert?: boolean;
  onConfirm?: (notes: string[]) => void;
  onResubmit?: (feedback: string) => void | Promise<void>;
  onEscalate?: (reason: string) => void | Promise<void>;
  resubmitting?: boolean;
}) {
  const copy = COPY[letter];
  const [action, setAction] = useState<Action>(null);
  const [notes, setNotes] = useState<string[]>(["", "", ""]);
  const [feedback, setFeedback] = useState("");
  const [escalation, setEscalation] = useState("");

  return (
    <div>
      {/* Identity */}
      <header>
        <span
          className="text-label"
          style={{ color: "var(--color-warning)" }}
        >
          {copy.label}
        </span>
        <h1 className="text-h2 mt-3 text-text-primary">{copy.heading}</h1>
        <p className="text-body mt-3 text-text-secondary">{copy.subtext}</p>
        <hr className="my-6 h-px border-0 bg-border" />
      </header>

      {/* Review card */}
      <div
        className="overflow-y-auto p-6 sm:p-8"
        style={{
          backgroundColor: "var(--color-surface-2)",
          border: "1px solid var(--color-border)",
          borderRadius: 12,
          maxHeight: 400,
        }}
      >
        {reviewContent}
      </div>

      {/* Diagnostic questions */}
      <section className="mt-8">
        <span className="text-label text-primary">Review Questions</span>
        <ol className="mt-5 flex flex-col gap-7">
          {copy.questions.map((q, i) => (
            <li key={i} className="flex gap-4">
              <span className="text-h3 shrink-0 text-primary" style={{ minWidth: 24 }}>
                {i + 1}
              </span>
              <div className="flex-1">
                <p className="text-body-lg text-text-primary">{q}</p>
                <label
                  className="text-body-sm mt-3 mb-2 block"
                  style={{ color: "var(--color-text-tertiary)" }}
                  htmlFor={`note-${letter}-${i}`}
                >
                  Notes (optional)
                </label>
                <textarea
                  id={`note-${letter}-${i}`}
                  value={notes[i]}
                  onChange={(e) => {
                    const next = [...notes];
                    next[i] = e.target.value.slice(0, 1000);
                    setNotes(next);
                  }}
                  placeholder="Your notes..."
                  className="input-base w-full resize-none"
                  style={{ height: 80 }}
                />
              </div>
            </li>
          ))}
        </ol>
      </section>

      <hr className="my-8 h-px border-0 bg-border" />

      {/* Actions */}
      <section>
        <span className="text-label text-primary">Your Decision</span>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <ActionCard
            selected={action === "confirm"}
            onClick={() => setAction(action === "confirm" ? null : "confirm")}
            icon={<CheckCircle2 size={20} />}
            tint="success"
            title="Confirm and Proceed"
            description="The output is strong. Continue to the next stage."
          />
          <ActionCard
            selected={action === "revise"}
            onClick={() => setAction(action === "revise" ? null : "revise")}
            icon={<RefreshCw size={20} />}
            tint="primary"
            title="Return for Revision"
            description="The output needs work. Send back with feedback."
          />
          <ActionCard
            selected={action === "escalate"}
            onClick={() => setAction(action === "escalate" ? null : "escalate")}
            icon={<Flag size={20} />}
            tint="destructive"
            title="Escalate to Human Review"
            description="Significant issue identified. Flag for senior review before proceeding."
          />
        </div>

        {/* Confirm CTA */}
        {action === "confirm" && (
          <div className="mt-5 animate-fade-in">
            <button
              type="button"
              data-checkpoint-confirm="true"
              onClick={() => onConfirm?.(notes)}
              className="inline-flex h-11 items-center justify-center rounded-md px-6 text-[14px] font-semibold transition-colors"
              style={{
                backgroundColor: "var(--color-success)",
                color: "var(--color-background)",
              }}
            >
              Proceed to next stage →
            </button>

          </div>
        )}

        {/* Revise form */}
        {action === "revise" && (
          <div
            className="mt-5 animate-fade-in rounded-lg p-5"
            style={{
              backgroundColor: "var(--color-surface-2)",
              border: "1px solid var(--color-border)",
            }}
          >
            <label
              htmlFor="revise-feedback"
              className="text-body-sm mb-2 block text-text-secondary"
            >
              What needs to change?
            </label>
            <textarea
              id="revise-feedback"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value.slice(0, 2000))}
              className="input-base w-full resize-y"
              style={{ height: 100 }}
              placeholder="Be specific — call out the lines, sections, or logic that misses."
            />
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                disabled={feedback.trim().length < 8 || resubmitting}
                onClick={() => {
                  if (feedback.trim().length < 8 || resubmitting) return;
                  if (onResubmit) {
                    void onResubmit(feedback.trim());
                  } else {
                    console.log("[Checkpoint Resubmit] clicked — handler not yet implemented", feedback.trim());
                  }
                }}
                className="inline-flex h-10 items-center justify-center rounded-md px-5 text-[13px] font-semibold transition-colors disabled:cursor-not-allowed"
                style={
                  feedback.trim().length >= 8 && !resubmitting
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
                {resubmitting ? "Resubmitting…" : "Resubmit"}
              </button>
            </div>
          </div>
        )}

        {/* Escalate form */}
        {action === "escalate" && (
          <div
            className="mt-5 animate-fade-in rounded-lg p-5"
            style={{
              backgroundColor: "var(--color-surface-2)",
              border: "1px solid var(--color-border)",
            }}
          >
            <label
              htmlFor="escalate-issue"
              className="text-body-sm mb-2 block text-text-secondary"
            >
              Describe the issue
            </label>
            <textarea
              id="escalate-issue"
              value={escalation}
              onChange={(e) => setEscalation(e.target.value.slice(0, 2000))}
              className="input-base w-full resize-y"
              style={{ height: 100 }}
              placeholder="What needs senior attention before this run continues?"
            />
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                disabled={escalation.trim().length < 8}
                onClick={() => {
                  if (escalation.trim().length < 8) return;
                  if (onEscalate) {
                    void onEscalate(escalation.trim());
                  } else {
                    console.log("[Checkpoint Escalate] clicked — handler not yet implemented", escalation.trim());
                  }
                  setAction(null);
                  setEscalation("");
                }}
                className="inline-flex h-10 items-center justify-center rounded-md px-5 text-[13px] font-semibold transition-colors disabled:cursor-not-allowed"
                style={
                  escalation.trim().length >= 8
                    ? {
                        backgroundColor: "var(--color-destructive)",
                        color: "var(--color-destructive-foreground)",
                      }
                    : {
                        backgroundColor: "var(--color-border)",
                        color: "var(--color-text-tertiary)",
                      }
                }
              >
                Flag for review
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Checkpoint A low-score alert */}
      {letter === "A" && showLowScoreAlert && (
        <div
          className="mt-4 flex items-start gap-3 rounded-md p-4"
          style={{
            backgroundColor: "oklch(0.5 0.09 70 / 0.08)",
            border: "1px solid var(--color-warning)",
          }}
        >
          <AlertTriangle
            size={16}
            style={{ color: "var(--color-warning)", marginTop: 2, flexShrink: 0 }}
          />
          <p
            className="text-body-sm"
            style={{ color: "var(--color-warning)" }}
          >
            Brief Enhancement has been triggered. Strategic tension score is
            below threshold. Additional brief information will be requested
            before continuing.
          </p>
        </div>
      )}
    </div>
  );
}

type Tint = "success" | "primary" | "destructive";

function ActionCard({
  selected,
  onClick,
  icon,
  tint,
  title,
  description,
}: {
  selected: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  tint: Tint;
  title: string;
  description: string;
}) {
  const tintMap: Record<Tint, { color: string; bg: string }> = {
    success: {
      color: "var(--color-success)",
      bg: "oklch(0.55 0.08 150 / 0.08)",
    },
    primary: {
      color: "var(--color-primary)",
      bg: "var(--color-primary-subtle)",
    },
    destructive: {
      color: "var(--color-destructive)",
      bg: "oklch(0.45 0.12 25 / 0.08)",
    },
  };
  const t = tintMap[tint];

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className="group rounded-lg p-5 text-left transition-colors"
      style={{
        backgroundColor: selected ? t.bg : "transparent",
        border: `1px solid ${selected ? t.color : "var(--color-border)"}`,
      }}
      onMouseEnter={(e) => {
        if (!selected) {
          e.currentTarget.style.backgroundColor = t.bg;
          e.currentTarget.style.borderColor = t.color;
        }
      }}
      onMouseLeave={(e) => {
        if (!selected) {
          e.currentTarget.style.backgroundColor = "transparent";
          e.currentTarget.style.borderColor = "var(--color-border)";
        }
      }}
    >
      <span style={{ color: t.color, display: "inline-flex" }}>{icon}</span>
      <h3 className="text-body mt-3 font-semibold text-text-primary">{title}</h3>
      <p className="text-body-sm mt-1 text-text-secondary">{description}</p>
    </button>
  );
}
