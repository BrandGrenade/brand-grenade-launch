// Phase 0 — Universal DB write confirmation helper.
// Every stage save must succeed before the human is told the stage is locked.
// Retries once on failure, surfaces a typed result the caller can branch on.

export interface WriteResult {
  ok: boolean;
  attempts: number;
  error?: string;
}

export async function confirmWrite(
  write: () => PromiseLike<{ error: { message: string } | null }>,
  label = "write",
): Promise<WriteResult> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const { error } = await write();
      if (!error) return { ok: true, attempts: attempt };
      if (attempt === 2) {
        return { ok: false, attempts: attempt, error: `${label} failed: ${error.message}` };
      }
    } catch (e) {
      if (attempt === 2) {
        return {
          ok: false,
          attempts: attempt,
          error: `${label} failed: ${e instanceof Error ? e.message : String(e)}`,
        };
      }
    }
    // Brief backoff between attempts.
    await new Promise((r) => setTimeout(r, 250));
  }
  return { ok: false, attempts: 2, error: `${label} failed` };
}
