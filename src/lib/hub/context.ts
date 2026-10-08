// Partner Hub context: the hub opens a Room with ?client=&job=&ctx=.
// Kept in session storage for the browser tab. ctx is opaque: never shown,
// never used for authentication.

export type HubContext = { client: string; job: string | null; ctx: string | null };

const KEY = "bg_hub_context";
const EVT = "bg-hub-context";

export function captureHubContextFromUrl(): void {
  if (typeof window === "undefined") return;
  const p = new URLSearchParams(window.location.search);
  const client = p.get("client")?.trim();
  if (!client) return;
  const next: HubContext = {
    client: client.slice(0, 200),
    job: p.get("job")?.trim().slice(0, 200) || null,
    ctx: p.get("ctx")?.slice(0, 2000) || null,
  };
  sessionStorage.setItem(KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(EVT));
}

export function readHubContext(): HubContext | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as HubContext;
    return v?.client ? v : null;
  } catch {
    return null;
  }
}

export function clearHubContext(): void {
  sessionStorage.removeItem(KEY);
  window.dispatchEvent(new Event(EVT));
}

export function onHubContextChange(fn: () => void): () => void {
  window.addEventListener(EVT, fn);
  return () => window.removeEventListener(EVT, fn);
}

/** Columns to attach to any record created while a hub context is active. */
export function hubColumns(): { hub_client?: string; hub_job?: string | null; hub_ctx?: string | null } {
  const h = readHubContext();
  return h ? { hub_client: h.client, hub_job: h.job, hub_ctx: h.ctx } : {};
}
