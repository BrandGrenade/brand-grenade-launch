export function sweepErrorRetryable(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /Claude API (429|5\d\d):/.test(message);
}

export function sweepLeaseLive(job: { status: string; lease_until: string | null }, now = Date.now()): boolean {
  return job.status === "running" && Date.parse(job.lease_until ?? "") > now;
}