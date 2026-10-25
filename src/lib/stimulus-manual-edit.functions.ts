import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ManualIdeaEdit } from "@/lib/stimulus/manual-edit";

export const saveManualIdeaEdit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => ManualIdeaEdit.parse(input))
  .handler(async ({ data, context }) => {
    const { data: attemptId, error } = await context.supabase.rpc("bg_manual_edit_idea" as never, {
      _direction_id: data.directionId,
      _expected_attempt_id: data.expectedAttemptId,
      _description: data.description,
      _field1: data.field1,
      _field2: data.field2,
    } as never);
    if (error) throw new Error(error.message);
    return { attemptId: String(attemptId) };
  });