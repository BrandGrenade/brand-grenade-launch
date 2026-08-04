// Gate One rating — runs Claude with the Anthropic web_search tool so that
// Creative Uniqueness is checked against live sources, not training knowledge.
// Same discipline as Stage 13B / fact-verify.server.ts.

import {
  RATING_SYSTEM_PROMPT,
  buildRatingUserMessage,
  TIEBREAKER_SYSTEM_PROMPT,
  buildTiebreakerUserMessage,
  type DirectionRatings,
} from "./rating-prompts";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-5-20250929";
const MAX_SEARCHES = 4;
const REQUEST_TIMEOUT_MS = 240_000;

interface Block {
  type?: string;
  text?: string;
  name?: string;
  input?: { query?: string };
}

async function anthropic(body: unknown): Promise<{ text: string; blocks: Block[] }> {
  const apiKey = process.env["ANTHROPIC_API_KEY"];
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const resp = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!resp.ok) {
      const t = await resp.text();
      throw new Error(`Rating call ${resp.status}: ${t.slice(0, 400)}`);
    }
    const json = (await resp.json()) as { content?: Block[] };
    const blocks = json.content ?? [];
    const text = blocks
      .filter((b) => b.type === "text" && typeof b.text === "string")
      .map((b) => b.text as string)
      .join("\n");
    return { text, blocks };
  } finally {
    clearTimeout(timer);
  }
}

function extractJson(text: string): Record<string, unknown> {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("Rating response contained no JSON object");
  return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
}

export interface RateResult {
  ratings: DirectionRatings;
  /** Structurally observed, not model-asserted: did the web_search tool actually run? */
  searchCallsObserved: number;
  observedQueries: string[];
}

export async function rateDirection(args: {
  brandName: string;
  category: string;
  channelName: string;
  smp: string;
  strategicTension: string;
  detonationLine: string;
  lensName: string;
  direction: string;
  instinctBrief: string | null;
}): Promise<RateResult> {
  const { text, blocks } = await anthropic({
    model: MODEL,
    max_tokens: 8000,
    system: RATING_SYSTEM_PROMPT,
    tools: [{ type: "web_search_20250305", name: "web_search", max_uses: MAX_SEARCHES }],
    messages: [{ role: "user", content: buildRatingUserMessage(args) }],
  });

  const searchBlocks = blocks.filter(
    (b) => b.type === "server_tool_use" && b.name === "web_search",
  );
  const observedQueries = searchBlocks
    .map((b) => b.input?.query)
    .filter((q): q is string => Boolean(q));

  const parsed = extractJson(text) as unknown as DirectionRatings;

  // Never let the model claim a search it did not make.
  parsed.creative_uniqueness = {
    ...(parsed.creative_uniqueness ?? ({} as DirectionRatings["creative_uniqueness"])),
    web_search_performed: searchBlocks.length > 0,
    searches_run: observedQueries.length
      ? observedQueries
      : (parsed.creative_uniqueness?.searches_run ?? []),
  };
  if (searchBlocks.length === 0) {
    parsed.creative_uniqueness.verdict = `NOT VERIFIED BY LIVE SEARCH — no web_search call was made, so this uniqueness read is model assertion only. ${parsed.creative_uniqueness.verdict ?? ""}`.trim();
  }

  // "What can save it" is mandatory below Direct.
  const sc = parsed.strategic_compliance;
  if (sc && sc.rating !== "Direct" && !sc.what_can_save_it?.trim()) {
    sc.what_can_save_it =
      "No salvage note returned by the rater — re-run the rating for this direction before acting on it.";
  }

  return { ratings: parsed, searchCallsObserved: searchBlocks.length, observedQueries };
}

export async function runSeasonedCdPass(args: {
  brandName: string;
  channelName: string;
  smp: string;
  candidates: { label: string; lensName: string; direction: string; summary: string }[];
}): Promise<string> {
  const { text } = await anthropic({
    model: MODEL,
    max_tokens: 1200,
    temperature: 1,
    system: TIEBREAKER_SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildTiebreakerUserMessage(args) }],
  });
  return text.trim();
}
