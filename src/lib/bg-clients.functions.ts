import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Clients, engagements, Hub id mappings and run linking. Admin-only.
// Runs are never matched to clients by brand name: links come from Hub tags
// (resolved in the database), inheritance from a source run, or an admin
// linking one run at a time here.

export const RUN_TABLES = [
  { table: "synthesiser_runs", room: "Room 00 · Research Synthesiser", idCol: "id" },
  { table: "intelligence_sessions", room: "Room 01 · Intelligence Lab", idCol: "id" },
  { table: "briefing_room_workspaces", room: "Room 02 · Briefing Room", idCol: "id" },
  { table: "saved_briefs", room: "Saved brief", idCol: "brief_id" },
  { table: "sessions", room: "Room 03 · Strategy Pipeline", idCol: "id" },
  { table: "stimulus_runs", room: "Room 04 · Creative Engine", idCol: "id" },
] as const;
type RunTable = (typeof RUN_TABLES)[number]["table"];
const RunTableEnum = z.enum(RUN_TABLES.map((t) => t.table) as [RunTable, ...RunTable[]]);

type Ctx = { supabase: any; userId: string };

async function assertAdmin(context: Ctx) {
  const { data, error } = await context.supabase.rpc("bg_is_admin", { _uid: context.userId });
  if (error || data !== true) throw new Error("Unauthorized");
}

export const getLinkingOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as Ctx);
    const sb = (context as Ctx).supabase;
    const [clients, engagements, mappings] = await Promise.all([
      sb.from("bg_clients").select("id, name, notes, created_at").order("name"),
      sb.from("bg_engagements").select("id, bg_client_id, name, created_at").order("name"),
      sb.from("bg_external_ids").select("id, bg_client_id, engagement_id, system, external_id, created_at").order("created_at"),
    ]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const runs: Array<{ table: RunTable; room: string; id: string; brand: string; status: string | null; created_at: string; link_status: string }> = [];
    const counts: Record<string, { linked: number; unlinked: number; legacy: number }> = {};
    for (const t of RUN_TABLES) {
      const c = { linked: 0, unlinked: 0, legacy: 0 };
      for (const s of ["linked", "unlinked", "legacy"] as const) {
        const { count } = await (supabaseAdmin as any).from(t.table).select(t.idCol, { count: "exact", head: true }).eq("link_status", s);
        c[s] = count ?? 0;
      }
      counts[t.room] = c;
      const statusCol = t.table === "saved_briefs" ? "" : ", status";
      const { data } = await (supabaseAdmin as any)
        .from(t.table)
        .select(`${t.idCol}, brand_name, created_at, link_status${statusCol}`)
        .in("link_status", ["unlinked", "legacy"])
        .order("created_at", { ascending: false })
        .limit(200);
      for (const r of data ?? []) {
        runs.push({
          table: t.table,
          room: t.room,
          id: r[t.idCol],
          brand: r.brand_name ?? "",
          status: r.status ?? null,
          created_at: r.created_at,
          link_status: r.link_status,
        });
      }
    }
    runs.sort((a, b) => b.created_at.localeCompare(a.created_at));
    return {
      clients: clients.data ?? [],
      engagements: engagements.data ?? [],
      mappings: mappings.data ?? [],
      runs,
      counts,
    };
  });

export const createBgClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ name: z.string().trim().min(1).max(200), notes: z.string().max(2000).optional() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    const { data: row, error } = await (context as Ctx).supabase
      .from("bg_clients")
      .insert({ name: data.name, notes: data.notes ?? null })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

export const createBgEngagement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ clientId: z.string().uuid(), name: z.string().trim().min(1).max(200) }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    const { data: row, error } = await (context as Ctx).supabase
      .from("bg_engagements")
      .insert({ bg_client_id: data.clientId, name: data.name })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

export const createBgMapping = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        clientId: z.string().uuid(),
        engagementId: z.string().uuid().nullable(),
        system: z.enum(["hub_client", "hub_job"]),
        externalId: z.string().trim().min(1).max(200),
      })
      .refine((v) => v.system !== "hub_job" || v.engagementId, { message: "A Hub job maps to an engagement" })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    const { error } = await (context as Ctx).supabase.from("bg_external_ids").insert({
      bg_client_id: data.clientId,
      engagement_id: data.system === "hub_job" ? data.engagementId : null,
      system: data.system,
      external_id: data.externalId,
    });
    if (error) {
      if (error.code === "23505") throw new Error("That Hub id, or this client's Hub link, is already mapped.");
      throw new Error(error.message);
    }
    return { ok: true };
  });

export const linkRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ table: RunTableEnum, runId: z.string().uuid(), clientId: z.string().uuid(), engagementId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    const { data: status, error } = await (context as Ctx).supabase.rpc("bg_admin_link_run", {
      _table: data.table,
      _run_id: data.runId,
      _client: data.clientId,
      _engagement: data.engagementId,
    });
    if (error) throw new Error(error.message);
    return { status: status as string };
  });
