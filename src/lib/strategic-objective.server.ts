// Server-side resolver for the Strategic Objective directive.
//
// Loads the session's brief_versions and returns the injectable directive
// block for a given stage. Returns "" when no objective is set or when the
// stage has no conditional logic for that objective — so callers can append
// unconditionally and legacy sessions behave exactly as before.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  objectiveDirective,
  resolveObjective,
  requiresEnemyFirstPriority,
  type ObjectiveStageKey,
  type StrategicObjective,
} from "./strategic-objective";

export async function getSessionObjective(
  sessionId: string,
): Promise<StrategicObjective | null> {
  const { data, error } = await supabaseAdmin
    .from("sessions")
    .select("brief_versions")
    .eq("id", sessionId)
    .single();
  if (error || !data) return null;
  return resolveObjective(data.brief_versions);
}

export async function getObjectiveDirective(
  sessionId: string,
  stage: ObjectiveStageKey,
): Promise<string> {
  try {
    return objectiveDirective(await getSessionObjective(sessionId), stage);
  } catch {
    return "";
  }
}

export async function sessionRequiresEnemyFirstPriority(
  sessionId: string,
): Promise<boolean> {
  try {
    return requiresEnemyFirstPriority(await getSessionObjective(sessionId));
  } catch {
    return false;
  }
}
