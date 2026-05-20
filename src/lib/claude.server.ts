// Shared Anthropic Claude caller for pipeline stages.
// Reads ANTHROPIC_API_KEY from process.env at call time (server-only).

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = "claude-sonnet-4-20250514";

export interface CallClaudeArgs {
  systemPrompt: string;
  userMessage: string;
  maxTokens?: number;
  temperature?: number;
  model?: string;
}

export async function callClaude({
  systemPrompt,
  userMessage,
  maxTokens = 8192,
  temperature = 0.5,
  model = DEFAULT_MODEL,
}: CallClaudeArgs): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured");

  let resp: Response;
  try {
    resp = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        temperature,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      }),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "network error";
    throw new Error(`Claude API request failed: ${msg}`);
  }

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Claude API ${resp.status}: ${body.slice(0, 500)}`);
  }

  const json = (await resp.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };
  const output = (json.content ?? [])
    .filter((c) => c.type === "text" && c.text)
    .map((c) => c.text!)
    .join("\n")
    .trim();
  if (!output) throw new Error("Claude returned an empty response");
  return output;
}
