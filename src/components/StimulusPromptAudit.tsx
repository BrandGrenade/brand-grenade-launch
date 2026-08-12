// PROMPT AUDIT — shows exactly what strategic grounding each of the 37 lens
// calls received for a run: the SMP, the Detonation Line, and the Channel
// Detonation Brief, plus the byte-exact rendered message for any single lens.

import { useCallback, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  auditStimulusRun,
  auditStimulusLensPrompt,
  type StimulusRunAudit,
} from "@/lib/stimulus-audit.functions";

const AMBER = "#F2665F";
const MUTED = "#A8A29A";
const RED = "#E5484D";

function Field({
  label,
  value,
  chars,
  scroll,
}: {
  label: string;
  value: string;
  chars: number;
  scroll?: boolean;
}) {
  return (
    <div style={{ borderTop: "1px solid #1C1A18", paddingTop: 14, marginTop: 14 }}>
      <div
        className="text-mono"
        style={{ color: AMBER, fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase" }}
      >
        {label}
        <span style={{ color: MUTED, marginLeft: 10 }}>{chars.toLocaleString()} chars</span>
      </div>
      <pre
        className="text-body-sm"
        style={{
          color: value.trim() ? "#EDE8E0" : RED,
          marginTop: 8,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          fontFamily: "inherit",
          lineHeight: 1.7,
          maxHeight: scroll ? 320 : undefined,
          overflowY: scroll ? "auto" : undefined,
        }}
      >
        {value.trim() || "— EMPTY: this lens call received nothing for this field"}
      </pre>
    </div>
  );
}

export function StimulusPromptAudit({ runId }: { runId: string }) {
  const runAudit = useServerFn(auditStimulusRun);
  const lensAudit = useServerFn(auditStimulusLensPrompt);

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [audit, setAudit] = useState<StimulusRunAudit | null>(null);
  const [lensId, setLensId] = useState<string>("");
  const [message, setMessage] = useState<string | null>(null);

  const loadAudit = useCallback(async () => {
    setBusy(true);
    setErr(null);
    try {
      const a = await runAudit({ data: { runId, batchSize: 4 } });
      setAudit(a);
      setLensId((prev) => prev || a.lenses[0]?.lensId || "");
      setMessage(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [runAudit, runId]);

  async function showLensMessage(id: string) {
    setBusy(true);
    setErr(null);
    try {
      const r = await lensAudit({ data: { runId, lensId: id } });
      setMessage(r.message);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      style={{
        marginTop: 28,
        border: "1px solid #1C1A18",
        borderRadius: 12,
        backgroundColor: "#0A0908",
        padding: "20px 24px",
      }}
    >
      <button
        type="button"
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next && !audit) void loadAudit();
        }}
        className="text-mono"
        style={{
          background: "none",
          border: "none",
          padding: 0,
          color: AMBER,
          fontSize: 11,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          cursor: "pointer",
        }}
      >
        {open ? "▾" : "▸"} Prompt audit — what all 37 lens calls received
      </button>

      {open && (
        <div style={{ marginTop: 14 }}>
          <p className="text-body-sm" style={{ color: MUTED, lineHeight: 1.7 }}>
            Every lens call in this run received identical strategic grounding. Only the lens block
            differs. This is the exact text, read back from the run record.
          </p>

          {busy && !audit && (
            <div className="text-body-sm" style={{ color: MUTED, marginTop: 12 }}>
              Loading audit…
            </div>
          )}
          {err && (
            <div className="text-body-sm" style={{ color: RED, marginTop: 12 }}>
              {err}
            </div>
          )}

          {audit && (
            <>
              <div
                className="text-mono"
                style={{ color: MUTED, fontSize: 11, marginTop: 14, lineHeight: 1.9 }}
              >
                {audit.brandName} · {audit.category} · channel “{audit.channelName}” ·{" "}
                {audit.lenses.length} lens calls in{" "}
                {Math.ceil(audit.lenses.length / audit.batchSize)} batches of {audit.batchSize}
              </div>

              {!audit.smpMatchesSession && (
                <div
                  className="text-body-sm"
                  style={{
                    color: RED,
                    marginTop: 12,
                    border: `1px solid ${RED}`,
                    borderRadius: 8,
                    padding: "10px 14px",
                    lineHeight: 1.6,
                  }}
                >
                  Drift warning: the SMP frozen into this run is not the session’s current SMP.
                  <div style={{ color: MUTED, marginTop: 6 }}>
                    Session SMP now: {audit.sessionSmp.trim() || "—"}
                  </div>
                </div>
              )}

              <Field label="SMP sent to every lens" value={audit.smp} chars={audit.smpChars} />
              <Field
                label="Detonation line sent to every lens"
                value={audit.detonationLine}
                chars={audit.detonationLineChars}
              />
              <Field
                label="Channel detonation brief sent to every lens"
                value={audit.channelBrief}
                chars={audit.channelBriefChars}
                scroll
              />

              <div style={{ borderTop: "1px solid #1C1A18", paddingTop: 14, marginTop: 14 }}>
                <div
                  className="text-mono"
                  style={{
                    color: AMBER,
                    fontSize: 10,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                  }}
                >
                  Exact rendered message per lens
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
                  <select
                    value={lensId}
                    onChange={(e) => {
                      setLensId(e.target.value);
                      setMessage(null);
                    }}
                    className="text-body-sm"
                    style={{
                      background: "#0A0908",
                      border: "1px solid #1C1A18",
                      color: "#EDE8E0",
                      borderRadius: 6,
                      padding: "8px 10px",
                      minWidth: 300,
                    }}
                  >
                    {audit.lenses.map((l) => (
                      <option key={l.lensId} value={l.lensId}>
                        {l.sortOrder + 1}. {l.lensName} — batch {l.batch} · {l.status}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={busy || !lensId}
                    onClick={() => void showLensMessage(lensId)}
                    className="text-mono"
                    style={{
                      background: AMBER,
                      border: "none",
                      color: "#0A0908",
                      borderRadius: 6,
                      padding: "8px 16px",
                      fontSize: 10,
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      cursor: busy ? "default" : "pointer",
                      opacity: busy ? 0.6 : 1,
                    }}
                  >
                    {busy ? "Loading…" : "Show prompt"}
                  </button>
                </div>

                {message && (
                  <pre
                    className="text-body-sm"
                    style={{
                      marginTop: 12,
                      color: "#EDE8E0",
                      background: "#0A0908",
                      border: "1px solid #1C1A18",
                      borderRadius: 8,
                      padding: 14,
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      fontFamily: "inherit",
                      lineHeight: 1.7,
                      maxHeight: 420,
                      overflowY: "auto",
                    }}
                  >
                    {message}
                  </pre>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
