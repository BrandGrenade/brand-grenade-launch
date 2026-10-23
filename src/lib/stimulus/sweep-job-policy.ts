export const SWEEP_CREDIT_MESSAGE = "AI credit exhausted — top up and press Resume";

export function sweepCreditExhausted(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /credit balance is too low|AI credit exhausted/i.test(message);
}

export function sweepMayAdvance(status: string, error: unknown): boolean {
  return status === "generating" && !sweepCreditExhausted(error);
}

export function sweepErrorRetryable(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return !sweepCreditExhausted(error) && /Claude API (429|5\d\d):/.test(message);
}

export function sweepLeaseLive(job: { status: string; lease_until: string | null }, now = Date.now()): boolean {
  return job.status === "running" && Date.parse(job.lease_until ?? "") > now;
}

export const SWEEP_BATCH_SIZE = 3;
export const SWEEP_SLICE_BATCHES = 5;
export const SWEEP_COOLDOWN_MS = 1000;

/** A throttled lens waits independently; successful sibling calls never wait. */
export async function retrySweepLens<T>(call: () => Promise<T>, wait: (ms: number) => Promise<void> = ms => new Promise(resolve => setTimeout(resolve, ms))): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try { return await call(); }
    catch (error) {
      if (!sweepErrorRetryable(error) || attempt >= 2) throw error;
      await wait(5000 * 2 ** attempt);
    }
  }
}