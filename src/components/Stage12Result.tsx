import { RATIONALE_FIELDS } from "@/lib/selection-rationale";
import { Button } from "@/components/ui/button";

export function Stage12Result({ smp, fieldName, rationale, onEdit }: {
  smp: string; fieldName?: string | null; rationale: Record<string, string> | null;
  onEdit?: () => void;
}) {
  return <div className="space-y-8">
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
      {onEdit && <Button variant="outline" onClick={onEdit}>Review selection rationale</Button>}
    </section>
  </div>;
}