// CONTENT CREATION INPUT PROMPT — VERSION HISTORY
//
// Every save of a channel's Content Creation Input Prompt writes a new version
// row. Nothing is ever overwritten in history: the generation writes v1, each
// edit writes the next version, and a revert writes a *new* version carrying
// the older text. The highest version number is always the active one, and it
// is mirrored onto stimulus_directions.direction so everything downstream
// (export, Orchestration Engine, fidelity) reads the active version.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { AdaptationFidelity } from "./adaptation-fidelity-types";

export type PromptVersion = {
  id: string;
  versionNo: number;
  text: string;
  origin: string;
  fidelity: AdaptationFidelity | null;
  createdAt: string;
};

async function nextVersionNo(directionId: string): Promise<number> {
  const { data } = await supabaseAdmin
    .from("channel_prompt_versions")
    .select("version_no")
    .eq("direction_id", directionId)
    .order("version_no", { ascending: false })
    .limit(1);
  return ((data?.[0]?.version_no as number | undefined) ?? 0) + 1;
}

/** Appends a version. Never overwrites; returns the new version number. */
export async function recordPromptVersion(args: {
  sessionId: string;
  runId: string;
  directionId: string;
  text: string;
  origin: "generated" | "auto_retry" | "edited" | "reverted";
  fidelity?: AdaptationFidelity | null;
  userId?: string | null;
}): Promise<number> {
  const versionNo = await nextVersionNo(args.directionId);
  await supabaseAdmin.from("channel_prompt_versions").insert({
    session_id: args.sessionId,
    run_id: args.runId,
    direction_id: args.directionId,
    version_no: versionNo,
    text: args.text,
    origin: args.origin,
    fidelity: (args.fidelity ?? null) as never,
    created_by: args.userId ?? null,
  });
  return versionNo;
}

/** Attaches a fidelity verdict to the newest version of a prompt. */
export async function attachFidelityToLatestVersion(
  directionId: string,
  fidelity: AdaptationFidelity,
): Promise<void> {
  const { data } = await supabaseAdmin
    .from("channel_prompt_versions")
    .select("id")
    .eq("direction_id", directionId)
    .order("version_no", { ascending: false })
    .limit(1);
  const id = data?.[0]?.id;
  if (id) {
    await supabaseAdmin
      .from("channel_prompt_versions")
      .update({ fidelity: fidelity as never })
      .eq("id", id);
  }
}

export async function listPromptVersionsFor(directionId: string): Promise<PromptVersion[]> {
  const { data } = await supabaseAdmin
    .from("channel_prompt_versions")
    .select("id, version_no, text, origin, fidelity, created_at")
    .eq("direction_id", directionId)
    .order("version_no", { ascending: false });
  return (data ?? []).map((r) => ({
    id: r.id as string,
    versionNo: r.version_no as number,
    text: r.text as string,
    origin: r.origin as string,
    fidelity: (r.fidelity as AdaptationFidelity | null) ?? null,
    createdAt: r.created_at as string,
  }));
}
