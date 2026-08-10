// Stall watchdog for Intelligence Lab streaming runs.
//
// Mirrors the pipeline harness pattern in src/lib/stream-stage-safety.ts, but
// for intelligence_sessions (which has no per-stage output/error columns).
//
// Failure class it kills: the model connection goes dead mid-stream. No error
// is ever thrown, the `for await` simply never yields again, the Worker is
// later torn down, and the row sits at status='running' / stage_status
// 'running:N' forever with nothing to resume from and last_error NULL.
//
// Guarantees:
//   1. INACTIVITY TIMEOUT — if no delta arrives for `inactivityMs`, the stream
//      is abandoned and a real error is thrown (and therefore persisted by the
//      caller's catch, which writes status='failed' + last_error).
//   2. WALL-CLOCK BUDGET — total streaming time is capped at `budgetMs`.
//   3. LIVENESS HEARTBEAT — a throttled `onHeartbeat` fires while tokens flow,
//      so updated_at keeps moving and a stalled row is externally detectable.

export interface IntelligenceWatchdogOpts {
  /** Abort if no delta arrives within this window. Default 3 min. */
  inactivityMs?: number;
  /** Abort if total streaming exceeds this. Default 25 min. */
  budgetMs?: number;
  /** Minimum gap between heartbeat callbacks. Default 5s. */
  heartbeatMs?: number;
  /** Called (awaited) at most every heartbeatMs while streaming. */
  onHeartbeat?: (charsSoFar: number) => Promise<void>;
}

const DEFAULT_INACTIVITY_MS = 3 * 60_000;
const DEFAULT_BUDGET_MS = 25 * 60_000;
const DEFAULT_HEARTBEAT_MS = 5_000;

/**
 * Wrap an async iterable of string deltas with inactivity + wall-clock
 * watchdogs and a throttled liveness heartbeat. Yields the same deltas.
 * Throws a descriptive Error when either watchdog fires, so the caller's
 * existing catch block persists a real failure instead of hanging.
 */
export async function* withIntelligenceWatchdog(
  source: AsyncIterable<string>,
  opts: IntelligenceWatchdogOpts = {},
): AsyncGenerator<string, void> {
  const inactivityMs = opts.inactivityMs ?? DEFAULT_INACTIVITY_MS;
  const budgetMs = opts.budgetMs ?? DEFAULT_BUDGET_MS;
  const heartbeatMs = opts.heartbeatMs ?? DEFAULT_HEARTBEAT_MS;

  const started = Date.now();
  let chars = 0;
  let lastHeartbeat = 0;

  const iterator = source[Symbol.asyncIterator]();

  try {
    for (;;) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const stallGuard = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(
            new Error(
              `Intelligence stream stalled: no output for ${Math.round(
                inactivityMs / 1000,
              )}s after ${chars} characters. The model connection went dead mid-run. Retry to start again.`,
            ),
          );
        }, inactivityMs);
      });

      let result: IteratorResult<string>;
      try {
        result = await Promise.race([iterator.next(), stallGuard]);
      } finally {
        if (timer) clearTimeout(timer);
      }

      if (result.done) return;

      const delta = result.value ?? "";
      chars += delta.length;
      yield delta;

      const now = Date.now();
      if (opts.onHeartbeat && now - lastHeartbeat > heartbeatMs) {
        lastHeartbeat = now;
        await opts.onHeartbeat(chars);
      }

      if (now - started > budgetMs) {
        throw new Error(
          `Intelligence run exceeded its ${Math.round(budgetMs / 60_000)} minute time budget ` +
            `after ${chars} characters. Retry to start again.`,
        );
      }
    }
  } finally {
    // Release the upstream connection on any exit path (stall, budget, throw).
    try {
      await iterator.return?.();
    } catch {
      /* best-effort */
    }
  }
}
