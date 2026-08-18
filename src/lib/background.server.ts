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
 * response has been returned.
 *
 * IMPORTANT — why this is AsyncLocalStorage and not a global:
 * a single Worker isolate serves many overlapping requests. Stashing the
 * ExecutionContext on `globalThis` means request B overwrites request A's ctx,
 * and a `waitUntil()` handed to an ExecutionContext whose invocation has
 * already finished is silently discarded (or throws "Illegal invocation") —
 * the job never runs, nothing is logged, and the caller still sees HTTP 200.
 * Binding the ctx to the async context of the request that created it removes
 * that race for every caller of scheduleBackground.
 */

import { AsyncLocalStorage } from "node:async_hooks";

type ExecCtx = { waitUntil?: (p: Promise<unknown>) => void };

const ctxStore = new AsyncLocalStorage<ExecCtx | undefined>();

/** Runs `fn` with `ctx` bound to the current async context. */
export function runWithExecutionContext<T>(ctx: unknown, fn: () => T): T {
  return ctxStore.run(ctx as ExecCtx | undefined, fn);
}

function currentCtx(): ExecCtx | undefined {
  return (
    ctxStore.getStore() ??
    (globalThis as unknown as { __cfCtx?: ExecCtx }).__cfCtx
  );
}

export function scheduleBackground(promise: Promise<unknown>, label = "background"): void {
  const guarded = promise.catch((e: unknown) => {
    console.error(`[${label}]`, e);
  });

  const ctx = currentCtx();
  const waitUntil = ctx?.waitUntil?.bind(ctx);

  if (typeof waitUntil === "function") {
    try {
      waitUntil(guarded);
      return;
    } catch (e) {
      // A finished/foreign ExecutionContext rejects waitUntil. Never swallow
      // the job: fall through to best-effort execution and make it visible.
      console.error(`[${label}] waitUntil unavailable, running unattached:`, e);
    }
  }
  // Local dev / no Workers context: best-effort unawaited execution.
  void guarded;
}
