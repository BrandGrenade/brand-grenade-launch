import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Pencil, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { saveManualIdeaEdit } from "@/lib/stimulus-manual-edit.functions";

export function ManualIdeaEdit({ idea, disabled, onSaved }: {
  idea: { id: string; direction: string; campaign_line: string | null; expression_under_master: string | null; active_attempt_id?: string | null };
  disabled?: boolean;
  onSaved: () => Promise<void>;
}) {
  const save = useServerFn(saveManualIdeaEdit);
  const [editing, setEditing] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState({ description: "", field1: "", field2: "", expectedAttemptId: null as string | null });

  if (!editing) return <Button variant="outline" size="sm" disabled={disabled} onClick={() => {
    setDraft({ description: idea.direction, field1: idea.campaign_line ?? "", field2: idea.expression_under_master ?? "", expectedAttemptId: idea.active_attempt_id ?? null });
    setError(null);
    setEditing(true);
  }}><Pencil />Edit by hand</Button>;

  return <form className="mt-3 w-full space-y-3 text-foreground" aria-label="Manual idea edit" onSubmit={async (event) => {
    event.preventDefault();
    setWorking(true);
    setError(null);
    try {
      await save({ data: { directionId: idea.id, ...draft } });
      await onSaved();
      setEditing(false);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not save the edit");
    } finally { setWorking(false); }
  }}>
    {(["description", "field1", "field2"] as const).map((field) => <label key={field} className="block space-y-1 text-sm">
      <span>{field === "description" ? "Description" : field === "field1" ? "Field 1 · Master line" : "Field 2 · Expression line"}</span>
      <Textarea aria-label={field === "description" ? "Description" : field === "field1" ? "Field 1" : "Field 2"} rows={field === "description" ? 8 : 3} value={draft[field]} disabled={working} onChange={(event) => setDraft((previous) => ({ ...previous, [field]: event.target.value }))} />
    </label>)}
    <div className="flex flex-wrap gap-2">
      <Button type="submit" size="sm" disabled={working || !draft.description.trim()}><Save />{working ? "Saving…" : "Save new version"}</Button>
      <Button type="button" variant="ghost" size="sm" disabled={working} onClick={() => setEditing(false)}><X />Cancel</Button>
    </div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </form>;
}