import { LOC_ENGINES, type EngineName } from "./task-types";

export const LOC_ENGINE_MAX_TOKENS = 16000;
export const LOC_ENGINE_RETRY_INCOMPLETE = true;

export type RetryEntry = { ok: boolean; output?: unknown; error?: string; locked?: boolean };

/** Ticked engines regenerate; unticked and locked entries are carried verbatim. */
export function locRetryPlan(prior: Record<string, RetryEntry>, regenerate?: EngineName[], keep?: EngineName[]) {
  const selected = new Set(regenerate ?? LOC_ENGINES.filter(e => !(keep ?? []).includes(e)));
  const enginesToRun = LOC_ENGINES.filter(e => selected.has(e) && !prior[e]?.locked);
  const keepSet = new Set(LOC_ENGINES.filter(e => !enginesToRun.includes(e)));
  const preserved = Object.fromEntries([...keepSet].filter(e => prior[e]).map(e => [e, prior[e]]));
  return { enginesToRun, keepSet, preserved };
}