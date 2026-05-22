// Shared helper: save a stage's terminal output to Supabase with one retry.
// If both attempts fail, write the error column and throw so the caller's
// generator surfaces the failure to the UI.
//
// Used by every stageN.functions.ts to guarantee the stream-complete save
// reaches Supabase even when the first write hits a transient error or
// the Worker is mid-shutdown.

import { supabaseAdmin } from "@/integrations/supabase/client.server";

type Updates = Record<string, unknown>;

export async function saveStageOutputWithRetry(
  sessionId: string,
  updates: Updates,
  errorColumn: string,
  stageLabel: string,
): Promise<void> {
  const attempt = async () => {
    const { error } = await supabaseAdmin
      .from("sessions")
      .update(updates)
      .eq("id", sessionId);
    if (error) throw new Error(error.message);
  };

  try {
    await attempt();
    return;
  } catch (firstErr) {
    const msg1 = firstErr instanceof Error ? firstErr.message : "unknown error";
    console.error(`[${stageLabel}] save failed (attempt 1): ${msg1} — retrying in 2s`);
    await new Promise((r) => setTimeout(r, 2000));
    try {
      await attempt();
      return;
    } catch (secondErr) {
      const msg2 = secondErr instanceof Error ? secondErr.message : "unknown error";
      console.error(`[${stageLabel}] save failed (attempt 2): ${msg2}`);
      const finalMsg = `Failed to save ${stageLabel} output after retry: ${msg2}`;
      // Best-effort: record the error column so the UI can show it.
      try {
        await supabaseAdmin
          .from("sessions")
          .update({ [errorColumn]: finalMsg })
          .eq("id", sessionId);
      } catch {
        // Swallow — we're about to throw the original failure anyway.
      }
      throw new Error(finalMsg);
    }
  }
}
