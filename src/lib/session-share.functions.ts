// Session sharing — invite a teammate by email to a specific pipeline session.
// Owner-only administration; invited collaborators get read/write via the
// widened `sessions` RLS policies (public.can_access_session).

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type Collaborator = {
  id: string;
  email: string;
  createdAt: string;
  claimedAt: string | null;
};

const SessionInput = z.object({ sessionId: z.string().uuid() });
const AddInput = z.object({
  sessionId: z.string().uuid(),
  email: z.string().trim().toLowerCase().email().max(320),
});
const RemoveInput = z.object({
  sessionId: z.string().uuid(),
  id: z.string().uuid(),
});

export const listSessionCollaborators = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => SessionInput.parse(i))
  .handler(async ({ data, context }): Promise<{ collaborators: Collaborator[]; isOwner: boolean }> => {
    const { assertSessionAccess } = await import("@/lib/auth-helpers.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await assertSessionAccess(data.sessionId, context.userId);

    const { data: owner } = await supabaseAdmin
      .from("sessions")
      .select("user_id")
      .eq("id", data.sessionId)
      .maybeSingle();

    const { data: rows, error } = await supabaseAdmin
      .from("session_collaborators")
      .select("id, email, created_at, claimed_at")
      .eq("session_id", data.sessionId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    return {
      isOwner: owner?.user_id === context.userId,
      collaborators: (rows ?? []).map((r) => ({
        id: r.id as string,
        email: r.email as string,
        createdAt: r.created_at as string,
        claimedAt: (r.claimed_at as string | null) ?? null,
      })),
    };
  });

export const addSessionCollaborator = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => AddInput.parse(i))
  .handler(async ({ data, context }): Promise<{ collaborator: Collaborator }> => {
    const { assertSessionOwnerStrict } = await import("@/lib/auth-helpers.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await assertSessionOwnerStrict(data.sessionId, context.userId);

    // Resolve an existing account for this email so access works immediately,
    // without waiting for the claim-on-login pass.
    let existingUserId: string | null = null;
    try {
      const { data: page } = await supabaseAdmin.auth.admin.listUsers({
        page: 1,
        perPage: 200,
      });
      existingUserId =
        page?.users.find((u) => (u.email ?? "").toLowerCase() === data.email)?.id ?? null;
    } catch {
      existingUserId = null;
    }

    const { data: row, error } = await supabaseAdmin
      .from("session_collaborators")
      .upsert(
        {
          session_id: data.sessionId,
          email: data.email,
          invited_by: context.userId,
          user_id: existingUserId,
          claimed_at: existingUserId ? new Date().toISOString() : null,
        },
        { onConflict: "session_id,email" },
      )
      .select("id, email, created_at, claimed_at")
      .single();
    if (error || !row) throw new Error(error?.message ?? "Failed to add collaborator");

    return {
      collaborator: {
        id: row.id as string,
        email: row.email as string,
        createdAt: row.created_at as string,
        claimedAt: (row.claimed_at as string | null) ?? null,
      },
    };
  });

export const removeSessionCollaborator = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => RemoveInput.parse(i))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { assertSessionOwnerStrict } = await import("@/lib/auth-helpers.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await assertSessionOwnerStrict(data.sessionId, context.userId);

    const { error } = await supabaseAdmin
      .from("session_collaborators")
      .delete()
      .eq("id", data.id)
      .eq("session_id", data.sessionId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Claim-on-login: bind any invites addressed to the signed-in user's email
 * to their account id. Idempotent; safe to call on every sign-in.
 */
export const claimSessionInvites = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ claimed: number }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = (context.claims?.email as string | undefined)?.toLowerCase();
    if (!email) return { claimed: 0 };

    const { data, error } = await supabaseAdmin
      .from("session_collaborators")
      .update({ user_id: context.userId, claimed_at: new Date().toISOString() })
      .is("user_id", null)
      .ilike("email", email)
      .select("id");
    if (error) throw new Error(error.message);
    return { claimed: data?.length ?? 0 };
  });
