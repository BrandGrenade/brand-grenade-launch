import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { getValidateJobs, queueValidateBaseline } from "@/lib/validate.functions";
import { COMPARATOR_NOTE } from "@/lib/validate-run";

type Job = { id: string; status: string; entry_path: string; completed_stages: string[]; error_code: string | null; error_message: string | null; subject_brand: string | null; published_version: number | null };
type Assessment = { id: string; run_version: number; assessment_revision: number; subject_brand: string; entry_path: string; outputs: Record<string, { data?: Record<string, unknown> }> };

/** Saved Validate outputs. Comparators are evidence only, never recommendations. */
export function ValidateOutputs({ outputs }: { outputs: Assessment["outputs"] }) {
  const verdict = outputs["validate.verdict"]?.data as { verdict?: string; reasons?: { code: string }[] } | undefined;
  const comp = (outputs["validate.evidence_gaps"]?.data?.comparators ?? null) as { items?: { smp: string; composite: number }[]; best_alternative_composite?: number | null } | null;
  return (
    <section className="mt-4">
      <h3 className="text-h2">Verdict on the current strategy: {verdict?.verdict ?? "—"}</h3>
      <ul className="mt-2 list-disc pl-5 text-sm text-muted-foreground">{(verdict?.reasons ?? []).map((r, i) => <li key={i}>{r.code}</li>)}</ul>
      {comp?.items?.length ? (
        <details className="mt-4 border-b border-border py-3">
          <summary className="cursor-pointer text-sm font-semibold">Comparators (evidence only) — best {comp.best_alternative_composite}/90</summary>
          <p className="mt-2 text-xs text-muted-foreground">{COMPARATOR_NOTE}</p>
          <ul className="mt-2 text-xs">{comp.items.map((c, i) => <li key={i}>Comparator · {c.composite}/90 · {c.smp}</li>)}</ul>
        </details>
      ) : null}
      {Object.entries(outputs).map(([id, content]) => (
        <details key={id} className="border-b border-border py-3"><summary className="cursor-pointer text-sm font-semibold">{id}</summary>
          <pre className="mt-3 whitespace-pre-wrap break-words text-xs text-muted-foreground">{JSON.stringify(content, null, 2)}</pre></details>
      ))}
    </section>
  );
}

export function ValidateRunStatus({ sessionId, poll = true, onAssessment }: { sessionId: string; poll?: boolean; onAssessment?: (done: boolean) => void }) {
  const read = useServerFn(getValidateJobs);
  const [state, setState] = useState<{ jobs: Job[]; assessments: Assessment[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    const tick = async () => {
      try { const r = await read({ data: { sessionId } }); if (live) { const a = JSON.parse(r.assessments) as Assessment[]; setState({ jobs: JSON.parse(r.jobs), assessments: a }); onAssessment?.(a.length > 0); } }
      catch (e) { if (live) setError(e instanceof Error ? e.message : String(e)); }
    };
    void tick();
    const t = poll ? setInterval(() => void tick(), 8000) : null;
    return () => { live = false; if (t) clearInterval(t); };
  }, [sessionId, poll, read]);
  if (error) return <p role="alert" className="text-destructive">{error}</p>;
  if (!state) return <p className="text-sm text-muted-foreground">Loading Validate status…</p>;
  const latest = state.assessments[state.assessments.length - 1];
  return (
    <div>
      {state.jobs.map((j) => (
        <p key={j.id} className="text-sm">Current-position assessment ({j.subject_brand}): {j.status} · stages saved {j.completed_stages.join(", ") || "none"}/10, 11, 13
          {j.error_code ? <span className="text-destructive"> · {j.error_code}: {j.error_message}</span> : null}</p>
      ))}
      {!state.jobs.length && <p className="text-sm text-muted-foreground">No current-position assessment queued yet. It starts automatically when Stage 13 locks the run.</p>}
      {latest ? <ValidateOutputs outputs={latest.outputs} /> : null}
    </div>
  );
}

export function AddonQueueForm({ sessionId, version, brand }: { sessionId: string; version: number; brand: string }) {
  const queue = useServerFn(queueValidateBaseline);
  const [f, setF] = useState({ proposition: "", derivationLabel: "BG-derived" as "BG-derived" | "Client-supplied" | "Owner-stated (public)", source: "", sourceDate: "", suppliedBy: "", sourceQuote: "" });
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ok = sessionId && brand.trim() && f.proposition.trim() && f.source.trim() && f.suppliedBy.trim();
  async function go() {
    setBusy(true); setMsg(null);
    try { const r = await queue({ data: { sessionId, version, subjectBrand: brand, ...f, sourceDate: f.sourceDate || null, sourceQuote: f.sourceQuote.trim() || undefined } }); setMsg(`Queued assessment ${r.jobId}. It runs in the background; reload to see progress.`); }
    catch (e) { setMsg(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  }
  return (
    <details className="mt-6 border-b border-border py-3">
      <summary className="cursor-pointer text-sm font-semibold">Run a current-position assessment for this brand</summary>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-sm">Current proposition<textarea aria-label="Current proposition to assess" className="input-base mt-2 w-full" rows={2} value={f.proposition} onChange={(e) => setF({ ...f, proposition: e.target.value })} /></label>
        <label className="text-sm">Who supplied it<select aria-label="Who supplied it" className="input-base mt-2 w-full" value={f.derivationLabel} onChange={(e) => setF({ ...f, derivationLabel: e.target.value as typeof f.derivationLabel })}><option value="BG-derived">BG-derived from saved research</option><option value="Client-supplied">Client-supplied</option><option value="Owner-stated (public)">Owner-stated (public) — needs source, date and quote</option></select></label>
        {f.derivationLabel === "Owner-stated (public)" && <label className="text-sm sm:col-span-2">Quote from the owner's published statement<textarea aria-label="Owner-stated quote" className="input-base mt-2 w-full" rows={2} value={f.sourceQuote} onChange={(e) => setF({ ...f, sourceQuote: e.target.value })} /></label>}
        <label className="text-sm">Source<input aria-label="Proposition source" className="input-base mt-2 w-full" value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })} /></label>
        <label className="text-sm">Source date<input aria-label="Proposition source date" type="date" className="input-base mt-2 w-full" value={f.sourceDate} onChange={(e) => setF({ ...f, sourceDate: e.target.value })} /></label>
        <label className="text-sm">Supplied by<input aria-label="Supplied by" className="input-base mt-2 w-full" value={f.suppliedBy} onChange={(e) => setF({ ...f, suppliedBy: e.target.value })} /></label>
      </div>
      <Button className="mt-3" disabled={!ok || busy} onClick={() => void go()}>{busy ? "Queuing…" : "Queue assessment"}</Button>
      {msg && <p className="mt-2 text-sm">{msg}</p>}
    </details>
  );
}
