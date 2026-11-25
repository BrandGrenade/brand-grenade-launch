import { RATIONALE_FIELDS } from "@/lib/selection-rationale";
import { Button } from "@/components/ui/button";

export type SelectionVersion = { version_no: number; selected_smp: string | null; selection_source: string | null; stage_13_verdict: string | null; superseded_at: string };

export function Stage12Result({ smp, fieldName, rationale, onEdit, onContinue, onChooseAgain, chooseAgainNote, history }: {
  smp: string; fieldName?: string | null; rationale: Record<string, string> | null;
  onEdit?: () => void;
  onContinue?: () => void;
  /** Present when the run is before its final checkpoint: reopen the full proposition set. */
  onChooseAgain?: () => void;
  /** Plain-words reason when choosing again is not available. */
  chooseAgainNote?: string | null;
  history?: SelectionVersion[];
}) {
  return <div className="space-y-8 pb-20">
    <header>
      <span className="text-label text-text-secondary">Stage 12 — Proposition Selection</span>
      <h1 className="text-h2 mt-3 text-text-primary">Selection confirmed</h1>
      <p className="text-h3 mt-6 text-text-primary">{smp}</p>
      {fieldName && <p className="mt-2 text-text-secondary">{fieldName}</p>}
    </header>
    <section className="space-y-6 border-t border-border pt-6">
      <h2 className="text-h3 text-text-primary">Deliverable 3 — Selection rationale</h2>
      {rationale ? RATIONALE_FIELDS.map((f) => <div key={f.key}>
        <h3 className="font-semibold text-text-primary">{f.label}</h3>
        <p className="mt-2 whitespace-pre-wrap text-text-secondary">{rationale[f.key] || "Not supplied"}</p>
      </div>) : <p className="text-destructive">The selection is saved, but the rationale has not been saved.</p>}
      {rationale?.f_loc_legacy && <p className="whitespace-pre-wrap text-text-secondary">{rationale.f_loc_legacy}</p>}
      <div className="flex flex-wrap gap-3">
        {onContinue && <Button onClick={onContinue}>Continue to Brand Fit Validation →</Button>}
        {onEdit && <Button variant="outline" onClick={onEdit}>Review selection rationale</Button>}
        {onChooseAgain && <Button variant="outline" onClick={onChooseAgain}>Choose again from the full set</Button>}
      </div>
      {!onChooseAgain && chooseAgainNote && <p className="text-body-sm text-text-secondary">{chooseAgainNote}</p>}
    </section>
    {history && history.length > 0 && <section className="space-y-3 border-t border-border pt-6">
      <h2 className="text-h3 text-text-primary">Earlier selections (kept)</h2>
      <ul className="space-y-2">
        {history.map((h) => <li key={h.version_no} className="text-body-sm text-text-secondary">
          <span className="font-semibold text-text-primary">Version {h.version_no}</span> · {h.selected_smp ?? "—"} ({h.selection_source ?? "CORE"}) · Stage 13 verdict: {h.stage_13_verdict ?? "not recorded"} · replaced {new Date(h.superseded_at).toLocaleString()}
        </li>)}
      </ul>
    </section>}
  </div>;
}
