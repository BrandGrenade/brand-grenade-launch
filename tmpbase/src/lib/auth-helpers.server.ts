import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Verify the caller (identified by userId from requireSupabaseAuth) may access
 * the given session — either as its owner, or as an invited collaborator
 * (public.session_collaborators). Throws otherwise.
 *
 * MUST be called at the top of every server-fn handler that accepts a
 * caller-supplied sessionId, AFTER requireSupabaseAuth middleware.
 *
 * Prevents IDOR: an authenticated user passing another user's sessionId
 * to gain read/write access via the service-role client.
 */
export async function assertSessionAccess(
  sessionId: string,
  userId: string | undefined,
): Promise<void> {
  if (!userId) {
    throw new Error("Unauthorized: no authenticated user");
  }
  const { data, error } = await supabaseAdmin.rpc("can_access_session", {
    _session_id: sessionId,
    _user_id: userId,
  });
  if (error) {
    throw new Error(`Session access check failed: ${error.message}`);
  }
  if (data !== true) {
    // Distinguish "missing" from "forbidden" for clearer diagnostics.
    const { data: row } = await supabaseAdmin
      .from("sessions")
      .select("id")
      .eq("id", sessionId)
      .maybeSingle();
    if (!row) throw new Error("Session not found");
    throw new Error("Forbidden: session does not belong to caller");
  }
}

/**
 * Stricter check: caller must be the session owner (used for sharing
 * administration, where collaborators must not be able to invite others).
 */
export async function assertSessionOwnerStrict(
  sessionId: string,
  userId: string | undefined,
): Promise<void> {
  if (!userId) {
    throw new Error("Unauthorized: no authenticated user");
  }
  const { data, error } = await supabaseAdmin
    .from("sessions")
    .select("user_id")
    .eq("id", sessionId)
    .maybeSingle();
  if (error) throw new Error(`Session ownership check failed: ${error.message}`);
  if (!data) throw new Error("Session not found");
  if (data.user_id !== userId) {
    throw new Error("Forbidden: only the session owner can manage sharing");
  }
}
