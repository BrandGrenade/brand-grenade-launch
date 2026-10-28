// PHASE 5 — MANDATE AN ELEMENT AT GATE TWO.
// The Creative Director names one element the whole set must carry: an existing
// Campaign Signature, or something new. It is binding across every channel —
// no per-channel accept or reject — and applying it triggers a full cohesion
// re-run, which voids the current Gate Two approvals.

import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { applyGateTwoMandate, getMandateOptions } from "@/lib/stimulus-mandate.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LoaderCircle, RefreshCw } from "lucide-react";
import { JLR_ORCHESTRATION_ID } from "@/lib/stimulus/jlr-mandate-recovery";

const AMBER = "#F2665F";
const MUTED = "#A8A29A";
const GREEN = "#3F7D5C";

type Sig = {
  id: string;
  name: string;
  category: string;
  description: string;
  sourceChannel: string;
};

type LogEntry = {
  at: string;
  mandate: string;
  source: string;
  promptsRewritten?: number;
  cohesion?: string;
};

export function StimulusMandate({
  orchestrationId,
  promptCount,
  onApplied,
}: {
  orchestrationId: string;
  promptCount: number;
  /** Reloads orchestration state — prompts and CD verdict have both changed. */
  onApplied: () => Promise<void> | void;
}) {
  const loadOptions = useServerFn(getMandateOptions);
  const apply = useServerFn(applyGateTwoMandate);

  const [open, setOpen] = useState(false);
  const [sigs, setSigs] = useState<Sig[]>([]);
  const [current, setCurrent] = useState<{ text: string; source: string; appliedAt: string | null } | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [chosenSig, setChosenSig] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [recoveryBusy, setRecoveryBusy] = useState(false);
  const [recoveryProgress, setRecoveryProgress] = useState<string | null>(null);

  useEffect(() => {
    if (orchestrationId !== JLR_ORCHESTRATION_ID) return;
    let stopped = false;
    const observe = async () => {
      const { data } = await supabase.from("stimulus_orchestrations").select("phase_note, driver_status").eq("id", orchestrationId).maybeSingle();
      if (!stopped && data?.phase_note && (data.phase_note.startsWith("Mandate recovery") || data.phase_note.startsWith("All 9 channels carry the mandate") || data.phase_note.startsWith("Gate Two remains blocked."))) setRecoveryProgress(data.phase_note);
    };
    void observe();
    const timer = setInterval(() => void observe(), 4000);
    return () => { stopped = true; clearInterval(timer); };
  }, [orchestrationId]);

  const recover = async () => {
    setRecoveryBusy(true);
    setErr(null);
    setRecoveryProgress("Mandate recovery: preparing four channels; five protected channels unchanged.");
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) throw new Error("Sign in to recover the channels.");
      const response = await fetch("/api/public/jlr-mandate-recovery", { method: "POST", headers: { Authorization: `Bearer ${data.session.access_token}` } });
      if (!response.ok || !response.body) throw new Error(await response.text() || "Recovery could not start.");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let pending = "";
      let completed = false;
      for (;;) {
        const chunk = await reader.read();
        if (chunk.done) break;
        pending += decoder.decode(chunk.value, { stream: true });
        const lines = pending.split("\n");
        pending = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line);
          if (event.message) setRecoveryProgress(event.message);
          if (event.error) throw new Error(event.error);
          if (event.done) { completed = true; setResult(event.message); }
        }
      }
      if (!completed) throw new Error("The connection ended before completion; check saved progress before retrying.");
      await refresh();
      await onApplied();
    } catch (e) { setErr(e instanceof Error ? e.message : "Recovery failed."); }
    finally { setRecoveryBusy(false); }
  };

  const refresh = useCallback(async () => {
    try {
      const r = await loadOptions({ data: { orchestrationId } });
      setSigs(r.signatures as Sig[]);
      setCurrent(r.current ?? null);
      setLog((r.log ?? []) as LogEntry[]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not load mandate options");
    }
  }, [loadOptions, orchestrationId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const canApply = Boolean(chosenSig || text.trim().length > 2);

  return (
    <div
      style={{
        marginTop: 16,
        border: `1px solid ${current ? GREEN : AMBER}44`,
        borderRadius: 8,
        padding: 14,
      }}
    >
      <div className="text-mono" style={{ color: current ? GREEN : AMBER, fontSize: 10, letterSpacing: "0.12em" }}>
        MANDATE AN ELEMENT
        {current ? ` · IN FORCE${current.appliedAt ? ` SINCE ${new Date(current.appliedAt).toLocaleString()}` : ""}` : ""}
      </div>
      <div className="text-body-sm" style={{ color: MUTED, marginTop: 6 }}>
        One element every channel must carry. Binding — it goes into all {promptCount} active prompts, expressed in
        each channel's own terms, and the Creative Director re-judges the whole set afterwards. Current Gate Two
        approvals are cleared, because the work being approved will have changed.
      </div>

      {current && (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            border: `1px solid ${GREEN}44`,
            borderRadius: 6,
            backgroundColor: "#0A0908",
          }}
        >
          <div className="text-mono" style={{ color: MUTED, fontSize: 10 }}>
            {current.source === "signature" ? "From the signature registry" : "Written at Gate Two"}
          </div>
          <div className="text-body-sm" style={{ color: "#EDE8E0", marginTop: 6, whiteSpace: "pre-wrap" }}>
            {current.text}
          </div>
        </div>
      )}

      {orchestrationId === JLR_ORCHESTRATION_ID && current && (
        <div className="mt-4 border-t border-border pt-3">
          <Button variant="outline" disabled={recoveryBusy || busy} onClick={() => void recover()} className="h-auto min-h-9 whitespace-normal text-left">
            {recoveryBusy ? <LoaderCircle className="animate-spin motion-reduce:animate-none" /> : <RefreshCw />}
            Recover the four failed channels
          </Button>
          {recoveryProgress && <div role="status" aria-live="polite" className="mt-3 flex items-start gap-2 text-sm text-foreground">
            {recoveryBusy && <LoaderCircle className="mt-0.5 size-4 shrink-0 animate-spin motion-reduce:animate-none" />}
            <span>{recoveryProgress}</span>
          </div>}
        </div>
      )}

      <button
        type="button"
        className="text-mono"
        onClick={() => setOpen((v) => !v)}
        style={{
          marginTop: 12,
          background: "none",
          border: `1px solid ${AMBER}55`,
          color: AMBER,
          padding: "6px 12px",
          borderRadius: 6,
          fontSize: 10,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          cursor: "pointer",
        }}
      >
        {open ? "Close" : current ? "Replace the mandate" : "Set a mandate"}
      </button>

      {open && (
        <div style={{ marginTop: 14 }}>
          {sigs.length > 0 && (
            <>
              <div className="text-mono" style={{ color: MUTED, fontSize: 10, letterSpacing: "0.1em" }}>
                MANDATE AN EXISTING SIGNATURE
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                {sigs.map((s) => {
                  const active = chosenSig === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setChosenSig(active ? null : s.id)}
                      style={{
                        textAlign: "left",
                        background: active ? `${AMBER}18` : "none",
                        border: `1px solid ${active ? AMBER : "#1C1A18"}`,
                        borderRadius: 6,
                        padding: 10,
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ color: active ? AMBER : "#EDE8E0", fontSize: 14 }}>
                        {s.name}{" "}
                        <span className="text-mono" style={{ color: MUTED, fontSize: 10 }}>
                          · {s.category} · from {s.sourceChannel}
                        </span>
                      </div>
                      <div className="text-body-sm" style={{ color: MUTED, marginTop: 4 }}>
                        {s.description}
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          <div className="text-mono" style={{ color: MUTED, fontSize: 10, letterSpacing: "0.1em", marginTop: 14 }}>
            {chosenSig ? "OPTIONAL — ADD A DIRECTION TO THAT SIGNATURE" : "OR WRITE A NEW MANDATE"}
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            placeholder={
              chosenSig
                ? "How that signature should be carried — optional."
                : "The element every channel must carry. Be specific about what it is, not why it matters."
            }
            style={{
              width: "100%",
              marginTop: 8,
              backgroundColor: "#0A0908",
              color: "#EDE8E0",
              border: `1px solid ${AMBER}40`,
              borderRadius: 6,
              padding: 10,
              fontFamily: "inherit",
              fontSize: 13,
              lineHeight: 1.5,
              resize: "vertical",
            }}
          />

          <button
            type="button"
            className="text-mono"
            disabled={!canApply || busy}
            onClick={async () => {
              setBusy(true);
              setErr(null);
              setResult(null);
              try {
                const r = await apply({
                  data: {
                    orchestrationId,
                    signatureId: chosenSig ?? undefined,
                    mandateText: text.trim() || undefined,
                  },
                });
                setResult(
                  `Mandate queued for ${r.queued} channel(s). Each is rewritten and checked; a channel that misses it is retried twice automatically. Progress shows at the top of Step 4.`,
                );
                setText("");
                setChosenSig(null);
                setOpen(false);
                await refresh();
                await onApplied();
              } catch (e) {
                setErr(e instanceof Error ? e.message : "Mandate failed");
              } finally {
                setBusy(false);
              }
            }}
            style={{
              marginTop: 12,
              background: `${AMBER}22`,
              border: `1px solid ${AMBER}`,
              color: AMBER,
              padding: "8px 14px",
              borderRadius: 6,
              fontSize: 10,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              cursor: !canApply || busy ? "not-allowed" : "pointer",
              opacity: !canApply || busy ? 0.45 : 1,
            }}
          >
            {busy
              ? `Rewriting ${promptCount} prompts and re-judging the set…`
              : `Mandate across all ${promptCount} prompts`}
          </button>
        </div>
      )}

      {result && (
        <div className="text-body-sm" style={{ color: GREEN, marginTop: 10 }}>
          {result}
        </div>
      )}
      {err && (
        <div className="text-body-sm" style={{ color: AMBER, marginTop: 10 }}>
          {err}
        </div>
      )}

      {log.length > 1 && (
        <div className="text-body-sm" style={{ color: MUTED, marginTop: 12, fontSize: 12 }}>
          {log.length} mandates applied to this set. Most recent first:{" "}
          {[...log]
            .reverse()
            .slice(0, 3)
            .map((l) => `${new Date(l.at).toLocaleDateString()} (${l.cohesion ?? "—"})`)
            .join(" · ")}
        </div>
      )}
    </div>
  );
}
