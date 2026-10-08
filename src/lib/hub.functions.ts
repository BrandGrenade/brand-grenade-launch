import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const HubTable = z.enum(["sessions", "intelligence_sessions", "briefing_room_workspaces", "synthesiser_runs"]);
const Hub = z.object({
  client: z.string().min(1).max(200),
  job: z.string().max(200).nullable(),
  ctx: z.string().max(2000).nullable(),
});

/** Attach the hub client/job to a record the user owns, if not already linked. */
export const stampHubContext = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ table: HubTable, id: z.string().uuid(), hub: Hub }).parse(i))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as unknown as {
      from: (t: string) => {
        update: (p: Record<string, unknown>) => { eq: (c: string, v: string) => { is: (c: string, v: null) => Promise<{ error: { message: string } | null }> } };
      };
    };
    const { error } = await sb
      .from(data.table)
      .update({ hub_client: data.hub.client, hub_job: data.hub.job, hub_ctx: data.hub.ctx })
      .eq("id", data.id)
      .is("hub_client", null);
    return { ok: !error };
  });

/** Most recent record already produced for this hub client + job in a Room. */
export const findPriorHubWork = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ table: HubTable, client: z.string().max(200), job: z.string().max(200).nullable(), excludeId: z.string().nullable() }).parse(i))
  .handler(async ({ data, context }) => {
    let q = (context.supabase as any)
      .from(data.table)
      .select("id, created_at")
      .eq("hub_client", data.client)
      .order("created_at", { ascending: false })
      .limit(2);
    q = data.job ? q.eq("hub_job", data.job) : q.is("hub_job", null);
    const { data: rows } = await q;
    const row = (rows ?? []).find((r: { id: string }) => r.id !== data.excludeId);
    return row ? { id: row.id as string, created_at: row.created_at as string } : null;
  });

/** Queue an "exported" event when a linked document is downloaded. */
export const recordHubExport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ hub: Hub, room: z.enum(["room-00", "room-01", "room-02", "room-03", "room-04"]), title: z.string().min(1).max(200) }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const actor = typeof context.claims.email === "string" ? context.claims.email.slice(0, 120) : undefined;
    await supabaseAdmin.from("hub_outbox").insert({
      hub_client: data.hub.client,
      hub_job: data.hub.job,
      payload: {
        client_ref: data.hub.client,
        ...(data.hub.job ? { job_ref: data.hub.job } : {}),
        room: data.room,
        event_type: "exported",
        title: data.title,
        ...(actor ? { actor } : {}),
        occurred_at: new Date().toISOString(),
      },
    });
    await supabaseAdmin.rpc("hub_wake" as never);
    return { ok: true };
  });

async function assertAdmin(context: { supabase: any; claims: Record<string, unknown> }) {
  const email = typeof context.claims.email === "string" ? context.claims.email : undefined;
  if (!email) throw new Error("Unauthorized");
  const { data } = await context.supabase.from("users").select("id").eq("email", email).eq("is_admin", true).maybeSingle();
  if (!data) throw new Error("Unauthorized");
}

export const getHubAdminStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as any);
    const { hubConfig } = await import("./hub.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const cfg = hubConfig();
    const count = async (s: string) =>
      (await supabaseAdmin.from("hub_outbox").select("id", { count: "exact", head: true }).eq("status", s)).count ?? 0;
    const [sent, pending, failed] = await Promise.all([count("sent"), count("pending"), count("failed")]);
    const { data: rows } = await supabaseAdmin
      .from("hub_outbox")
      .select("id, hub_client, hub_job, payload, status, attempts, last_error, created_at, sent_at")
      .order("created_at", { ascending: false })
      .limit(50);
    const { data: lastDoc } = await supabaseAdmin
      .from("hub_outbox")
      .select("payload, sent_at, doc_bytes, doc_delivery, last_error")
      .eq("status", "sent")
      .not("doc_delivery", "is", null)
      .order("sent_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return { urlSet: cfg.urlSet, keySet: cfg.keySet, sent, pending, failed, rows: rows ?? [], lastDoc: lastDoc ?? null };
  });

export const retryFailedHub = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("hub_outbox")
      .update({ status: "pending", attempts: 0, next_attempt_at: new Date().toISOString() })
      .eq("status", "failed")
      .select("id");
    await supabaseAdmin.rpc("hub_wake" as never);
    return { requeued: data?.length ?? 0 };
  });

export const sendHubConnectionTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ clientRef: z.string().min(1).max(200) }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const { postToHub } = await import("./hub.server");
    const r = await postToHub({
      client_ref: data.clientRef,
      room: "room-01",
      event_type: "run_completed",
      title: "Connection test",
      occurred_at: new Date().toISOString(),
    });
    return { status: r.status, ok: r.ok, body: r.body };
  });
