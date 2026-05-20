import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { TopNav } from "@/components/TopNav";

export const Route = createFileRoute("/complete")({
  component: CompletePage,
  head: () => ({
    meta: [
      { title: "Pipeline Complete — Brand Grenade" },
      {
        name: "description",
        content:
          "Strategic platform document ready. Select an output format and download.",
      },
    ],
  }),
});

const BRAND = "Hypernova";
const SMP =
  "Hypernova settles the books, not just the transfer — the only payments rail finance teams close their month around.";
const FIELD = "Finance Stack Trust";
const BRAND_ROLE = "Default Integration";
const STRATEGIC_MODE = "Category Reframe";

const STAGES = [
  "Brief Sanitisation",
  "Category Intelligence",
  "Constraint Generator",
  "Strategic Fan-Out",
  "Insight Generation",
  "Insight Filter",
  "Field Synthesis",
  "SMP Generation",
  "Divergence Validation",
  "SMP Scoring",
  "Pressure Test",
  "SMP Selection",
  "Brand Fit Validation",
  "Territory Mapping",
  "Consistency Audit",
  "Output Packaging",
];

type Format = "pitch" | "consulting" | "workshop";

function CompletePage() {
  const [format, setFormat] = useState<Format>("consulting");
  const [generating, setGenerating] = useState(false);
  const [stagesOpen, setStagesOpen] = useState(false);
  const [modalStage, setModalStage] = useState<string | null>(null);

  const smpPreview = SMP.split(" ").slice(0, 4).join(" ") + "…";

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <TopNav />
      {/* Breadcrumb */}
      <div className="flex items-center border-b border-border bg-background px-5 py-3 sm:px-8">
        <nav
          className="text-body-sm flex items-center gap-1.5 truncate"
          style={{ color: "var(--color-text-tertiary)" }}
        >
          <Link
            to="/dashboard"
            className="transition-colors hover:text-text-secondary"
          >
            Sessions
          </Link>
          <span>→</span>
          <span className="text-text-secondary truncate">{BRAND}</span>
          <span>→</span>
          <span>Complete</span>
        </nav>
      </div>

      <main className="mx-auto w-full max-w-[800px] px-5 sm:px-8" style={{ paddingTop: 64, paddingBottom: 96 }}>
        {/* Hero */}
        <section style={{ textAlign: "center", paddingBottom: 48 }}>
          <div
            aria-hidden
            style={{
              display: "inline-grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 4,
              width: 32,
              height: 32,
              marginBottom: 24,
            }}
          >
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                style={{
                  backgroundColor: "var(--color-primary)",
                  borderRadius: 2,
                }}
              />
            ))}
          </div>
          <div>
            <span
              className="text-label"
              style={{ color: "var(--color-success)" }}
            >
              PIPELINE COMPLETE
            </span>
          </div>
          <h1
            className="text-display text-text-primary"
            style={{ margin: "16px 0" }}
          >
            {BRAND} Strategic Platform
          </h1>
          <p
            className="text-body-lg"
            style={{ color: "var(--color-text-secondary)" }}
          >
            20 stages complete. 3 human checkpoints confirmed. Strategic
            platform document ready.
          </p>
          <hr
            className="border-0 bg-border"
            style={{
              height: 1,
              maxWidth: 200,
              margin: "32px auto",
            }}
          />
        </section>

        {/* Pipeline summary card */}
        <div
          style={{
            backgroundColor: "var(--color-surface-3)",
            border: "1px solid var(--color-border)",
            borderRadius: 12,
            padding: 32,
            marginBottom: 32,
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 24,
          }}
        >
          <Stat value="20" label="STAGES COMPLETED" tone="success" />
          <Stat value="3" label="CHECKPOINTS CONFIRMED" tone="success" />
          <Stat value={smpPreview} label="SELECTED PROPOSITION" tone="primary" />
        </div>

        {/* Selected proposition */}
        <div
          style={{
            backgroundColor: "var(--color-surface-2)",
            border: "1px solid var(--color-primary)",
            borderRadius: 12,
            padding: 32,
            marginBottom: 32,
          }}
        >
          <span className="text-label text-primary">
            YOUR STRATEGIC PROPOSITION
          </span>
          <h2
            className="text-h1 text-text-primary"
            style={{ margin: "16px 0 24px", lineHeight: 1.3 }}
          >
            {SMP}
          </h2>
          <p
            className="text-body-sm"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            Field: {FIELD} | Brand Role: {BRAND_ROLE} | Strategic Mode:{" "}
            {STRATEGIC_MODE}
          </p>
        </div>

        {/* Format selection */}
        <div style={{ marginBottom: 16 }}>
          <span className="text-label text-primary">SELECT OUTPUT FORMAT</span>
        </div>
        <p
          className="text-body"
          style={{ color: "var(--color-text-secondary)", marginBottom: 24 }}
        >
          The same pipeline output packaged three different ways. Select the
          format appropriate for your audience.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 16,
          }}
        >
          <FormatCard
            id="pitch"
            selected={format === "pitch"}
            onSelect={setFormat}
            icon={<DeckIcon />}
            title="Agency Pitch"
            description="SMP-led, creative-territory-first, compressed. For agencies receiving the strategy to build from."
            tag="~15 pages"
          />
          <FormatCard
            id="consulting"
            selected={format === "consulting"}
            onSelect={setFormat}
            icon={<DocsIcon />}
            title="Consulting Delivery"
            description="Evidence-led, methodology-visible, comprehensive. For board-level client presentations."
            tag="~25 pages"
          />
          <FormatCard
            id="workshop"
            selected={format === "workshop"}
            onSelect={setFormat}
            icon={<PeopleIcon />}
            title="Brand Workshop"
            description="Facilitation-ready, participatory, session-structured. For internal team alignment."
            tag="~20 pages + session guide"
          />
        </div>

        {/* Download section */}
        <div style={{ marginTop: 32 }}>
          <button
            type="button"
            onClick={() => {
              setGenerating(true);
              window.setTimeout(() => setGenerating(false), 2500);
            }}
            disabled={generating}
            style={{
              width: "100%",
              height: 56,
              borderRadius: 8,
              border: "none",
              backgroundColor: "var(--color-primary)",
              color: "var(--color-background)",
              fontWeight: 600,
              fontSize: 16,
              cursor: generating ? "wait" : "pointer",
            }}
          >
            {generating
              ? "Generating…"
              : "Download Strategic Platform Document ↓"}
          </button>
          {generating && (
            <p
              className="text-body-sm"
              style={{
                color: "var(--color-text-tertiary)",
                textAlign: "center",
                marginTop: 8,
              }}
            >
              Generating PDF — this takes approximately 15 seconds.
            </p>
          )}

          <div
            style={{
              marginTop: 16,
              display: "flex",
              justifyContent: "center",
              gap: 24,
              flexWrap: "wrap",
            }}
          >
            <TextLink color="primary">View in browser</TextLink>
            <TextLink>Copy shareable link</TextLink>
            <Link
              to="/brief"
              className="text-body-sm transition-colors hover:text-text-primary"
              style={{ color: "var(--color-text-secondary)" }}
            >
              Start new run
            </Link>
          </div>
        </div>

        {/* Pipeline stages collapsible */}
        <div style={{ marginTop: 48 }}>
          <button
            type="button"
            onClick={() => setStagesOpen((v) => !v)}
            className="text-label flex w-full items-center justify-between border-t border-border py-4 text-left transition-colors"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            <span>VIEW FULL PIPELINE OUTPUT</span>
            <span
              style={{
                transition: "transform 200ms",
                transform: stagesOpen ? "rotate(90deg)" : "rotate(0deg)",
                display: "inline-block",
              }}
            >
              ›
            </span>
          </button>
          {stagesOpen && (
            <ul style={{ borderTop: "1px solid var(--color-border)" }}>
              {STAGES.map((name, i) => (
                <li
                  key={i}
                  style={{
                    borderBottom: "1px solid var(--color-border)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "14px 4px",
                  }}
                >
                  <span
                    className="text-body"
                    style={{ color: "var(--color-text-primary)" }}
                  >
                    <span
                      className="text-mono"
                      style={{
                        color: "var(--color-text-tertiary)",
                        marginRight: 12,
                      }}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    {name}
                  </span>
                  <button
                    type="button"
                    onClick={() => setModalStage(name)}
                    className="text-body-sm font-medium text-primary transition-colors hover:text-primary-hover"
                  >
                    View output
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>

      {modalStage && (
        <StageModal
          stage={modalStage}
          onClose={() => setModalStage(null)}
        />
      )}
    </div>
  );
}

function Stat({
  value,
  label,
  tone,
}: {
  value: string;
  label: string;
  tone: "success" | "primary";
}) {
  const color =
    tone === "success" ? "var(--color-success)" : "var(--color-primary)";
  return (
    <div>
      <div
        className="text-h2 text-text-primary"
        style={{ display: "flex", alignItems: "center", gap: 8 }}
      >
        <span style={{ fontSize: tone === "primary" ? 16 : undefined }}>
          {value}
        </span>
        {tone === "success" && (
          <span style={{ color }}>
            <CheckIcon color={color} />
          </span>
        )}
      </div>
      <p
        className="text-label"
        style={{ color: "var(--color-text-tertiary)", marginTop: 8 }}
      >
        {label}
      </p>
    </div>
  );
}

function FormatCard({
  id,
  selected,
  onSelect,
  icon,
  title,
  description,
  tag,
}: {
  id: Format;
  selected: boolean;
  onSelect: (id: Format) => void;
  icon: React.ReactNode;
  title: string;
  description: string;
  tag: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(id)}
      style={{
        textAlign: "left",
        border: `1px solid ${
          selected ? "var(--color-primary)" : "var(--color-border)"
        }`,
        backgroundColor: selected
          ? "oklch(0.65 0.12 60 / 0.05)"
          : "transparent",
        borderRadius: 12,
        padding: 24,
        cursor: "pointer",
        transition: "all 150ms",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <span style={{ color: "var(--color-primary)" }}>{icon}</span>
      <p
        className="text-body"
        style={{
          fontWeight: 600,
          color: "var(--color-text-primary)",
          marginTop: 12,
        }}
      >
        {title}
      </p>
      <p
        className="text-body-sm"
        style={{ color: "var(--color-text-secondary)", marginTop: 8, flex: 1 }}
      >
        {description}
      </p>
      <p
        className="text-label"
        style={{ color: "var(--color-text-tertiary)", marginTop: 12 }}
      >
        {tag}
      </p>
    </button>
  );
}

function TextLink({
  children,
  color,
}: {
  children: React.ReactNode;
  color?: "primary";
}) {
  return (
    <a
      href="#"
      onClick={(e) => e.preventDefault()}
      className="text-body-sm transition-colors hover:text-text-primary"
      style={{
        color:
          color === "primary"
            ? "var(--color-primary)"
            : "var(--color-text-secondary)",
      }}
    >
      {children}
    </a>
  );
}

function StageModal({
  stage,
  onClose,
}: {
  stage: string;
  onClose: () => void;
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        zIndex: 50,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 720,
          maxHeight: "85vh",
          overflowY: "auto",
          backgroundColor: "var(--color-surface-3)",
          border: "1px solid var(--color-border)",
          borderRadius: 12,
          padding: 32,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <span className="text-label text-primary">STAGE OUTPUT</span>
          <button
            type="button"
            onClick={onClose}
            className="text-body-sm"
            style={{ color: "var(--color-text-secondary)" }}
          >
            Close ✕
          </button>
        </div>
        <h2 className="text-h2 text-text-primary" style={{ marginBottom: 16 }}>
          {stage}
        </h2>
        <p
          className="text-body"
          style={{ color: "var(--color-text-secondary)", lineHeight: 1.7 }}
        >
          Full output for this stage would render here, including all
          generated content, scores, and audit notes captured during the
          pipeline run.
        </p>
      </div>
    </div>
  );
}

// ─── Icons ─────────────────────────────────────────────────────────────

function CheckIcon({ color = "currentColor" }: { color?: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 12 12" fill="none">
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

function DeckIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="5" width="18" height="2" rx="1" fill="currentColor" />
      <rect x="3" y="11" width="18" height="2" rx="1" fill="currentColor" />
      <rect x="3" y="17" width="12" height="2" rx="1" fill="currentColor" />
    </svg>
  );
}

function DocsIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <rect
        x="4"
        y="3"
        width="13"
        height="16"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <rect
        x="7"
        y="6"
        width="13"
        height="16"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="var(--color-background)"
      />
    </svg>
  );
}

function PeopleIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <circle cx="8" cy="9" r="3" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="16" cy="9" r="3" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M3 19c0-2.8 2.2-5 5-5s5 2.2 5 5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M13 19c0-2.8 2.2-5 5-5s3 1 3 1"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
