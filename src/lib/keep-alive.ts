// Keep-alive for long, silent model calls (same pattern as the Stage 11 fix):
// the edge cuts a browser request that sends nothing for ~100s, killing the
// worker mid-call. Server functions wrap the work in keepAliveStream, which
// sends a small signal every 15s and then the unchanged result; the browser
// unwraps it with resultOf. Results, prompts and saved records are untouched.
export const KEEPALIVE_MS = 15_000;
export type KeepAliveChunk<T> = { keepalive: true } | { done: true; result: T };

export async function* keepAliveStream<T>(work: Promise<T>, intervalMs = KEEPALIVE_MS): AsyncGenerator<KeepAliveChunk<T>> {
  let settled = false;
  let value: T | undefined;
  let failure: unknown;
  let failed = false;
  const done = work.then((v) => { value = v; }, (e) => { failed = true; failure = e; }).finally(() => { settled = true; });
  while (!settled) {
    await Promise.race([done, new Promise((r) => setTimeout(r, intervalMs))]);
    if (!settled) yield { keepalive: true };
  }
  if (failed) throw failure;
  yield { done: true, result: value as T };
}

/** Yields keep-alive deltas ("") inside a delta-streaming generator while awaiting work. */
export async function* awaitWithDeltaKeepAlive<T>(work: Promise<T>, out: { value?: T }, intervalMs = KEEPALIVE_MS): AsyncGenerator<{ delta: string }> {
  for await (const c of keepAliveStream(work, intervalMs)) {
    if ("done" in c) out.value = c.result;
    else yield { delta: "" };
  }
}

export type ResultOf<X> = X extends AsyncIterable<infer C> ? (C extends { done: true; result: infer R } ? R : never) : X;

/** Browser side: returns the final result, ignoring keep-alives. Plain values pass through. */
export async function resultOf<S>(source: S): Promise<ResultOf<Awaited<S>>> {
  type T = ResultOf<Awaited<S>>;
  const s = await source;
  if (!s || typeof (s as unknown as AsyncIterable<unknown>)[Symbol.asyncIterator] !== "function") return s as T;
  for await (const c of s as unknown as AsyncIterable<KeepAliveChunk<T>>) if (c && "done" in c) return c.result;
  throw new Error("The request ended before a result arrived. Please retry.");
}
