// Optional client/engagement picker for run-start forms. Choosing a client
// links the new run at creation (database-enforced, own runs only); leaving
// it blank keeps the run unlinked, exactly as before.

import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getClientOptions, type ClientOption } from "@/lib/bg-clients.functions";
import { useIsAdmin } from "@/lib/demo-mode";
import { onHubContextChange, readHubContext } from "@/lib/hub/context";

export type ClientLink = { clientId: string; engagementId: string } | null;

const selectCls = "h-9 rounded-md border border-input bg-background px-2 text-body-sm text-text-primary";

export function ClientPicker({ value, onChange }: { value: ClientLink; onChange: (v: ClientLink) => void }) {
  const fetchOptions = useServerFn(getClientOptions);
  const [options, setOptions] = useState<ClientOption[]>([]);
  const isAdmin = useIsAdmin();
  const [fromHub, setFromHub] = useState(false);

  useEffect(() => {
    if (isAdmin) void fetchOptions().then(setOptions).catch(() => setOptions([]));
  }, [fetchOptions, isAdmin]);
  useEffect(() => {
    const refresh = () => setFromHub(!!readHubContext());
    refresh();
    return onHubContextChange(refresh);
  }, []);

  const clients = useMemo(() => {
    const m = new Map<string, string>();
    for (const o of options) m.set(o.client_id, o.client_name);
    return [...m.entries()].map(([id, name]) => ({ id, name }));
  }, [options]);
  const engagements = useMemo(
    () => options.filter((o) => o.client_id === value?.clientId && o.engagement_id),
    [options, value?.clientId],
  );

  if (!isAdmin || fromHub || clients.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-label text-text-secondary">Client (optional)</span>
      <div className="flex flex-wrap gap-2">
        <select
          className={selectCls}
          value={value?.clientId ?? ""}
          onChange={(e) => onChange(e.target.value ? { clientId: e.target.value, engagementId: "" } : null)}
          aria-label="Client"
        >
          <option value="">No client link</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        {value ? (
          <select
            className={selectCls}
            value={value.engagementId}
            onChange={(e) => onChange({ clientId: value.clientId, engagementId: e.target.value })}
            aria-label="Engagement"
          >
            <option value="">Engagement…</option>
            {engagements.map((e) => (
              <option key={e.engagement_id} value={e.engagement_id ?? ""}>{e.engagement_name}</option>
            ))}
          </select>
        ) : null}
      </div>
      {value && !value.engagementId ? (
        <span className="text-body-sm text-text-tertiary">Pick an engagement to link this run.</span>
      ) : null}
    </div>
  );
}
