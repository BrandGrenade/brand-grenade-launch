// Shared Anthropic Claude caller for pipeline stages.
// - 120s per-request timeout via AbortController
// - Automatic single retry on 524 / 503 / timeout, with a 3s delay
// - Optional sessionId + stageLabel to publish a transient "retrying" status
//   to the sessions.retry_status column (consumed by the pipeline right panel).
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = "claude-sonnet-4-5";
const REQUEST_TIMEOUT_MS = 180_000;
const RETRY_DELAY_MS = 3_000;

export interface CallClaudeArgs {
  systemPrompt: string;
  userMessage: string;
  maxTokens?: number;
  temperature?: number;
  model?: string;
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

function isRetryableStatus(status: number) {
  return status === 524 || status === 503 || status === 502 || status === 504;
}

async function doFetch(apiKey: string, body: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function prepareCall(args: CallClaudeArgs): Promise<{ apiKey: string; body: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured");
  const devMode = await readDevMode(args.sessionId);
  let effectiveSystem = args.systemPrompt;
  let effectiveMaxTokens = args.maxTokens ?? 8192;
  if (devMode && args.stageNumber && args.stageName) {
    effectiveSystem = buildDevModePrompt(args.stageNumber, args.stageName);
    effectiveMaxTokens = 500;
  } else {
    effectiveSystem = `${UNIVERSAL_SYSTEM_WRAPPER}\n\n${args.systemPrompt}`;
  }
  return {
    apiKey,
    body: JSON.stringify({
      model: args.model ?? DEFAULT_MODEL,
      max_tokens: effectiveMaxTokens,
      temperature: args.temperature ?? 0.5,
      system: effectiveSystem,
      messages: [{ role: "user", content: args.userMessage }],
    }),
  };
}

async function openWithRetry(
  apiKey: string,
  body: string,
  sessionId: string | undefined,
  stageLabel: string | undefined,
  stream: boolean
): Promise<Response> {
  let attempt = 0;
  const maxAttempts = 2;
  let lastError = "";
  const bodyWithFlag = stream
    ? (() => {
        const parsed = JSON.parse(body);
        parsed.stream = true;
        return JSON.stringify(parsed);
      })()
    : body;
  while (attempt < maxAttempts) {
    attempt++;
    try {
      const resp = await doFetch(apiKey, bodyWithFlag);
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
        ? `Claude API request timed out after ${REQUEST_TIMEOUT_MS / 1000}s`
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
  const { apiKey, body } = await prepareCall(args);
  const resp = await openWithRetry(apiKey, body, args.sessionId, args.stageLabel, true);
  if (!resp.body) throw new Error("Claude streaming response had no body");

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let total = "";
  // Immediate heartbeat: flush a chunk before Anthropic's first delta so
  // intermediaries don't idle-close during the model's initial think pause.
  // Empty string is used (not " ") so callers that do `output += delta`
  // don't get whitespace polluted into the final text.
  let lastDelta = Date.now();
  yield "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      // Periodic keep-alive during long Anthropic pauses (every 15s).
      const now = Date.now();
      if (now - lastDelta > 15000) {
        lastDelta = now;
        yield "";
      }
      buffer += decoder.decode(value, { stream: true });
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
            delta?: { type?: string; text?: string };
          };
          if (evt.type === "content_block_delta" && evt.delta?.type === "text_delta" && evt.delta.text) {
            total += evt.delta.text;
            lastDelta = Date.now();
            yield evt.delta.text;
          }
        } catch {
          // ignore partial / non-JSON SSE lines
        }
      }
    }
  } finally {
    try { reader.releaseLock(); } catch { /* noop */ }
  }
  if (!total.trim()) throw new Error("Claude returned an empty response");
}
