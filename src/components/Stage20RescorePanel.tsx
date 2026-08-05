import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { rescoreStage20FromExisting } from "@/lib/stage20.functions";

type ScoreResult = Awaited<ReturnType<typeof rescoreStage20FromExisting>>;

export function Stage20RescorePanel() {
  const rescore = useServerFn(rescoreStage20FromExisting);
  const [sessionId, setSessionId] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<ScoreResult | null>(null);

  async function run() {
    setBusy(true);
    setErr(null);
    setResult(null);
    try {
      const r = await rescore({ data: { sessionId: sessionId.trim() } });
      setResult(r);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const s = result?.score;
  return (
    <section
      className="mt-10 rounded border border-white/10 p-6"
      style={{ background: "rgba(255,255,255,0.02)" }}
    >
      <h2 className="text-h3 text-text-primary">Stage 20 — Re-score existing brief</h2>
      <p className="text-body mt-2 text-text-secondary">
        Runs the independent scorer against the SAVED <code>stage_20_output</code>. Does not
        regenerate the brief. Writes the new BRIEF QUALITY SCORE block back.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <input
          value={sessionId}
          onChange={(e) => setSessionId(e.target.value)}
          placeholder="session UUID"
          className="min-w-[340px] flex-1 rounded border border-white/10 bg-black/40 px-3 py-2 text-body text-text-primary"
        />
        <button
          onClick={run}
          disabled={busy || !sessionId.trim()}
          className="rounded px-4 py-2 text-label text-black disabled:opacity-50"
          style={{ background: "#C81E1E" }}
        >
          {busy ? "Scoring…" : "Re-score"}
        </button>
      </div>
      {err && <p className="mt-3 text-body text-red-400">{err}</p>}
      {s && result && (
        <div className="mt-5 space-y-2 text-body text-text-primary">
          <div className="text-label text-text-secondary">
            {result.brandName ?? "(no brand)"} · {result.sessionId}
          </div>
          <div>Emotional Clarity: {s.emotional_clarity}/10</div>
          <div>Fame Invitation: {s.fame_invitation}/10</div>
          <div>Distinctive Asset Integration: {s.distinctive_asset_integration}/10</div>
          <div>Psychological Leverage: {s.psychological_leverage}/10</div>
          <div>Creative SoV Ambition: {s.creative_sov_ambition}/10</div>
          <div className="pt-2 text-h4">
            COMPOSITE: {s.composite}/50 · {s.status}
          </div>
          {result.failing.length > 0 && (
            <ul className="mt-3 list-disc pl-5 text-text-secondary">
              {result.failing.map((f, i) => (
                <li key={i}>
                  <strong>{f.dimension}:</strong> {f.instruction}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
