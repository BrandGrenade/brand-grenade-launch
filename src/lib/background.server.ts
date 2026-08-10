/**
 * Shared background-work scheduler.
 *
 * Long-running jobs must NOT be tethered to the browser's HTTP request. When a
 * server function awaits a multi-minute model call, the Worker invocation dies
 * the moment the client connection is severed (tab closed, reload, network
 * drop, navigation that aborts the fetch) — the job stops mid-flight without
 * ever reaching a catch block, leaving the DB row stuck in `running` forever.
 *
 * On Cloudflare, `ctx.waitUntil()` keeps the invocation alive after the
 * response has been returned. `src/server.ts` stashes the ExecutionContext on
 * `globalThis.__cfCtx` for exactly this purpose.
 */
export function scheduleBackground(promise: Promise<unknown>, label = "background"): void {
  const guarded = promise.catch((e: unknown) => {
    console.error(`[${label}]`, e);
  });

  const ctx = (
    globalThis as unknown as { __cfCtx?: { waitUntil?: (p: Promise<unknown>) => void } }
  ).__cfCtx;
  const waitUntil = ctx?.waitUntil?.bind(ctx);

  if (typeof waitUntil === "function") {
    waitUntil(guarded);
  } else {
    // Local dev / no Workers context: best-effort unawaited execution.
    void guarded;
  }
}
