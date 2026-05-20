import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { TopNav } from "@/components/TopNav";
import { Checkpoint } from "@/components/Checkpoint";
import { SelectionRationale } from "@/components/SelectionRationale";
import { BrandIntelligence } from "@/components/BrandIntelligence";

export const Route = createFileRoute("/pipeline")({
  component: PipelineView,
  head: () => ({
    meta: [
      { title: "Pipeline — Brand Grenade" },
      {
        name: "description",
        content:
          "20-stage strategy pipeline view. Track stages, review outputs, and act on human checkpoints.",
      },
    ],
  }),
});

// ────────────────────────────────────────────────────────────────────────────
// Stage model
// ────────────────────────────────────────────────────────────────────────────

type StageStatus = "pending" | "running" | "complete" | "checkpoint" | "error";

interface Stage {
  id: string;
  number: string;
  name: string;
  conditional?: boolean;
  checkpoint?: boolean;
}

const STAGES: Stage[] = [
  { id: "01", number: "01", name: "Brief Sanitisation", checkpoint: true },
  { id: "01B", number: "01B", name: "Brief Escalation", conditional: true },
  { id: "02", number: "02", name: "Category Intelligence" },
  { id: "03", number: "03", name: "Constraint Generator" },
  { id: "04", number: "04", name: "Strategic Fan-Out" },
  { id: "05", number: "05", name: "Insight Generation" },
  { id: "06", number: "06", name: "Insight Filter" },
  { id: "07", number: "07", name: "Field Synthesis" },
  { id: "08", number: "08", name: "SMP Generation", checkpoint: true },
  { id: "09", number: "09", name: "Divergence Validation" },
  { id: "10", number: "10", name: "SMP Scoring" },
  { id: "11", number: "11", name: "Pressure Test" },
  { id: "12", number: "12", name: "SMP Selection", checkpoint: true },
  { id: "13", number: "13", name: "Brand Fit Validation" },
  { id: "13B", number: "13B", name: "Territory Reference", conditional: true },
  { id: "14", number: "14", name: "Territory Mapping" },
  { id: "14B", number: "14B", name: "Expression Mapping", conditional: true },
  { id: "14C", number: "14C", name: "Universe Definition", conditional: true },
  { id: "15", number: "15", name: "Consistency Audit" },
  { id: "16", number: "16", name: "Output Packaging" },
];

const CHECKPOINT_LETTERS: Record<string, "A" | "B" | "C"> = {
  "01": "A",
  "08": "B",
  "12": "C",
};

// Sample brief for demo state — first two stages complete, third running.
const SAMPLE_BRAND = "Hypernova";
const ELAPSED = "12:34";

// Per-stage demo output. Replace with real generator output.
const STAGE_OUTPUTS: Record<string, string> = {
  "01": `## Sanitised Brief

The brief has been parsed and structured. Four required elements were detected and locked.

### Brand context
Hypernova is a Series-B fintech building a cross-border payments rail for emerging-market freelancers. Founded 2022, ~140 staff, profitable.

### Category context
Cross-border payments — a category dominated by Wise, Remitly, and Revolut. Margins compressed; trust and speed are commoditised.

> The brief originally conflated "audience" with "ICP". We've separated end-user (freelancer) from buyer (platform partner).

### Objective
Reposition Hypernova so partners (marketplaces, payroll SaaS) integrate it as a default — not a fallback.

### Audience reference
Operations leads at remote-first marketplaces, 50–500 employees, currently paying out via batch ACH or PayPal Mass Payments.

- Tone: confident, technically literate
- Constraints: no fee-led messaging, no comparison tables
- Out of scope: end-user acquisition`,

  "02": `## Category Intelligence

Three structural truths about cross-border payments that constrain any proposition.

### Truth 1 — Trust collapses to integrations
Buyers don't trust brand promises; they trust the SDK that lives in their codebase for 18 months.

### Truth 2 — Speed is a commodity floor, not a ceiling
"Money in minutes" is table stakes. Every competitor claims it. No proposition can lead with speed.

### Truth 3 — The real spend is reconciliation, not transfer
Finance teams spend 4x more on reconciling cross-border payouts than on the fees themselves.

> Most category players sell *transfer*. The opportunity is selling *resolved books*.

### Competitor positioning map
- Wise — consumer trust, B2B as afterthought
- Remitly — corridor specialist, weak partner story
- Revolut — bundling play, partner-hostile
- Airwallex — finance-stack ambition, complex onboarding`,

  "03": `## Constraint Generator

Generating the constraint frame the proposition must satisfy. Loading category, brief, and audience priors…

A proposition for Hypernova must:

- Refuse to compete on fees or speed
- Land with operations leads, not founders
- Imply a finance-stack benefit, not a payments benefit`,
};

// ────────────────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────────────────

function PipelineView() {
  // Demo state — Stage 01 is the first human checkpoint (A).
  const initialStatuses = useMemo<Record<string, StageStatus>>(() => {
    const map: Record<string, StageStatus> = {};
    STAGES.forEach((s) => {
      map[s.id] = "pending";
    });
    map["01"] = "checkpoint";
    return map;
  }, []);

  const [statuses, setStatuses] = useState(initialStatuses);
  const [selectedId, setSelectedId] = useState("01");
  const [rationaleForId, setRationaleForId] = useState<string | null>(null);
  const [intelSubmitted, setIntelSubmitted] = useState(false);
  const selected = STAGES.find((s) => s.id === selectedId)!;
  const selectedStatus = statuses[selectedId];

  // Progress — count main (non-conditional) stages.
  const mainStages = STAGES.filter((s) => !s.conditional);
  const completedMain = mainStages.filter(
    (s) => statuses[s.id] === "complete"
  ).length;
  const runningMain = mainStages.find((s) => statuses[s.id] === "running");
  const currentMainNumber = runningMain
    ? mainStages.findIndex((s) => s.id === runningMain.id) + 1
    : completedMain;
  const progressPct = (completedMain / mainStages.length) * 100;

  return (
    <div className="flex h-screen flex-col bg-background">
      <TopNav />
      <Breadcrumb brand={SAMPLE_BRAND} elapsed={ELAPSED} status="In Progress" />

      <div className="flex flex-1 overflow-hidden">
        <LeftPanel
          stages={STAGES}
          statuses={statuses}
          selectedId={selectedId}
          onSelect={(id) => {
            const st = statuses[id];
            if (st === "complete" || st === "running" || st === "checkpoint") {
              setSelectedId(id);
            }
          }}
          progressPct={progressPct}
          currentMainNumber={Math.max(1, currentMainNumber)}
          totalMain={mainStages.length}
        />
        <RightPanel
          stage={selected}
          status={selectedStatus}
          showRationale={rationaleForId === selectedId}
          showBrandIntel={selectedId === "13" && !intelSubmitted && selectedStatus === "running"}
          onSubmitBrandIntel={() => {
            setIntelSubmitted(true);
            setStatuses((prev) => {
              const next: Record<string, StageStatus> = { ...prev, "13": "complete" };
              const idx = STAGES.findIndex((s) => s.id === "13");
              for (let i = idx + 1; i < STAGES.length; i++) {
                if (!STAGES[i].conditional) {
                  next[STAGES[i].id] = "running";
                  break;
                }
              }
              return next;
            });
          }}
          onNext={() => {
            const idx = STAGES.findIndex((s) => s.id === selectedId);
            for (let i = idx + 1; i < STAGES.length; i++) {
              const st = statuses[STAGES[i].id];
              if (st === "complete" || st === "running") {
                setSelectedId(STAGES[i].id);
                break;
              }
            }
          }}
          onConfirmCheckpoint={(stageId) => {
            // Checkpoint C (Stage 12): show rationale capture before advancing.
            if (stageId === "12" && rationaleForId !== "12") {
              setRationaleForId("12");
              return;
            }
            setRationaleForId(null);
            setStatuses((prev) => {
              const next = { ...prev, [stageId]: "complete" as StageStatus };
              const idx = STAGES.findIndex((s) => s.id === stageId);
              for (let i = idx + 1; i < STAGES.length; i++) {
                if (!STAGES[i].conditional) {
                  next[STAGES[i].id] = "running";
                  break;
                }
              }
              return next;
            });
          }}
        />
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Breadcrumb bar
// ────────────────────────────────────────────────────────────────────────────

function Breadcrumb({
  brand,
  elapsed,
  status,
}: {
  brand: string;
  elapsed: string;
  status: string;
}) {
  return (
    <div
      className="flex items-center justify-between border-b border-border bg-background px-5 py-3 sm:px-8"
    >
      <nav className="text-body-sm flex items-center gap-1.5 truncate" style={{ color: "var(--color-text-tertiary)" }}>
        <Link to="/dashboard" className="transition-colors hover:text-text-secondary">
          Sessions
        </Link>
        <span>→</span>
        <span className="text-text-secondary truncate">{brand}</span>
        <span>→</span>
        <span>Pipeline</span>
      </nav>

      <div className="ml-4 flex shrink-0 items-center gap-3">
        <span
          className="text-label inline-flex items-center rounded-sm px-2 py-0.5"
          style={{
            backgroundColor: "var(--color-primary-subtle)",
            color: "var(--color-primary)",
          }}
        >
          {status}
        </span>
        <span className="text-mono" style={{ color: "var(--color-text-tertiary)" }}>
          {elapsed}
        </span>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Left panel — pipeline tracker
// ────────────────────────────────────────────────────────────────────────────

function LeftPanel({
  stages,
  statuses,
  selectedId,
  onSelect,
  progressPct,
  currentMainNumber,
  totalMain,
}: {
  stages: Stage[];
  statuses: Record<string, StageStatus>;
  selectedId: string;
  onSelect: (id: string) => void;
  progressPct: number;
  currentMainNumber: number;
  totalMain: number;
}) {
  return (
    <aside
      className="hidden w-[280px] shrink-0 overflow-y-auto border-r border-border bg-background py-6 md:block"
    >
      <header className="px-5 pb-5">
        <span className="text-label text-primary">Pipeline Stages</span>
        <div
          className="mt-3 h-1 w-full overflow-hidden rounded-sm"
          style={{ backgroundColor: "var(--color-border)" }}
        >
          <div
            className="h-full rounded-sm transition-all duration-500"
            style={{
              width: `${progressPct}%`,
              backgroundColor: "var(--color-primary)",
            }}
          />
        </div>
        <p
          className="text-body-sm mt-2"
          style={{ color: "var(--color-text-tertiary)" }}
        >
          Stage {currentMainNumber} of {totalMain}
        </p>
      </header>

      <ul>
        {stages.map((s) => {
          const status = statuses[s.id];
          const selected = s.id === selectedId;
          const interactive =
            status === "complete" ||
            status === "running" ||
            status === "checkpoint";
          return (
            <li
              key={s.id}
              style={{ borderTop: "1px solid var(--color-surface-3)" }}
            >
              <button
                type="button"
                disabled={!interactive}
                onClick={() => onSelect(s.id)}
                className="flex w-full items-center gap-3 px-5 py-2.5 text-left transition-colors"
                style={{
                  backgroundColor: selected
                    ? "var(--color-primary-subtle)"
                    : "transparent",
                  cursor: interactive ? "pointer" : "default",
                }}
                onMouseEnter={(e) => {
                  if (interactive && !selected)
                    e.currentTarget.style.backgroundColor =
                      "var(--color-surface-2)";
                }}
                onMouseLeave={(e) => {
                  if (!selected)
                    e.currentTarget.style.backgroundColor = "transparent";
                }}
              >
                <StageIndicator
                  status={s.conditional && status === "pending" ? "pending" : status}
                  conditional={s.conditional}
                  checkpoint={s.checkpoint}
                />
                <span
                  className="text-mono shrink-0"
                  style={{
                    color: "var(--color-text-tertiary)",
                    minWidth: 28,
                    fontSize: 12,
                  }}
                >
                  {s.number}
                </span>
                <span
                  className="text-body flex-1 truncate"
                  style={stageNameStyle(status, selected, s.conditional)}
                >
                  {s.name}
                </span>
                {s.checkpoint && (
                  <span
                    className="text-label shrink-0 rounded-sm px-1.5 py-0.5"
                    style={{
                      backgroundColor: "oklch(0.5 0.09 70 / 0.10)",
                      color: "var(--color-warning)",
                      fontSize: 9,
                    }}
                  >
                    Review
                  </span>
                )}
                {s.conditional && (
                  <span
                    className="text-label shrink-0"
                    style={{
                      color: "var(--color-text-tertiary)",
                      fontSize: 9,
                    }}
                  >
                    Cond.
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}

function stageNameStyle(
  status: StageStatus,
  selected: boolean,
  conditional?: boolean
): React.CSSProperties {
  if (conditional) return { color: "var(--color-text-tertiary)" };
  if (selected) return { color: "var(--color-text-primary)", fontWeight: 600 };
  switch (status) {
    case "running":
      return { color: "var(--color-text-primary)", fontWeight: 500 };
    case "complete":
      return { color: "var(--color-text-secondary)" };
    case "checkpoint":
      return { color: "var(--color-text-primary)", fontWeight: 500 };
    case "error":
      return { color: "var(--color-destructive)" };
    default:
      return { color: "var(--color-text-tertiary)" };
  }
}

function StageIndicator({
  status,
  checkpoint,
}: {
  status: StageStatus;
  conditional?: boolean;
  checkpoint?: boolean;
}) {
  const base: React.CSSProperties = {
    width: 24,
    height: 24,
    borderRadius: "50%",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  };

  if (status === "complete") {
    return (
      <span style={{ ...base, backgroundColor: "var(--color-primary)" }}>
        <CheckIcon color="var(--color-background)" />
      </span>
    );
  }
  if (status === "running") {
    return (
      <span
        className="animate-pulse"
        style={{
          ...base,
          border: "1px solid var(--color-primary)",
          backgroundColor: "var(--color-primary-subtle)",
        }}
      />
    );
  }
  if (status === "checkpoint" || checkpoint && status !== "pending") {
    return (
      <span
        style={{
          ...base,
          border: "1px solid var(--color-warning)",
          backgroundColor: "oklch(0.5 0.09 70 / 0.10)",
        }}
      >
        <PauseIcon color="var(--color-warning)" />
      </span>
    );
  }
  if (status === "error") {
    return (
      <span style={{ ...base, backgroundColor: "var(--color-destructive)" }}>
        <XIcon color="var(--color-destructive-foreground)" />
      </span>
    );
  }
  // pending
  return (
    <span
      style={{
        ...base,
        border: "1px solid var(--color-border)",
        backgroundColor: "transparent",
      }}
    />
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Right panel — output display
// ────────────────────────────────────────────────────────────────────────────

function RightPanel({
  stage,
  status,
  showRationale,
  showBrandIntel,
  onSubmitBrandIntel,
  onNext,
  onConfirmCheckpoint,
}: {
  stage: Stage;
  status: StageStatus;
  showRationale: boolean;
  showBrandIntel: boolean;
  onSubmitBrandIntel: () => void;
  onNext: () => void;
  onConfirmCheckpoint: (stageId: string) => void;
}) {
  const fullOutput = STAGE_OUTPUTS[stage.id] ?? "Output pending.";
  const isRunning = status === "running";
  const isCheckpoint = status === "checkpoint";
  const text = useStreamingText(fullOutput, isRunning);
  const letter = CHECKPOINT_LETTERS[stage.id];

  return (
    <section className="relative flex min-w-0 flex-1 flex-col bg-background">
      <div className="flex-1 overflow-y-auto px-6 py-10 sm:px-12 sm:py-10">
        {showRationale ? (
          <div style={{ paddingBottom: 80 }}>
            <SelectionRationale
              onConfirm={() => onConfirmCheckpoint(stage.id)}
            />
          </div>
        ) : showBrandIntel ? (
          <div style={{ paddingBottom: 80 }}>
            <BrandIntelligence onSubmit={onSubmitBrandIntel} />
          </div>
        ) : isCheckpoint && letter ? (
          <div style={{ paddingBottom: 80 }}>
            <Checkpoint
              letter={letter}
              showLowScoreAlert={letter === "A"}
              onConfirm={() => onConfirmCheckpoint(stage.id)}
              reviewContent={
                <StreamedOutput text={fullOutput} streaming={false} />
              }
            />
          </div>
        ) : (
          <>
            <header>
              <span className="text-label text-primary">
                Stage {stage.number} — {stage.name}
              </span>
              <h1 className="text-h2 mt-3 text-text-primary">{stage.name}</h1>
              <StatusLine status={status} />
              <hr className="my-6 h-px border-0 bg-border" />
            </header>

            <article style={{ paddingBottom: 80 }}>
              <StreamedOutput text={text} streaming={isRunning} />
            </article>
          </>
        )}
      </div>

      <BottomBar stage={stage} status={status} onNext={onNext} />
    </section>
  );
}

function StatusLine({ status }: { status: StageStatus }) {
  if (status === "running") {
    return (
      <p className="text-body-sm mt-3 flex items-center gap-2 text-text-secondary">
        <span
          className="inline-block rounded-full bg-primary"
          style={{
            width: 6,
            height: 6,
            animation: "bg-pulse 1.2s ease-in-out infinite",
          }}
        />
        Running — generating output…
        <style>{`
          @keyframes bg-pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.3; }
          }
        `}</style>
      </p>
    );
  }
  if (status === "complete") {
    return (
      <p className="text-body-sm mt-3 flex items-center gap-2 text-text-secondary">
        <span
          className="inline-flex h-4 w-4 items-center justify-center rounded-full"
          style={{ backgroundColor: "var(--color-success)" }}
        >
          <CheckIcon color="var(--color-background)" />
        </span>
        Complete
      </p>
    );
  }
  if (status === "checkpoint") {
    return (
      <p className="text-body-sm mt-3 flex items-center gap-2 text-text-secondary">
        <span
          className="inline-flex h-4 w-4 items-center justify-center rounded-full"
          style={{
            border: "1px solid var(--color-warning)",
            backgroundColor: "oklch(0.5 0.09 70 / 0.10)",
          }}
        />
        Awaiting review
      </p>
    );
  }
  if (status === "error") {
    return (
      <p
        className="text-body-sm mt-3"
        style={{ color: "var(--color-destructive)" }}
      >
        Stage held — see errors below
      </p>
    );
  }
  return (
    <p
      className="text-body-sm mt-3"
      style={{ color: "var(--color-text-tertiary)" }}
    >
      Pending — not yet started
    </p>
  );
}

// Simple typewriter — reveals N chars/tick while streaming, full text otherwise.
function useStreamingText(full: string, streaming: boolean) {
  const [shown, setShown] = useState(streaming ? "" : full);
  const fullRef = useRef(full);
  fullRef.current = full;

  useEffect(() => {
    if (!streaming) {
      setShown(full);
      return;
    }
    setShown("");
    let i = 0;
    const id = window.setInterval(() => {
      i += 6;
      setShown(fullRef.current.slice(0, i));
      if (i >= fullRef.current.length) window.clearInterval(id);
    }, 24);
    return () => window.clearInterval(id);
  }, [full, streaming]);

  return shown;
}

// Render a minimal subset of markdown-like blocks per the spec.
function StreamedOutput({
  text,
  streaming,
}: {
  text: string;
  streaming: boolean;
}) {
  const blocks = parseBlocks(text);
  return (
    <div style={{ color: "var(--color-text-primary)", lineHeight: 1.7 }}>
      {blocks.map((b, i) => {
        const isLast = i === blocks.length - 1;
        const cursor = streaming && isLast ? <Caret /> : null;
        switch (b.kind) {
          case "h3":
            return (
              <h3
                key={i}
                className="text-h3 text-text-primary"
                style={{ marginTop: 32, marginBottom: 12 }}
              >
                {b.text}
                {cursor}
              </h3>
            );
          case "subhead":
            return (
              <p
                key={i}
                className="text-body"
                style={{
                  fontWeight: 600,
                  color: "var(--color-primary)",
                  marginTop: 20,
                  marginBottom: 8,
                }}
              >
                {b.text}
                {cursor}
              </p>
            );
          case "callout":
            return (
              <p
                key={i}
                className="text-body"
                style={{
                  borderLeft: "2px solid var(--color-primary)",
                  paddingLeft: 16,
                  color: "var(--color-text-secondary)",
                  fontStyle: "italic",
                  margin: "12px 0",
                }}
              >
                {b.text}
                {cursor}
              </p>
            );
          case "bullets":
            return (
              <ul
                key={i}
                style={{ paddingLeft: 20, margin: "8px 0" }}
              >
                {b.items.map((item, j) => (
                  <li
                    key={j}
                    className="text-body"
                    style={{
                      position: "relative",
                      margin: "4px 0",
                      color: "var(--color-text-primary)",
                    }}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        position: "absolute",
                        left: -16,
                        top: "0.6em",
                        width: 5,
                        height: 5,
                        borderRadius: "50%",
                        backgroundColor: "var(--color-primary)",
                      }}
                    />
                    {item}
                    {j === b.items.length - 1 ? cursor : null}
                  </li>
                ))}
              </ul>
            );
          case "para":
          default:
            return (
              <p key={i} className="text-body" style={{ margin: "10px 0" }}>
                {b.text}
                {cursor}
              </p>
            );
        }
      })}
    </div>
  );
}

type Block =
  | { kind: "h3"; text: string }
  | { kind: "subhead"; text: string }
  | { kind: "para"; text: string }
  | { kind: "callout"; text: string }
  | { kind: "bullets"; items: string[] };

function parseBlocks(text: string): Block[] {
  const lines = text.split("\n");
  const blocks: Block[] = [];
  let bulletBuf: string[] = [];
  const flush = () => {
    if (bulletBuf.length) {
      blocks.push({ kind: "bullets", items: [...bulletBuf] });
      bulletBuf = [];
    }
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      flush();
      continue;
    }
    if (line.startsWith("- ")) {
      bulletBuf.push(line.slice(2));
      continue;
    }
    flush();
    if (line.startsWith("## ")) {
      blocks.push({ kind: "h3", text: line.slice(3) });
    } else if (line.startsWith("### ")) {
      blocks.push({ kind: "subhead", text: line.slice(4) });
    } else if (line.startsWith("> ")) {
      blocks.push({ kind: "callout", text: line.slice(2) });
    } else {
      blocks.push({ kind: "para", text: line });
    }
  }
  flush();
  return blocks;
}

function Caret() {
  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-block",
        width: 2,
        height: "1.05em",
        marginLeft: 2,
        verticalAlign: "text-bottom",
        backgroundColor: "var(--color-primary)",
        animation: "bg-blink 1s steps(2) infinite",
      }}
    >
      <style>{`@keyframes bg-blink { 50% { opacity: 0; } }`}</style>
    </span>
  );
}

function BottomBar({
  stage,
  status,
  onNext,
}: {
  stage: Stage;
  status: StageStatus;
  onNext: () => void;
}) {
  const label =
    status === "running"
      ? `Stage ${stage.number} running`
      : status === "complete"
      ? `Stage ${stage.number} complete`
      : status === "checkpoint"
      ? `Stage ${stage.number} awaiting review`
      : `Stage ${stage.number}`;

  return (
    <div
      className="flex h-[52px] shrink-0 items-center justify-between border-t border-border bg-background px-6 sm:px-12"
    >
      <span
        className="text-body-sm"
        style={{ color: "var(--color-text-tertiary)" }}
      >
        {label}
      </span>
      {status === "complete" && (
        <button
          type="button"
          onClick={onNext}
          className="text-body-sm font-medium text-primary transition-colors hover:text-primary-hover"
        >
          View Next Stage →
        </button>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Icons
// ────────────────────────────────────────────────────────────────────────────

function CheckIcon({ color = "currentColor" }: { color?: string }) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path
        d="M2.5 6.2L4.8 8.5L9.5 3.5"
        stroke={color}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PauseIcon({ color = "currentColor" }: { color?: string }) {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
      <rect x="2.5" y="2" width="1.5" height="6" rx="0.5" fill={color} />
      <rect x="6" y="2" width="1.5" height="6" rx="0.5" fill={color} />
    </svg>
  );
}

function XIcon({ color = "currentColor" }: { color?: string }) {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
      <path
        d="M2.5 2.5L7.5 7.5M7.5 2.5L2.5 7.5"
        stroke={color}
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}
