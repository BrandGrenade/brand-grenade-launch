/**
 * Node-only half of the background scheduler.
 *
 * `node:async_hooks` must never be reachable from the client graph, so the
 * AsyncLocalStorage lives here (imported solely by the SSR entry, src/server.ts)
 * and registers itself with the runtime-agnostic scheduler in
 * `background.server.ts`.
 */

import { AsyncLocalStorage } from "node:async_hooks";
import { registerContextStore, type ExecCtx } from "./background.server";

const ctxStore = new AsyncLocalStorage<ExecCtx | undefined>();
registerContextStore(ctxStore);

/** Runs `fn` with `ctx` bound to the current async context. */
export function runWithExecutionContext<T>(ctx: unknown, fn: () => T): T {
  return ctxStore.run(ctx as ExecCtx | undefined, fn);
}
