import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const deleteBrandPermanently = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        brandKey: z.string().min(1),
        brandName: z.string().min(1),
        sessionIds: z.array(z.string().uuid()).default([]),
        workspaceIds: z.array(z.string().uuid()).default([]),
        savedBriefIds: z.array(z.string().uuid()).default([]),
        intelligenceIds: z.array(z.string().uuid()).default([]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const normalizeBrand = (name: string | null | undefined): string => {
      if (!name) return "";
      return name
        .trim()
        .toLowerCase()
        .replace(/[\u2018\u2019\u201C\u201D]/g, "'")
        .replace(/[^a-z0-9]+/g, " ")
        .trim()
        .replace(/\s+/g, "-");
    };

    const targetKey = data.brandKey || normalizeBrand(data.brandName);
    if (!targetKey) throw new Error("Brand name is required for deletion");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId!;

    const [sessionsRes, workspacesRes, briefsRes, intelRes] = await Promise.all([
      supabaseAdmin
        .from("sessions")
        .select("id, brand_name")
        .eq("user_id", userId),
      supabaseAdmin
        .from("briefing_room_workspaces")
        .select("id, brand_name")
        .eq("user_id", userId),
      supabaseAdmin
        .from("saved_briefs")
        .select("brief_id, brand_name")
        .eq("user_id", userId),
      supabaseAdmin
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from("intelligence_sessions" as any)
        .select("id, brand_name")
        .eq("user_id", userId),
    ]);

    const firstError =
      sessionsRes.error ?? workspacesRes.error ?? briefsRes.error ?? intelRes.error;
    if (firstError) throw new Error(firstError.message);

    const matchingSessionIds = new Set(data.sessionIds);
    for (const row of sessionsRes.data ?? []) {
      if (normalizeBrand(row.brand_name) === targetKey) matchingSessionIds.add(row.id);
    }

    const matchingWorkspaceIds = new Set(data.workspaceIds);
    for (const row of workspacesRes.data ?? []) {
      if (normalizeBrand(row.brand_name) === targetKey) matchingWorkspaceIds.add(row.id);
    }

    const matchingSavedBriefIds = new Set(data.savedBriefIds);
    for (const row of briefsRes.data ?? []) {
      if (normalizeBrand(row.brand_name) === targetKey) matchingSavedBriefIds.add(row.brief_id);
    }

    const matchingIntelIds = new Set(data.intelligenceIds);
    for (const row of ((intelRes.data ?? []) as Array<{ id: string; brand_name: string | null }>)) {
      if (normalizeBrand(row.brand_name) === targetKey) matchingIntelIds.add(row.id);
    }

    const deleteBatch = async (
      table: "sessions" | "briefing_room_workspaces" | "saved_briefs" | "intelligence_sessions",
      column: "id" | "brief_id",
      ids: string[],
    ): Promise<number> => {
      if (ids.length === 0) return 0;
      const { error, count } = await supabaseAdmin
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from(table as any)
        .delete({ count: "exact" })
        .eq("user_id", userId)
        .in(column, ids);
      if (error) throw new Error(error.message);
      return count ?? ids.length;
    };

    const [sessionsDeleted, workspacesDeleted, briefsDeleted, intelligenceDeleted] =
      await Promise.all([
        deleteBatch("sessions", "id", [...matchingSessionIds]),
        deleteBatch("briefing_room_workspaces", "id", [...matchingWorkspaceIds]),
        deleteBatch("saved_briefs", "brief_id", [...matchingSavedBriefIds]),
        deleteBatch("intelligence_sessions", "id", [...matchingIntelIds]),
      ]);

    return {
      ok: true,
      sessionsDeleted,
      workspacesDeleted,
      briefsDeleted,
      intelligenceDeleted,
      totalDeleted:
        sessionsDeleted + workspacesDeleted + briefsDeleted + intelligenceDeleted,
    };
  });