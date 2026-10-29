export const COPY_SESSION = "cb7ac9d6-f70b-4902-beb6-7bd0ff5da85f";
export function exactSentences(instruction: string): string[] {
  return [...instruction.matchAll(/["“]([^"”]+)["”]/g)].map((m) => m[1]).filter((s) => s.trim().length > 0);
}
export function missingSentences(prompt: string, required: string[]): string[] {
  return required.filter((s) => !prompt.includes(s));
}
export function preservedFieldLoss(before: Record<string, unknown>, after: Record<string, unknown>): string[] {
  return Object.keys(before).filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]));
}
/** Saved content/identity fields; operational progress and assessment records legitimately change. */
export function unmentionedSavedFields(row: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(row).filter(([key]) => !/^(working_prompt|final_prompt|updated_at|revision_log|issue_resolutions|output_revision|repair_|required_exact_|preserved_fields|worker_|run_state|error|amendment_|mandate_|fidelity_|gate_two_|signatures_extracted|propagated|wad_|cd_)/.test(key)));
}
export function currentResolution(resolutions: unknown, kind: string): boolean {
  return Array.isArray(resolutions) && resolutions.some((r) => r?.kind === kind && r?.action === "approved_with_issue" && !r?.superseded_at);
}
export async function retryReadable<T>(call: (attempt: number) => Promise<string>, name: string, onAttempt?: (attempt: number) => Promise<void>): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt++) {
    await onAttempt?.(attempt);
    const text = await call(attempt);
    try {
      const start = text.indexOf("{"); const end = text.lastIndexOf("}");
      if (start < 0 || end <= start) throw new SyntaxError("no JSON object");
      return JSON.parse(text.slice(start, end + 1)) as T;
    } catch (e) {
      if (attempt === 2) throw new Error(`${name}: unreadable model output after 2 platform retries (${e instanceof Error ? e.message : String(e)}).`);
    }
  }
  throw new Error(`${name}: unreadable output`);
}