import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { runTierOneFastCheck, type TierOneResult } from "@/lib/preflight.functions";
import { supabase } from "@/integrations/supabase/client";

type Phase = "running" | "ready" | "issue_detected" | "error";

export function PreflightStatusBanner() {
  const [phase, setPhase] = useState<Phase>("running");
  const [result, setResult] = useState<TierOneResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const run = useServerFn(runTierOneFastCheck);

  useEffect(() => {
    let active = true;
    setPhase("running");
    setErrorMsg(null);
    (async () => {
      // Skip the protected server fn when there's no session — otherwise
      // it 401s and the resulting runtime error blanks the dashboard.
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) {
        if (!active) return;
        setErrorMsg("Sign in to run pre-flight checks.");
        setPhase("error");
        return;
      }
      try {
        const r = await run({ headers: { Authorization: `Bearer ${token}` } } as never);
        if (!active) return;
        setResult(r);
        setPhase(r.overall);
      } catch (e: unknown) {
        if (!active) return;
        setErrorMsg(e instanceof Error ? e.message : String(e));
        setPhase("error");
      }
    })();
    return () => {
      active = false;
    };
  }, [run]);

  // Visual palette aligned with the existing dashboard tokens.
  const palette = (() => {
    switch (phase) {
      case "ready":
        return { dot: "#E5484D", border: "#E5484D", bg: "#E5484D15", fg: "#E5484D" };
      case "issue_detected":
      case "error":
        return { dot: "#E5484D", border: "#E5484D", bg: "#E5484D15", fg: "#E5484D" };
      case "running":
      default:
        return { dot: "#8B8680", border: "#8B8680", bg: "#1C1A18", fg: "#8B8680" };
    }
  })();

  const headline = (() => {
    if (phase === "running") return "Running pre-flight checks…";
    if (phase === "ready") return "Platform Systems Live";
    if (phase === "issue_detected") {
      const name = result?.firstFailureName ?? "Unknown check";
      return `System Issue Detected — ${name}`;
    }
    return `System Issue Detected — Pre-flight check could not run`;
  })();

  const subline = (() => {
    if (phase === "running") {
      return "Tier One fast check — five lightweight checks. Completes in under 3 minutes.";
    }
    if (phase === "ready") {
      const ms = result?.durationMs ?? 0;
      return `All five fast checks passed in ${(ms / 1000).toFixed(1)}s.`;
    }
    if (phase === "issue_detected" && result) {
      const failed = result.checks.find((c) => c.status === "fail");
      return failed?.detail ?? "See details below.";
    }
    return errorMsg ?? "Unknown error";
  })();

  return (
    <section
      aria-label="Platform pre-flight status"
      style={{
        borderRadius: 12,
        border: `1px solid ${palette.border}`,
        backgroundColor: palette.bg,
        padding: 20,
        marginBottom: 24,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span
          aria-hidden="true"
          style={{
            display: "inline-block",
            width: 10,
            height: 10,
            borderRadius: 999,
            backgroundColor: palette.dot,
            boxShadow:
              phase === "running"
                ? `0 0 0 0 ${palette.dot}80`
                : `0 0 0 4px ${palette.dot}22`,
            animation: phase === "running" ? "pulse 1.4s ease-in-out infinite" : undefined,
          }}
        />
        <div style={{ flex: 1 }}>
          <div
            className="font-semibold"
            style={{ color: palette.fg, fontSize: 14, letterSpacing: "0.02em" }}
          >
            {headline}
          </div>
          <div style={{ color: "#8B8680", fontSize: 13, marginTop: 4 }}>{subline}</div>
        </div>
      </div>

      {(phase === "issue_detected" || phase === "error") && result && (
        <ul style={{ marginTop: 14, paddingLeft: 0, listStyle: "none" }}>
          {result.checks.map((c) => (
            <li
              key={c.id}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 8,
                fontSize: 13,
                color: c.status === "pass" ? "#8B8680" : "#E5484D",
                padding: "4px 0",
              }}
            >
              <span aria-hidden="true">{c.status === "pass" ? "✓" : "✕"}</span>
              <span style={{ flex: 1 }}>
                <span style={{ fontWeight: 600 }}>{c.name}</span> — {c.detail}
              </span>
              <span style={{ color: "#8B8680" }}>{(c.durationMs / 1000).toFixed(1)}s</span>
            </li>
          ))}
        </ul>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }
      `}</style>
    </section>
  );
}
