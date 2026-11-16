import { STAGE_MANIFEST } from './stage-manifest';
import type { RunRec } from './access/core';

export const RUN_ORIGIN = 'https://brandgrenade.app';
const hasValue = (v: unknown): boolean => typeof v === 'string' ? v.trim().length > 0 : Array.isArray(v) ? v.length > 0 : !!v && typeof v === 'object' ? Object.keys(v).length > 0 : false;

/** Saved evidence only: never infer completion from current_stage or status. */
export function completedStages(row: Record<string, unknown>) {
  return STAGE_MANIFEST.filter(s => s.columns.some(c => hasValue(row[c]))).map(s => s.id.toUpperCase());
}
export function runPath(id: string, stage?: string) {
  return `/runs/${encodeURIComponent(id)}${stage ? `?stage=${encodeURIComponent(stage.toUpperCase())}` : ''}`;
}
export function runLinks(run: RunRec) {
  const stages = run.table === 'sessions' ? completedStages(run.row) : [];
  return {
    open_url: RUN_ORIGIN + runPath(run.id, stages.at(-1)),
    stage_urls: Object.fromEntries(stages.map(s => [s, RUN_ORIGIN + runPath(run.id, s)])),
  };
}