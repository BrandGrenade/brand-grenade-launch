import { useEffect, useState } from "react";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import { getSupervisionState, type SupervisionState } from "@/lib/reliability.functions";

/**
 * Surfaces what the platform reliability layer is doing about a run:
 * silent while automatic recovery still has attempts left, loud only once
 * recovery is exhausted and a human is genuinely needed.
 */
export function SupervisionStatus({
  domain,
  jobId,
  className = "",
}: {
  domain: string;
  jobId: string;
  className?: string;
}) {
  const [state, setState] = useState<SupervisionState>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const s = await getSupervisionState({ data: { domain, jobId } });
        if (active) setState(s);
      } catch {
        /* non-critical */
      }
    };
    void load();
    const t = setInterval(load, 15_000);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, [domain, jobId]);

  if (!state || state.state === "cleared") return null;

  if (state.needsHuman) {
    return (
      <div
        className={`mt-4 rounded-md border border-destructive/40 bg-destructive/5 p-4 ${className}`}
      >
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-destructive" />
          <div>
            <p className="text-sm font-semibold text-text-primary">
              This needs a human — automatic recovery is exhausted
            </p>
            <p className="mt-1 text-sm text-text-secondary">
              The system detected the stall and retried {state.attempts} time
              {state.attempts === 1 ? "" : "s"} on its own before stopping.
            </p>
            {state.lastError ? (
              <p className="mt-2 text-xs font-mono text-text-secondary break-words">
                {state.lastError}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  if (state.attempts > 0) {
    return (
      <div className={`mt-4 rounded-md border border-border bg-card/40 p-4 ${className}`}>
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-text-secondary" />
          <div>
            <p className="text-sm font-medium text-text-primary">
              Stall detected — recovering automatically
            </p>
            <p className="mt-1 text-sm text-text-secondary">
              Attempt {state.attempts} of {state.maxAttempts}. No action needed; you will only be
              asked to step in if every attempt fails.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
