import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Share2, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  addSessionCollaborator,
  listSessionCollaborators,
  removeSessionCollaborator,
  type Collaborator,
} from "@/lib/session-share.functions";

export function SessionSharePopover({ sessionId }: { sessionId: string | undefined }) {
  const listFn = useServerFn(listSessionCollaborators);
  const addFn = useServerFn(addSessionCollaborator);
  const removeFn = useServerFn(removeSessionCollaborator);

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [people, setPeople] = useState<Collaborator[]>([]);
  const [email, setEmail] = useState("");

  useEffect(() => {
    if (!open || !sessionId) return;
    let active = true;
    setLoading(true);
    listFn({ data: { sessionId } })
      .then((r) => {
        if (!active) return;
        setPeople(r.collaborators);
        setIsOwner(r.isOwner);
      })
      .catch((e: unknown) =>
        toast.error(e instanceof Error ? e.message : "Could not load access list"),
      )
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [open, sessionId, listFn]);

  if (!sessionId) return null;

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    if (!sessionId || !email.trim()) return;
    setSaving(true);
    try {
      const { collaborator } = await addFn({
        data: { sessionId, email: email.trim() },
      });
      setPeople((p) => [...p.filter((x) => x.email !== collaborator.email), collaborator]);
      setEmail("");
      toast.success(`${collaborator.email} now has access`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add collaborator");
    } finally {
      setSaving(false);
    }
  }

  async function revoke(id: string) {
    if (!sessionId) return;
    const prev = people;
    setPeople((p) => p.filter((x) => x.id !== id));
    try {
      await removeFn({ data: { sessionId, id } });
    } catch (err) {
      setPeople(prev);
      toast.error(err instanceof Error ? err.message : "Could not remove collaborator");
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Share2 className="h-3.5 w-3.5" /> Share
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[320px]">
        <p className="text-label text-text-secondary">Session access</p>
        <p className="text-caption mt-1 text-text-secondary">
          Anyone added here can view and edit this session in real time.
        </p>

        {isOwner && (
          <form onSubmit={invite} className="mt-3 flex gap-2">
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              className="h-8 text-sm"
            />
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Add"}
            </Button>
          </form>
        )}

        <div className="mt-3 space-y-1.5">
          {loading && <p className="text-caption text-text-secondary">Loading…</p>}
          {!loading && people.length === 0 && (
            <p className="text-caption text-text-secondary">
              No one else has access yet.
            </p>
          )}
          {people.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between gap-2 rounded-md border border-border px-2 py-1.5"
            >
              <div className="min-w-0">
                <p className="truncate text-sm text-text-primary">{p.email}</p>
                <p className="text-caption text-text-secondary">
                  {p.claimedAt ? "Active" : "Invited — pending first sign-in"}
                </p>
              </div>
              {isOwner && (
                <button
                  type="button"
                  aria-label={`Remove ${p.email}`}
                  onClick={() => void revoke(p.id)}
                  className="text-text-secondary hover:text-text-primary"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
