// Shared Anthropic Claude caller for pipeline stages.
// - 120s per-request timeout via AbortController
// - Automatic single retry on 524 / 503 / timeout, with a 3s delay
// - Optional sessionId + stageLabel to publish a transient "retrying" status
//   to the sessions.retry_status column (consumed by the pipeline right panel).
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = "claude-sonnet-4-5";
const REQUEST_TIMEOUT_MS = 120_000;
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

const ABSOLUTE_OUTPUT_RULES = `ABSOLUTE OUTPUT RULES — READ FIRST:

You are a senior global strategy director producing a professional strategy document.

NEVER output any of the following under any circumstances:

Structured data headers or blocks:
OUTPUT HEADER, PIPELINE DATA HEADER, SET SUMMARY, FIELD HEADER, BLOCK HEADER, REPORT HEADER, DOCUMENT HEADER, SESSION HEADER

Internal count or status lines:
"SMPS PRODUCED: [number]"
"DRAFTS GENERATED: [number]"
"READY FOR: [anything]"
"FIELDS SYNTHESISED: [number]"
"FRAMES VALIDATED: [number]"
"ALL [ANYTHING] PASS"
"PENDING" as a status
"CONFIRMED" as a status label
"PASSED" as a status label
"N/A" as a field value

Structural labels as output:
"CROSS-[ANYTHING] CONVERGENCE:", "ANTI-CONVERGENCE:", "CONSTRAINT FIDELITY:", "CMM COMPLIANCE:", "ICONIC TIER:", "BRAND CREDIBILITY:", "TRUTH CONFIGURATION:", "STRATEGIC ROUTE:", "BRIEF DEPTH:", "TENSION TYPE:", "EVIDENCE TYPE:", "REJECTION TEST:", "FORBIDDEN TERRITORY:", "LANGUAGE EXCLUSIONS:", "COMPETITOR AVOIDANCE:", "DOWNSTREAM:", "UPSTREAM:", "STAGE [N]" as a reference label, "BC1" through "BC5", "V1"/"V2"/"V3" as version labels

Any line that is a field name followed by a colon and a value.
Any line formatted as KEY: Value where the key is an internal system term.

Pipeline process references:
"the pipeline", "this stage", "downstream stages", "upstream stages", "the prompt", "self-audit", "quality gate", "constraint set", "the system"

Incomplete sentences:
Never end a sentence without completing it. If you are running low on space, complete the current thought and stop. Never truncate mid-sentence.

ALWAYS output:
- Flowing strategic prose and analysis
- Properly formatted with ## headings
- Complete sentences and paragraphs
- Content a senior CMO would find immediately useful and compelling`;

const OUTPUT_FORMATTING_PREAMBLE = `${ABSOLUTE_OUTPUT_RULES}

OUTPUT FORMATTING RULES — APPLY TO THIS ENTIRE RESPONSE:

You are writing for a senior strategy audience. Format your output as a clean, professional strategic document.

USE THIS FORMATTING:
- ## for main section headings
- ### for sub-section headings
- **bold** for key terms, brand names, proposition labels, and emphasis
- Bullet lists (- ) for parallel items, criteria, examples
- > for short pull-quotes or callouts that deserve emphasis
- --- as a horizontal divider between major sections

DO NOT output:
- Internal pipeline structure, validation checks, field labels, or system architecture
- Raw JSON, frame numbers, agency tags in brackets, or self-audit blocks
- Any meta-commentary about the prompt or your own process

Write with the authority and clarity of a senior global planning director presenting strategy to a board.`;

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

export async function callClaude({
  systemPrompt,
  userMessage,
  maxTokens = 8192,
  temperature = 0.5,
  model = DEFAULT_MODEL,
  sessionId,
  stageLabel,
  stageNumber,
  stageName,
}: CallClaudeArgs): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured");

  // Dev Mode: swap in the compressed prompt + cap tokens at 500.
  const devMode = await readDevMode(sessionId);
  let effectiveSystem = systemPrompt;
  let effectiveMaxTokens = maxTokens;
  if (devMode && stageNumber && stageName) {
    effectiveSystem = buildDevModePrompt(stageNumber, stageName);
    effectiveMaxTokens = 500;
  } else {
    effectiveSystem = `${OUTPUT_FORMATTING_PREAMBLE}\n\n${systemPrompt}`;
  }


  const body = JSON.stringify({
    model,
    max_tokens: effectiveMaxTokens,
    temperature,
    system: effectiveSystem,
    messages: [{ role: "user", content: userMessage }],
  });

  let attempt = 0;
  const maxAttempts = 2; // initial + one retry
  let lastError: string = "";

  while (attempt < maxAttempts) {
    attempt++;
    try {
      const resp = await doFetch(apiKey, body);

      if (resp.ok) {
        const json = (await resp.json()) as {
          content?: Array<{ type: string; text?: string }>;
        };
        const output = (json.content ?? [])
          .filter((c) => c.type === "text" && c.text)
          .map((c) => c.text!)
          .join("\n")
          .trim();
        if (!output) throw new Error("Claude returned an empty response");
        await setRetryStatus(sessionId, null);
        return output;
      }

      // Non-OK response. Decide retry vs throw.
      const text = await resp.text();
      lastError = `Claude API ${resp.status}: ${text.slice(0, 500)}`;
      if (isRetryableStatus(resp.status) && attempt < maxAttempts) {
        const label = stageLabel ?? "request";
        await setRetryStatus(sessionId, `Connection timeout — retrying ${label}...`);
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
      lastError = isAbort ? `Claude API request timed out after ${REQUEST_TIMEOUT_MS / 1000}s` : `Claude API request failed: ${msg}`;
      if ((isAbort || /network|fetch failed/i.test(msg)) && attempt < maxAttempts) {
        const label = stageLabel ?? "request";
        await setRetryStatus(sessionId, `Connection timeout — retrying ${label}...`);
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
