import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Verify the caller (identified by userId from requireSupabaseAuth) owns
 * the given session. Throws on mismatch, missing session, or lookup error.
 *
 * MUST be called at the top of every server-fn handler that accepts a
 * caller-supplied sessionId, AFTER requireSupabaseAuth middleware.
 *
 * Prevents IDOR: an authenticated user passing another user's sessionId
 * to gain read/write access via the service-role client.
 */
export async function assertSessionOwner(
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
  if (error) {
    throw new Error(`Session ownership check failed: ${error.message}`);
  }
  if (!data) {
    throw new Error("Session not found");
  }
  if (data.user_id !== userId) {
    throw new Error("Forbidden: session does not belong to caller");
  }
}
