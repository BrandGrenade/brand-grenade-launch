// Shared Anthropic Claude caller for pipeline stages.
// - 120s per-request timeout via AbortController
// - Automatic single retry on 524 / 503 / timeout, with a 3s delay
// - Optional sessionId + stageLabel to publish a transient "retrying" status
//   to the sessions.retry_status column (consumed by the pipeline right panel).
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = "claude-opus-4-8";
const REQUEST_TIMEOUT_MS = 180_000;
const RETRY_DELAY_MS = 3_000;

export interface CallClaudeArgs {
  systemPrompt: string;
  userMessage: string;
  maxTokens?: number;
  timeoutMs?: number;
  model?: string;
  skipUniversalWrapper?: boolean;
  /** When provided, retry status is written to sessions.retry_status and
   *  Development Mode (sessions.dev_mode) overrides the system prompt + max_tokens. */
  sessionId?: string;
  /** Human-readable stage label, e.g. "Stage 2". Used in the retry message. */
  stageLabel?: string;
  /** Stage number / id (e.g. "2", "1B") — used to build the Dev Mode prompt. */
  stageNumber?: string;
  /** Stage name (e.g. "Category Intelligence") — used to build the Dev Mode prompt. */
  stageName?: string;
}

function buildDevModePrompt(stageNumber: string, stageName: string): string {
  return `You are Brand Grenade Stage ${stageNumber} — ${stageName}.

Produce a brief but structurally complete output for this stage.
Include all required sections and headings but keep each section to
2-3 sentences maximum.

The goal is to confirm pipeline flow and data passing — not to produce
full production-quality output.

Label your output clearly:
DEV MODE — ABBREVIATED OUTPUT`;
}

const UNIVERSAL_SYSTEM_WRAPPER = `You are a senior global strategy director and planning lead at a world-class strategy consultancy. You are producing professional strategic analysis and recommendations for senior client audiences.

ABSOLUTE OUTPUT RULES:

FORMAT:
Write exclusively in flowing strategic prose formatted with markdown.
Begin every response with a ## heading.
Never begin with metadata, headers, or structured data blocks.
Use ## for main sections.
Use ### for sub-sections.
Use **bold** for key terms and critical insights.
Use > blockquotes for the single most important insight in each section.
Use - bullet points only for lists of 3 or more parallel items.
Use --- to separate major sections.
Complete every sentence fully.
Never truncate mid-thought.

NEVER OUTPUT:
- Field labels followed by colons (LABEL: value format)
- Structured data blocks or headers
- Validation or compliance results
- Pipeline process references
- Internal system terminology
- Agency names in brackets
- Status words: PASSED, CONFIRMED, CLEARED, PENDING, N/A
- Count summaries: "X of Y produced"
- Version numbers: V1, V2, V3
- Stage references: Stage 1, Stage 8
- Acronyms: CMM, SMP, SIS, STRL, SFS, BC1-BC5
- Frame or constraint set labels
- Any line beginning with ": "
- Any empty bullet points

ALWAYS WRITE AS:
A compelling strategic document that a CMO or senior partner would read with confidence and find immediately actionable.
Every sentence must earn its place. Strategic precision over completeness.`;

async function readDevMode(sessionId: string | undefined): Promise<boolean> {
  if (!sessionId) return false;
  try {
    const { data } = await supabaseAdmin
      .from("sessions")
      .select("dev_mode")
      .eq("id", sessionId)
      .single();
    return Boolean(data?.dev_mode);
  } catch {
    return false;
  }
}

async function setRetryStatus(sessionId: string | undefined, message: string | null) {
  if (!sessionId) return;
  try {
    await supabaseAdmin
      .from("sessions")
      .update({ retry_status: message })
      .eq("id", sessionId);
  } catch {
    // Status updates are best-effort; never fail the call because of them.
  }
}

// ---------------------------------------------------------------------------
// Amendment notes — universal injection.
//
// `sessions.stage_amendments` is a JSONB map keyed by lowercase stage id
// (e.g. "1", "1b", "2", "13b") with shape:
//   { feedback: string, previousOutput?: string, ts?: string }
//
// When a stage runs and an amendment exists for its stage id, the human
// direction is prefixed/suffixed onto the user message via the shared
// `buildFeedbackInjection` helper so it is applied as a mandatory constraint.
// On successful completion of the call the amendment is cleared so it does
// not re-apply on subsequent natural runs.
//
// Stages that handle feedback inline (1 / 8 / 12) inject the same wrapper
// themselves; the universal layer detects the marker and skips re-injection
// to avoid duplicate constraint blocks, but still clears the amendment.
// ---------------------------------------------------------------------------

const AMENDMENT_MARKER = "==== MANDATORY HUMAN REDIRECT";

type AmendmentEntry = { feedback?: string; previousOutput?: string | null };

async function readAmendment(
  sessionId: string | undefined,
  stageNumber: string | undefined,
): Promise<{ key: string; entry: AmendmentEntry } | null> {
  if (!sessionId || !stageNumber) return null;
  const key = stageNumber.toLowerCase();
  try {
    const { data } = await supabaseAdmin
      .from("sessions")
      .select("stage_amendments")
      .eq("id", sessionId)
      .single();
    const map = (data?.stage_amendments ?? {}) as Record<string, AmendmentEntry>;
    const entry = map[key];
    if (!entry || !entry.feedback || !entry.feedback.trim()) return null;
    return { key, entry };
  } catch {
    return null;
  }
}

async function clearAmendment(sessionId: string | undefined, key: string | undefined) {
  if (!sessionId || !key) return;
  try {
    const { data } = await supabaseAdmin
      .from("sessions")
      .select("stage_amendments")
      .eq("id", sessionId)
      .single();
    const map = { ...((data?.stage_amendments ?? {}) as Record<string, AmendmentEntry>) };
    if (!(key in map)) return;
    delete map[key];
    await supabaseAdmin
      .from("sessions")
      .update({ stage_amendments: map as never })
      .eq("id", sessionId);
  } catch {
    // best-effort
  }
}

function isRetryableStatus(status: number) {
  return status === 524 || status === 503 || status === 502 || status === 504;
}

async function doFetch(apiKey: string, body: string, timeoutMs = REQUEST_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "prompt-caching-2024-07-31",
        "content-type": "application/json",
      },
      body,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function prepareCall(
  args: CallClaudeArgs,
): Promise<{ apiKey: string; body: string; amendmentKey?: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured");
  const devMode = await readDevMode(args.sessionId);
  let effectiveSystem = args.systemPrompt;
  let effectiveMaxTokens = args.maxTokens ?? 8192;
  if (devMode && args.stageNumber && args.stageName) {
    effectiveSystem = buildDevModePrompt(args.stageNumber, args.stageName);
    effectiveMaxTokens = 500;
  } else if (!args.skipUniversalWrapper) {
    effectiveSystem = `${UNIVERSAL_SYSTEM_WRAPPER}\n\n${args.systemPrompt}`;
  }

  // Universal amendment-note injection. If a human reviewer entered amendment
  // notes before retrying this stage, wrap them onto the user message as a
  // mandatory constraint block. Skip wrapping if the caller already injected
  // the same block inline (stages 1 / 8 / 12) — detect via the shared marker.
  let effectiveUserMessage = args.userMessage;
  let amendmentKey: string | undefined;
  if (!devMode) {
    const amendment = await readAmendment(args.sessionId, args.stageNumber);
    if (amendment) {
      amendmentKey = amendment.key;
      const alreadyWrapped = args.userMessage.includes(AMENDMENT_MARKER);
      if (!alreadyWrapped) {
        const { buildFeedbackInjection } = await import("./feedback-injection");
        const { prefix, suffix } = buildFeedbackInjection({
          feedback: amendment.entry.feedback ?? "",
          previousOutput: amendment.entry.previousOutput ?? null,
          stageLabel: args.stageLabel ?? `Stage ${args.stageNumber ?? ""}`.trim(),
        });
        effectiveUserMessage = `${prefix}${args.userMessage}${suffix}`;
      }
    }
  }

  return {
    apiKey,
    amendmentKey,
    body: JSON.stringify({
      model: args.model ?? DEFAULT_MODEL,
      max_tokens: effectiveMaxTokens,
      system: [
        {
          type: "text",
          text: effectiveSystem,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: effectiveUserMessage }],
    }),
  };
}

async function openWithRetry(
  apiKey: string,
  body: string,
  sessionId: string | undefined,
  stageLabel: string | undefined,
  stream: boolean,
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<Response> {
  let attempt = 0;
  const maxAttempts = 2;
  let lastError = "";
  const bodyWithFlag = stream ? body.replace(/}$/, ',"stream":true}') : body;
  while (attempt < maxAttempts) {
    attempt++;
    try {
      const resp = await doFetch(apiKey, bodyWithFlag, timeoutMs);
      if (resp.ok) {
        await setRetryStatus(sessionId, null);
        return resp;
      }
      const text = await resp.text();
      lastError = `Claude API ${resp.status}: ${text.slice(0, 500)}`;
      if (isRetryableStatus(resp.status) && attempt < maxAttempts) {
        await setRetryStatus(sessionId, `Connection timeout — retrying ${stageLabel ?? "request"}...`);
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
        continue;
      }
      await setRetryStatus(sessionId, null);
      throw new Error(lastError);
    } catch (e) {
      const isAbort =
        e instanceof Error &&
        (e.name === "AbortError" || /aborted|timeout/i.test(e.message));
      const msg = e instanceof Error ? e.message : "network error";
      lastError = isAbort
        ? `Claude API request timed out after ${timeoutMs / 1000}s`
        : `Claude API request failed: ${msg}`;
      if ((isAbort || /network|fetch failed/i.test(msg)) && attempt < maxAttempts) {
        await setRetryStatus(sessionId, `Connection timeout — retrying ${stageLabel ?? "request"}...`);
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
        continue;
      }
      await setRetryStatus(sessionId, null);
      throw new Error(lastError);
    }
  }
  await setRetryStatus(sessionId, null);
  throw new Error(lastError || "Claude API call failed");
}

/**
 * Stage-facing entry point. Internally streams from Anthropic (SSE) and
 * accumulates the full text, returning it to the caller as a single string.
 *
 * Why streaming under the hood:
 *  - Keeps the Anthropic HTTP connection live via SSE chunks (avoids the
 *    single-shot 120-180s wait on `await resp.json()` for long generations
 *    on Cloudflare Workers / Lovable Cloud).
 *  - First bytes typically arrive within 1-3s and the connection stays
 *    active throughout generation, which prevents intermediary timeouts.
 *
 * Stage runners keep their existing pattern: accumulate the full output
 * and write it to the database exactly once when the stream ends.
 */
export async function callClaude(args: CallClaudeArgs): Promise<string> {
  let output = "";
  for await (const delta of streamClaude(args)) {
    output += delta;
  }
  const trimmed = output.trim();
  if (!trimmed) throw new Error("Claude returned an empty response");
  return trimmed;
}

/**
 * Streaming variant — yields text deltas as they arrive from the Anthropic
 * Messages SSE stream. Caller is responsible for persisting the accumulated
 * output. Retries are only attempted on the initial connection (not mid-stream).
 */
export async function* streamClaude(args: CallClaudeArgs): AsyncGenerator<string, void, unknown> {
  const { apiKey, body, amendmentKey } = await prepareCall(args);

  // [TELEMETRY] Per-stage instrumentation — emitted as structured log lines so
  // the diagnostic harness / log tail can build a pass-fail-per-stage report.
  const __telemetryStart = Date.now();
  const __telemetryLabel = args.stageLabel ?? args.stageNumber ?? "unknown";
  const __telemetrySession = args.sessionId ?? "no-session";
  console.log(
    `[TELEMETRY] stage=${__telemetryLabel} session=${__telemetrySession} event=start ts=${__telemetryStart}`,
  );
  let __telemetryChars = 0;
  let __telemetryFailed = false;
  let __telemetryError = "";
  try {

  // Single attempt: opens an SSE stream, accumulates text, returns
  // { total, stopReason, sawMessageStop }. Throws only on initial connection
  // failure (handled by openWithRetry). Mid-stream drops surface as
  // sawMessageStop === false so the outer loop can retry.
  async function attempt(): Promise<{ total: string; stopReason: string | null; sawMessageStop: boolean }> {
    const resp = await openWithRetry(apiKey, body, args.sessionId, args.stageLabel, true, args.timeoutMs);
    if (!resp.body) throw new Error("Claude streaming response had no body");
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let total = "";
    let stopReason: string | null = null;
    let sawMessageStop = false;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          await new Promise((r) => setTimeout(r, 500));
          const rest = decoder.decode();
          if (rest) buffer += rest;
          if (!buffer.trim()) break;
          buffer += "\n";
        } else {
          buffer += decoder.decode(value, { stream: true });
        }
        let idx: number;
        while ((idx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;
          try {
            const evt = JSON.parse(payload) as {
              type?: string;
              delta?: { type?: string; text?: string; stop_reason?: string };
            };
            if (evt.type === "content_block_delta" && evt.delta?.type === "text_delta" && evt.delta.text) {
              total += evt.delta.text;
            } else if (evt.type === "message_delta" && evt.delta?.stop_reason) {
              stopReason = evt.delta.stop_reason;
            } else if (evt.type === "message_stop") {
              sawMessageStop = true;
            }
          } catch {
            // ignore partial / non-JSON SSE lines
          }
        }
        if (done) break;
      }
    } catch {
      // Network drop mid-stream — return what we have so the outer loop decides.
    } finally {
      try { reader.releaseLock(); } catch { /* noop */ }
    }
    return { total, stopReason, sawMessageStop };
  }

  // Up to 2 attempts. If attempt 1 drops mid-stream (no message_stop and not
  // max_tokens), surface a "retrying automatically" status, wait 5s, and try
  // once more. Only yield deltas from the successful attempt so callers never
  // see duplicated text.
  let result = await attempt();
  if (!result.sawMessageStop && result.stopReason !== "max_tokens") {
    await setRetryStatus(args.sessionId, "Connection interrupted — retrying automatically...");
    await new Promise((r) => setTimeout(r, 5000));
    try {
      result = await attempt();
    } finally {
      await setRetryStatus(args.sessionId, null);
    }
  }

  const { total, stopReason, sawMessageStop } = result;
  __telemetryChars = total.length;
  if (total) yield total;
  if (!total.trim()) { __telemetryFailed = true; __telemetryError = "empty"; throw new Error("Claude returned an empty response"); }
  if (stopReason === "max_tokens") {
    __telemetryFailed = true; __telemetryError = "max_tokens_truncation";
    throw new Error(
      `Claude response truncated: hit max_tokens cap (${total.length} chars produced). Raise maxTokens for this stage.`,
    );
  }
  if (!sawMessageStop) {
    __telemetryFailed = true; __telemetryError = "no_message_stop";
    throw new Error(
      `Claude stream ended without message_stop (${total.length} chars produced). Upstream connection likely dropped — retry the stage.`,
    );
  }
  // Successful completion — consume the amendment so it does not re-apply
  // on the next natural run of this stage.
  if (amendmentKey) {
    await clearAmendment(args.sessionId, amendmentKey);
  }
  } catch (e) {
    __telemetryFailed = true;
    if (!__telemetryError) __telemetryError = e instanceof Error ? e.message.slice(0, 200) : String(e).slice(0, 200);
    throw e;
  } finally {
    const __dur = Date.now() - __telemetryStart;
    console.log(
      `[TELEMETRY] stage=${__telemetryLabel} session=${__telemetrySession} event=end status=${__telemetryFailed ? "FAIL" : "PASS"} duration_ms=${__dur} chars=${__telemetryChars}${__telemetryFailed ? ` error="${__telemetryError}"` : ""}`,
    );
  }
}
