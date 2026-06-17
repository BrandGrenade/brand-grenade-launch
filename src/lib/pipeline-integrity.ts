import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const STAGE_OUTPUT_COLUMNS = {
  1: "stage_1_output",
  2: "stage_2_output",
  3: "stage_3_output",
  4: "stage_4_output",
  5: "stage_5_output",
  6: "stage_6_output",
  7: "stage_7_output",
  8: "stage_8_output",
  9: "stage_9_output",
  10: "stage_10_output",
  11: "stage_11_output",
  12: "stage_12_output",
  13: "stage_13_output",
  14: "stage_14_output",
  15: "stage_15_output",
  16: "stage_16_consulting_output",
  17: "stage_17_output",
  18: "stage_18_output",
  19: "stage_19_output",
  20: "stage_20_output",
  21: "stage_21_outputs",
  22: "stage_22_output",
} as const;

type StageNumber = keyof typeof STAGE_OUTPUT_COLUMNS;

function hasPersistedOutput(value: unknown): boolean {
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === "object") return Object.keys(value).length > 0;
  return value !== null && value !== undefined;
}

export async function assertUpstreamStageOutput(
  sessionId: string,
  stageNumber: StageNumber,
): Promise<void> {
  if (stageNumber < 2) return;
  const upstreamStage = (stageNumber - 1) as StageNumber;
  const column = STAGE_OUTPUT_COLUMNS[upstreamStage];
  const { data, error } = await supabaseAdmin
    .from("sessions")
    .select(column)
    .eq("id", sessionId)
    .single();
  if (error) throw new Error(`Failed to verify Stage ${upstreamStage} output before Stage ${stageNumber}: ${error.message}`);
  if (!hasPersistedOutput((data as Record<string, unknown> | null)?.[column])) {
    throw new Error(`Stage ${stageNumber} cannot run because Stage ${upstreamStage} output is missing`);
  }
}