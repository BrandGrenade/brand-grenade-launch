// Partner Hub delivery. Reads HUB_INGEST_URL / HUB_INGEST_KEY at call time;
// neither value is ever returned, logged, or sent to the browser.

const RETRY_MINUTES = [1, 5, 30]; // then hourly
const MAX_ATTEMPTS = 10;

export function hubConfig() {
  const url = process.env["HUB_INGEST_URL"];
  const key = process.env["HUB_INGEST_KEY"];
  return { url, key, urlSet: Boolean(url), keySet: Boolean(key) };
}

export async function postToHub(payload: unknown): Promise<{ ok: boolean; status: number; body: string }> {
  const { url, key } = hubConfig();
  if (!url || !key) return { ok: false, status: 0, body: "Hub connection not configured" };
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(20000),
    });
    const body = (await res.text()).slice(0, 2000);
    return { ok: res.ok, status: res.status, body };
  } catch (e) {
    return { ok: false, status: 0, body: e instanceof Error ? e.message : "Network error" };
  }
}

export async function drainHubOutbox(limit = 25) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const cfg = hubConfig();
  if (!cfg.urlSet || !cfg.keySet) {
    // Leave items pending; stop the retry tick until the key is added (the
    // admin "Retry failed" button or the next queued item wakes it again).
    await supabaseAdmin.rpc("hub_disarm_if_drained" as never, { _force: true } as never);
    return { sent: 0, failed: 0, retried: 0, configured: false };
  }

  const now = new Date();
  const { data: rows } = await supabaseAdmin
    .from("hub_outbox")
    .select("id, payload, attempts, next_attempt_at")
    .eq("status", "pending")
    .lte("next_attempt_at", now.toISOString())
    .order("created_at", { ascending: true })
    .limit(limit);

  let sent = 0, failed = 0, retried = 0;
  for (const row of rows ?? []) {
    // Claim: push next_attempt_at forward only if nobody else has.
    const { data: claimed } = await supabaseAdmin
      .from("hub_outbox")
      .update({ next_attempt_at: new Date(Date.now() + 5 * 60_000).toISOString() })
      .eq("id", row.id)
      .eq("status", "pending")
      .eq("next_attempt_at", row.next_attempt_at)
      .select("id");
    if (!claimed?.length) continue;

    const r = await postToHub(row.payload);
    const attempts = row.attempts + 1;
    if (r.ok) {
      await supabaseAdmin.from("hub_outbox")
        .update({ status: "sent", attempts, sent_at: new Date().toISOString(), last_error: null })
        .eq("id", row.id);
      sent++;
    } else if ((r.status >= 400 && r.status < 500) || attempts >= MAX_ATTEMPTS) {
      await supabaseAdmin.from("hub_outbox")
        .update({ status: "failed", attempts, last_error: `${r.status || "network"}: ${r.body}`.slice(0, 2000) })
        .eq("id", row.id);
      failed++;
    } else {
      const mins = RETRY_MINUTES[attempts - 1] ?? 60;
      await supabaseAdmin.from("hub_outbox")
        .update({
          attempts,
          last_error: `${r.status || "network"}: ${r.body}`.slice(0, 2000),
          next_attempt_at: new Date(Date.now() + mins * 60_000).toISOString(),
        })
        .eq("id", row.id);
      retried++;
    }
  }
  await supabaseAdmin.rpc("hub_disarm_if_drained" as never);
  return { sent, failed, retried, configured: true };
}
