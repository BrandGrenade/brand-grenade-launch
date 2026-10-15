import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Admin-only: create (shown once), list and revoke access keys; read the request log.
type Ctx = { supabase: any; userId: string };
async function assertAdmin(context: Ctx) {
  const { data, error } = await context.supabase.rpc("bg_is_admin", { _uid: context.userId });
  if (error || data !== true) throw new Error("Unauthorized");
}

export const listAccessKeys = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as Ctx);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;
    const [keys, log] = await Promise.all([
      sb.from("bg_access_keys").select("id, scope, label, created_at, revoked_at").order("created_at", { ascending: false }),
      sb.from("bg_access_log").select("request_id, scope, key_id, client_ref, run_id, request, output_id, outcome, error_code, created_at").order("created_at", { ascending: false }).limit(200),
    ]);
    return { keys: keys.data ?? [], log: log.data ?? [] };
  });

export const createAccessKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ scope: z.enum(["hub_tools", "second_brain", "admin"]), label: z.string().trim().min(1).max(200) }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    const { sha256Hex } = await import("./access.server");
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const key = "bgk_" + btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).from("bg_access_keys").insert({
      scope: data.scope,
      label: data.label,
      key_hash: await sha256Hex(key),
      created_by: (context as Ctx).userId,
    });
    if (error) throw new Error(error.message);
    return { key }; // shown once; only the hash is stored
  });

export const revokeAccessKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await (supabaseAdmin as any)
      .from("bg_access_keys").update({ revoked_at: new Date().toISOString() }).eq("id", data.id).is("revoked_at", null).select("id").maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Key not found or already revoked.");
    return { ok: true };
  });
