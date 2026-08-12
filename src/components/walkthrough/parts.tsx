import type { ReactNode } from "react";
import { Prose } from "./Prose";

const CREAM = "#EDE8E0";
const MUTED = "#8B8680";
const LINE = "#1C1A18";
const RED = "#E5484D";

export function StepShell({
  kicker,
  title,
  subtitle,
  children,
}: {
  kicker: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section>
      <p
        className="text-label"
        style={{ color: RED, letterSpacing: "0.14em", textTransform: "uppercase" }}
      >
        {kicker}
      </p>
      <h1 className="text-h1" style={{ color: CREAM, marginTop: 8 }}>
        {title}
      </h1>
      {subtitle ? (
        <p className="text-body" style={{ color: MUTED, marginTop: 8 }}>
          {subtitle}
        </p>
      ) : null}
      <div style={{ marginTop: 28 }}>{children}</div>
    </section>
  );
}

export function Panel({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div
      style={{
        border: `1px solid ${LINE}`,
        borderRadius: 4,
        padding: 24,
        marginBottom: 20,
        backgroundColor: "#0F0E0D",
      }}
    >
      {title ? (
        <p
          className="text-label"
          style={{
            color: MUTED,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            marginBottom: 14,
          }}
        >
          {title}
        </p>
      ) : null}
      {children}
    </div>
  );
}

export function Empty({ text }: { text: string }) {
  return (
    <p className="text-body" style={{ color: MUTED, fontStyle: "italic" }}>
      {text}
    </p>
  );
}

/** Render an unknown JSONB value as readable content, never raw JSON soup. */
export function JsonBlock({ value }: { value: unknown }) {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return <Prose text={value} />;
  if (typeof value === "number" || typeof value === "boolean") {
    return (
      <p className="text-body" style={{ color: MUTED }}>
        {String(value)}
      </p>
    );
  }
  if (Array.isArray(value)) {
    return (
      <div>
        {value.map((v, i) => (
          <div key={i} style={{ marginBottom: 16 }}>
            <JsonBlock value={v} />
          </div>
        ))}
      </div>
    );
  }
  const entries = Object.entries(value as Record<string, unknown>);
  return (
    <div>
      {entries.map(([k, v]) => (
        <div key={k} style={{ marginBottom: 12 }}>
          <p
            className="text-label"
            style={{
              color: CREAM,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              marginBottom: 4,
            }}
          >
            {k.replace(/_/g, " ")}
          </p>
          <JsonBlock value={v} />
        </div>
      ))}
    </div>
  );
}

export function CheckpointCard({
  letter,
  label,
  what,
  confirmed,
  confirmedAt,
  notes,
  decision,
}: {
  letter: string;
  label: string;
  what: string;
  confirmed: boolean;
  confirmedAt?: string | null;
  notes?: string | null;
  decision?: string | null;
}) {
  return (
    <Panel>
      <div style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
        <span className="text-h2" style={{ color: RED }}>
          {letter}
        </span>
        <div style={{ flex: 1 }}>
          <p className="text-h3" style={{ color: CREAM }}>
            {label}
          </p>
          <p className="text-body" style={{ color: MUTED, marginTop: 6 }}>
            {what}
          </p>
        </div>
        <span
          className="text-label"
          style={{
            color: confirmed ? "#7BB661" : MUTED,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}
        >
          {confirmed ? "Confirmed" : "Not recorded"}
        </span>
      </div>
      {decision ? (
        <div style={{ marginTop: 18, borderTop: `1px solid ${LINE}`, paddingTop: 14 }}>
          <p
            className="text-label"
            style={{ color: MUTED, letterSpacing: "0.1em", textTransform: "uppercase" }}
          >
            Decision taken
          </p>
          <p className="text-body" style={{ color: CREAM, marginTop: 6 }}>
            {decision}
          </p>
        </div>
      ) : null}
      {notes && notes.trim() ? (
        <div style={{ marginTop: 14 }}>
          <p
            className="text-label"
            style={{ color: MUTED, letterSpacing: "0.1em", textTransform: "uppercase" }}
          >
            Human note
          </p>
          <Prose text={notes} />
        </div>
      ) : null}
      {confirmedAt ? (
        <p className="text-label" style={{ color: MUTED, marginTop: 12 }}>
          {new Date(confirmedAt).toLocaleString("en-GB")}
        </p>
      ) : null}
    </Panel>
  );
}

export type DispositionRow = {
  id: string;
  verdict: "SURVIVED" | "REBUILT INTO" | "REJECTED";
  detail: string;
  candidateLine?: string;
};

const VERDICT_COLOUR: Record<DispositionRow["verdict"], string> = {
  SURVIVED: "#7BB661",
  "REBUILT INTO": "#D9A441",
  REJECTED: RED,
};

/** Every candidate accounted for — rejections rendered as first-class content. */
export function DispositionLedger({ rows }: { rows: DispositionRow[] }) {
  if (!rows.length) return <Empty text="No disposition ledger was recorded for this run." />;
  const counts = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.verdict] = (acc[r.verdict] ?? 0) + 1;
    return acc;
  }, {});
  return (
    <div>
      <p className="text-body" style={{ color: MUTED, marginBottom: 16 }}>
        {rows.length} candidates entered this stage · {counts["SURVIVED"] ?? 0} survived ·{" "}
        {counts["REBUILT INTO"] ?? 0} rebuilt · {counts["REJECTED"] ?? 0} set aside.
      </p>
      {rows.map((r) => (
        <div
          key={r.id}
          style={{
            borderLeft: `3px solid ${VERDICT_COLOUR[r.verdict]}`,
            paddingLeft: 16,
            marginBottom: 18,
          }}
        >
          <div style={{ display: "flex", gap: 12, alignItems: "baseline" }}>
            <span className="text-label" style={{ color: MUTED }}>
              {r.id}
            </span>
            <span
              className="text-label"
              style={{
                color: VERDICT_COLOUR[r.verdict],
                letterSpacing: "0.1em",
                textTransform: "uppercase",
              }}
            >
              {r.verdict}
            </span>
          </div>
          {r.candidateLine ? (
            <p className="text-body" style={{ color: CREAM, marginTop: 6 }}>
              “{r.candidateLine}”
            </p>
          ) : null}
          <p className="text-body" style={{ color: MUTED, marginTop: 4, lineHeight: 1.8 }}>
            {r.detail}
          </p>
        </div>
      ))}
    </div>
  );
}

/** Parse "<ID> | VERDICT | detail" rows out of a stage output. */
export function parseDispositionRows(
  text: string | null | undefined,
  candidates: Array<{ id: string; line: string }>,
): DispositionRow[] {
  const byId = new Map(candidates.map((c) => [c.id.toUpperCase(), c.line]));
  const out: DispositionRow[] = [];
  const seen = new Set<string>();
  for (const raw of (text ?? "").split("\n")) {
    const line = raw.replace(/\*+/g, "").trim();
    const m = line.match(
      /^((?:S8|LOC)-\d+)\s*\|\s*(SURVIVED|REBUILT\s+INTO|REBUILT|REJECTED)\s*\|?\s*(.*)$/i,
    );
    if (!m) continue;
    const id = m[1]!.toUpperCase();
    if (seen.has(id)) continue;
    seen.add(id);
    const v = m[2]!.toUpperCase().replace(/\s+/g, " ");
    const verdict: DispositionRow["verdict"] =
      v === "SURVIVED" ? "SURVIVED" : v === "REJECTED" ? "REJECTED" : "REBUILT INTO";
    const candidateLine = byId.get(id);
    out.push({
      id,
      verdict,
      detail: (m[3] ?? "").trim() || "—",
      ...(candidateLine ? { candidateLine } : {}),
    });
  }
  return out.sort((a, b) => {
    const [ap, an] = a.id.split("-") as [string, string];
    const [bp, bn] = b.id.split("-") as [string, string];
    if (ap !== bp) return ap.localeCompare(bp);
    return Number(an) - Number(bn);
  });
}
