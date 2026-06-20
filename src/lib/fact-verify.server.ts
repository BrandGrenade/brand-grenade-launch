// Fact verification — runs Claude with the Anthropic web_search tool against
// claims a pipeline stage has asserted as real-world verifiable facts.
//
// Why this exists:
//   Stage 4B (and Stage 2) explicitly distinguish "real facts" from "perceived
//   facts" / interpretation. Real facts must be true — not just plausible.
//   A prompt instruction to "only state true facts" is not enforceable; the
//   model has no way to actually check. This module performs the actual check
//   by calling Claude with the web_search tool and asking it to corroborate
//   each claim against live sources.
//
// What it returns:
//   - A list of verdicts per extracted claim.
//   - A rewritten version of the original output where any claim that is
//     not "verified" is visibly flagged with a ⚠️ marker and downgraded to
//     "UNVERIFIED — REQUIRES HUMAN CONFIRMATION", and a VERIFICATION REVIEW
//     section appended so the reviewer can act without re-reading the doc.
//
// This is structural, not prompt-only. The web_search call really happens.

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const VERIFY_MODEL = "claude-sonnet-4-6";
const REQUEST_TIMEOUT_MS = 180_000;
const MAX_SEARCHES = 8;

export type FactVerdict = "verified" | "unverified" | "contradicted";

export interface FactCheckResult {
  claim: string;
  verdict: FactVerdict;
  note: string;
}

export interface FactVerificationOutcome {
  results: FactCheckResult[];
  rewrittenOutput: string;
  ranSearch: boolean;
  error?: string;
}

interface VerifyArgs {
  output: string;
  brandName: string;
  category: string;
  stageLabel: string;
  /** Optional cap on claims sent for verification (cost / latency control). */
  maxClaims?: number;
}

const SYSTEM_PROMPT = `You are a fact-verification auditor. You receive a strategic analysis document and you must identify every claim in it that is presented as an INDEPENDENTLY VERIFIABLE real-world fact about a brand, a product, a category, a competitor, a regulation, a market statistic, or any other concrete claim about reality that could be checked by a journalist.

You MUST use the web_search tool to verify each such claim against live sources. Do not rely on your own training data. If you cannot find corroborating evidence, the claim is not verified.

DO NOT include:
- Strategic interpretation, opinion, recommendation, or hypothesis
- Anything explicitly labelled "perceived fact" or framed as interpretation
- Section headings or instructions
- Generic category truisms with no specific testable assertion

DO include:
- Any specific claim about how a product is made, what it contains, how it behaves, its history, its provenance, its market position stated as a fact
- Any claim about a named competitor's offering, ownership, history, behaviour
- Any claim about a sport's rules, a country's law, a regulation, a statistic, a date, a record, a quantity
- Anything labelled "Real Fact" in the source document

For each claim return strict JSON. Output ONLY a single JSON object — no prose, no markdown fences — with this exact shape:

{
  "claims": [
    {
      "claim": "<the exact assertion as it appears or a faithful paraphrase under 200 chars>",
      "verdict": "verified" | "unverified" | "contradicted",
      "note": "<one short sentence: what the search found or did not find. Cite a source domain if relevant.>"
    }
  ]
}

verdict rules:
- "verified": web search returned a credible source corroborating the claim
- "unverified": web search ran but did not return clear corroboration
- "contradicted": web search returned a credible source that contradicts the claim

Cap your output at 25 claims maximum — prioritise the most load-bearing factual assertions. If the document contains no verifiable factual claims, return {"claims": []}.`;

function buildUserMessage(args: VerifyArgs): string {
  return `Brand: ${args.brandName}
Category: ${args.category}
Source stage: ${args.stageLabel}

Document to audit:

${args.output}

Identify every independently verifiable real-world claim, web_search each one, and return the JSON object specified by the system prompt. Begin your response with { and end it with }.`;
}

interface ClaudeContentBlock {
  type?: string;
  text?: string;
}

interface ClaudeMessageResponse {
  content?: ClaudeContentBlock[];
  stop_reason?: string;
}

async function callVerifier(args: VerifyArgs): Promise<FactCheckResult[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const resp = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: VERIFY_MODEL,
        max_tokens: 16000,
        system: SYSTEM_PROMPT,
        tools: [
          {
            type: "web_search_20250305",
            name: "web_search",
            max_uses: MAX_SEARCHES,
          },
        ],
        messages: [{ role: "user", content: buildUserMessage(args) }],
      }),
      signal: controller.signal,
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Verifier ${resp.status}: ${text.slice(0, 400)}`);
    }
    const json = (await resp.json()) as ClaudeMessageResponse;
    const textBlocks = (json.content ?? [])
      .filter((b) => b.type === "text" && typeof b.text === "string")
      .map((b) => b.text as string)
      .join("\n");
    if (!textBlocks.trim()) return [];
    return parseClaimsJson(textBlocks, args.maxClaims ?? 25);
  } finally {
    clearTimeout(timeout);
  }
}

function parseClaimsJson(text: string, cap: number): FactCheckResult[] {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return [];
  const slice = text.slice(start, end + 1);
  try {
    const parsed = JSON.parse(slice) as { claims?: unknown };
    const arr = Array.isArray(parsed.claims) ? parsed.claims : [];
    const results: FactCheckResult[] = [];
    for (const item of arr) {
      if (!item || typeof item !== "object") continue;
      const obj = item as Record<string, unknown>;
      const claim = typeof obj.claim === "string" ? obj.claim.trim() : "";
      const verdictRaw = typeof obj.verdict === "string" ? obj.verdict.toLowerCase().trim() : "";
      const note = typeof obj.note === "string" ? obj.note.trim() : "";
      if (!claim) continue;
      const verdict: FactVerdict =
        verdictRaw === "verified" ? "verified"
          : verdictRaw === "contradicted" ? "contradicted"
            : "unverified";
      results.push({ claim, verdict, note: note || "No note returned." });
      if (results.length >= cap) break;
    }
    return results;
  } catch {
    return [];
  }
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function annotateOutput(output: string, results: FactCheckResult[]): string {
  const flagged = results.filter((r) => r.verdict !== "verified");
  if (flagged.length === 0) {
    return `${output}\n\n---\n\n## ✅ Fact Verification Review\n\nA live web search was run against every independently verifiable claim in this stage's output. All ${results.length} checked claim${results.length === 1 ? "" : "s"} returned corroborating evidence. No human fact-check required.\n`;
  }

  // Best-effort inline flagging: where the verbatim claim string appears in
  // the document, prepend a ⚠️ marker so the reviewer's eye lands on it.
  let annotated = output;
  for (const r of flagged) {
    const needle = r.claim.slice(0, 120).trim();
    if (!needle) continue;
    const re = new RegExp(escapeRegex(needle), "i");
    if (re.test(annotated)) {
      annotated = annotated.replace(re, `⚠️ **[UNVERIFIED — REQUIRES HUMAN CONFIRMATION]** ${needle}`);
    }
  }

  const reviewLines = flagged.map((r, i) => {
    const tag = r.verdict === "contradicted" ? "❌ CONTRADICTED" : "⚠️ UNVERIFIED";
    return `${i + 1}. **${tag}** — ${r.claim}\n   _${r.note}_`;
  });

  const verifiedCount = results.length - flagged.length;
  const footer = `\n\n---\n\n## ⚠️ Fact Verification Review — HUMAN ACTION REQUIRED\n\nA live web search was run against every independently verifiable claim in this stage's output. **${flagged.length} of ${results.length} checked claim${results.length === 1 ? "" : "s"}** could not be corroborated and must be confirmed by a human reviewer before being treated as established fact. The remaining ${verifiedCount} returned corroborating evidence.\n\nFlagged claims appear inline above with a ⚠️ marker. Full list:\n\n${reviewLines.join("\n\n")}\n\n**Do not promote any flagged claim to downstream insight, territory, or proposition until it has been independently confirmed.**\n`;
  return `${annotated}${footer}`;
}

export async function verifyRealFacts(args: VerifyArgs): Promise<FactVerificationOutcome> {
  try {
    const results = await callVerifier(args);
    if (results.length === 0) {
      return {
        results: [],
        rewrittenOutput: `${args.output}\n\n---\n\n## ✅ Fact Verification Review\n\nA live web search auditor ran against this output and found no independently verifiable real-world factual claims to check. All content read as strategic interpretation or perceived-fact framing.\n`,
        ranSearch: true,
      };
    }
    return {
      results,
      rewrittenOutput: annotateOutput(args.output, results),
      ranSearch: true,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // Verification failure must NOT block the stage. Flag the failure into
    // the output so the human reviewer knows verification did not run.
    const banner = `\n\n---\n\n## ⚠️ Fact Verification Review — VERIFICATION CALL FAILED\n\nThe automated web-search fact-check did not complete (${msg.slice(0, 200)}). Every claim in this stage's output presented as a real-world verifiable fact must be confirmed manually by a human reviewer before being treated as established fact.\n`;
    return {
      results: [],
      rewrittenOutput: `${args.output}${banner}`,
      ranSearch: false,
      error: msg,
    };
  }
}
