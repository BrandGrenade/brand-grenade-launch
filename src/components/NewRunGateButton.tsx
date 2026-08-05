// "New Pipeline Run" button with the Platform Not Verified gate.
//
// Behaviour:
//   • While gate status is unknown → renders a neutral placeholder button.
//   • Allowed (last Tier Two ≤ 24h, overall=ready) → renders an enabled link
//     to /brief.
//   • Disallowed → renders a disabled "Platform Not Verified" button. Clicking
//     it opens an explicit override dialog requiring a typed reason; the
//     override is persisted to preflight_checks (timestamp + reason + user),
//     then the user is navigated to /brief.

import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from "@/components/ui/alert-dialog";
import {
  getPipelineGate,
  logPipelineRunOverride,
  type PipelineGateStatus,
} from "@/lib/pipeline-gate.functions";

export type NewRunGateButtonProps = {
  variant?: "topnav" | "empty" | "launch";
  label?: string;
  prefix?: string;
  style?: React.CSSProperties;
  className?: string;
};

export function NewRunGateButton({ variant = "topnav", label = "Strategy Pipeline", prefix, style, className }: NewRunGateButtonProps) {
  const getGate = useServerFn(getPipelineGate);
  const logOverride = useServerFn(logPipelineRunOverride);
  const navigate = useNavigate();

  const [gate, setGate] = useState<PipelineGateStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const fetchedAtRef = useRef(0);

  const refresh = useMemo(
    () => async () => {
      try {
        // Skip server call when the user has no session — the gate fn
        // requires auth and would 401, blanking the page in some dev flows.
        const { data: sess } = await supabase.auth.getSession();
        const token = sess.session?.access_token;
        if (!token) {
          const fallbackGate: PipelineGateStatus = {
            allowed: true,
            reason: "ready",
            message: "Not signed in",
            lastCheck: null,
          };
          console.info("[PipelineGate] dashboard gate result", fallbackGate);
          setGate(fallbackGate);
          return;
        }
        const g = await getGate({
          headers: { Authorization: `Bearer ${token}` },
        });
        console.info("[PipelineGate] dashboard gate result", g);
        setGate(g);
        fetchedAtRef.current = Date.now();
      } catch (e) {
        // Fail-open: if the gate itself errors, do NOT silently block the user
        // from starting a run. Surface "ready" so the New Run flow still works.
        const fallbackGate: PipelineGateStatus = {
          allowed: true,
          reason: "ready",
          message: e instanceof Error ? e.message : "Gate unavailable",
          lastCheck: null,
        };
        console.info("[PipelineGate] dashboard gate result", fallbackGate);
        setGate(fallbackGate);
      } finally {
        setLoading(false);
      }
    },
    [getGate],
  );


  useEffect(() => {
    void refresh();
    const onVisibility = () => {
      if (document.visibilityState === "visible" && Date.now() - fetchedAtRef.current > 30_000) {
        void refresh();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [refresh]);

  const submitOverride = async () => {
    if (reason.trim().length < 4) {
      toast.error("Please provide a reason (min 4 characters).");
      return;
    }
    setSubmitting(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error("Please sign in again.");
      await logOverride({
        data: { reason: reason.trim() },
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success("Override logged. Starting new run.");
      setDialogOpen(false);
      setReason("");
      void navigate({ to: "/brief" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to log override");
    } finally {
      setSubmitting(false);
    }
  };

  const isTopNav = variant === "topnav";
  const isLaunch = variant === "launch";

  const launchEnabledStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 10,
    height: 44,
    padding: "0 22px",
    borderRadius: 10,
    backgroundColor: "#C81E1E",
    color: "#0A0908",
    fontWeight: 700,
    fontSize: 14,
    letterSpacing: "0.02em",
    boxShadow: "0 2px 12px rgba(200, 30, 30,0.25)",
    cursor: "pointer",
    border: "none",
  };

  const baseEnabledStyle: React.CSSProperties = isLaunch
    ? launchEnabledStyle
    : isTopNav
    ? {
        display: "inline-flex",
        alignItems: "center",
        height: 36,
        padding: "0 16px",
        borderRadius: 8,
        backgroundColor: "#C81E1E",
        color: "#0A0908",
        fontWeight: 600,
        fontSize: 13,
      }
    : {
        marginTop: 24,
        display: "inline-flex",
        alignItems: "center",
        padding: "10px 20px",
        borderRadius: 8,
        border: "1px solid #C81E1E",
        color: "#C81E1E",
        fontWeight: 500,
        fontSize: 13,
        background: "transparent",
      };

  const finalEnabledStyle: React.CSSProperties = style ?? baseEnabledStyle;
  const finalDisabledStyle: React.CSSProperties = style
    ? { ...style, cursor: "pointer" }
    : {
        ...baseEnabledStyle,
        backgroundColor: "transparent",
        border: "1px solid #FF3B3B",
        color: "#FF3B3B",
        cursor: "pointer",
        boxShadow: "none",
      };

  const prefixNode = prefix ? (
    <span
      aria-hidden
      style={{
        fontFamily:
          'ui-monospace, "JetBrains Mono", SFMono-Regular, Menlo, monospace',
        fontSize: 11,
        opacity: 0.65,
        letterSpacing: "0.08em",
      }}
    >
      {prefix}
    </span>
  ) : null;

  if (loading) {
    const loadingStyle: React.CSSProperties = style
      ? { ...style, opacity: 0.5, pointerEvents: "none" }
      : {
          ...baseEnabledStyle,
          opacity: 0.5,
          pointerEvents: "none",
          backgroundColor: isTopNav || isLaunch ? "#1C1A18" : "transparent",
          color: "#8B8680",
          border: isTopNav || isLaunch ? "none" : "1px solid #1C1A18",
          boxShadow: "none",
        };

    return (
      <span style={loadingStyle} className={className}>
        {prefixNode}
        {isLaunch ? "Checking…" : "Checking platform…"}
      </span>
    );
  }

  if (gate?.allowed) {
    return (
      <Link to="/brief" style={finalEnabledStyle} className={className}>
        {prefixNode}
        {label}
      </Link>
    );
  }

  return (
    <>
      <button
        type="button"
        aria-label={`${label} — ${gate?.message ?? "Platform Not Verified"}`}
        onClick={() => setDialogOpen(true)}
        style={finalDisabledStyle}
        className={className}
        title={gate?.message ?? "Platform Not Verified"}
      >
        {prefixNode}
        {label}
      </button>
      <AlertDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!submitting) {
            setDialogOpen(open);
            if (!open) setReason("");
          }
        }}
      >
        <AlertDialogContent
          className="border-0 p-0 sm:max-w-[480px]"
          style={{
            backgroundColor: "#1C1A18",
            border: "1px solid #C81E1E",
            borderRadius: 12,
            padding: 28,
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle asChild>
              <h3 className="text-h3" style={{ color: "#EDE8E0" }}>
                Override Platform Not Verified?
              </h3>
            </AlertDialogTitle>
            <AlertDialogDescription
              className="text-body"
              style={{ color: "#8B8680", marginTop: 8 }}
            >
              {gate?.message}
              <br />
              <br />
              Continuing means you are running a client pipeline without a
              passing Tier Two integrity check in the last 24 hours. The
              override will be logged with your user id, the current timestamp,
              and the reason below.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div style={{ marginTop: 18 }}>
            <label
              htmlFor="override-reason"
              className="text-label"
              style={{ color: "#C81E1E" }}
            >
              Reason for override (required)
            </label>
            <textarea
              id="override-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder="e.g. Internal demo with non-production data; no live client present."
              className="mt-2 w-full bg-card/60 p-3 text-sm text-text-primary outline-none"
              style={{ border: "1px solid #1C1A18", borderRadius: 6 }}
            />
          </div>

          <AlertDialogFooter
            className="flex flex-row justify-end gap-3 sm:space-x-0"
            style={{ marginTop: 24 }}
          >
            <button
              type="button"
              disabled={submitting}
              onClick={() => setDialogOpen(false)}
              className="inline-flex h-9 items-center justify-center rounded-lg px-4 text-[13px] font-medium transition-colors hover:bg-[var(--color-surface-2)] disabled:opacity-50"
              style={{ border: "1px solid var(--color-border)", color: "var(--color-text-primary)" }}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={submitting || reason.trim().length < 4}
              onClick={submitOverride}
              className="inline-flex h-9 items-center justify-center rounded-lg px-4 text-[13px] transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: "#C81E1E", color: "#EDE8E0", fontWeight: 600 }}
            >
              {submitting ? "Logging override…" : "Log override & continue"}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
