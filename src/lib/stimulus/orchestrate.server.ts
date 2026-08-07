// CREATIVE STIMULUS ENGINE — PHASE 3 model passes.
// Text-only Anthropic calls. No tools, no live external tool APIs.

import {
  INITIAL_PROMPT_SYSTEM,
  buildInitialPromptMessage,
  EXTRACTION_SYSTEM,
  buildExtractionMessage,
  PROPAGATION_SYSTEM,
  buildPropagationMessage,
  WRITER_AD_SYSTEM,
  buildWriterAdMessage,
  CD_SYSTEM,
  buildCdMessage,
  COHESION_REVISION_SYSTEM,
  MANDATE_SYSTEM,
  buildMandateMessage,
  MANDATE_COMPLIANCE_SYSTEM,
  buildMandateComplianceMessage,
  type BrandAssetRules,
  type SignatureCategory,
} from "./orchestration-prompts";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-5-20250929";
const REQUEST_TIMEOUT_MS = 240_000;

async function anthropic(args: {
  system: string;
  message: string;
  maxTokens?: number;
}): Promise<string> {
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
      body: JSON.stringify({
        model: MODEL,
        max_tokens: args.maxTokens ?? 6000,
        system: args.system,
        messages: [{ role: "user", content: args.message }],
      }),
      signal: controller.signal,
    });
    if (!resp.ok) {
      const t = await resp.text();
      throw new Error(`Orchestration call ${resp.status}: ${t.slice(0, 400)}`);
    }
    const json = (await resp.json()) as { content?: { type?: string; text?: string }[] };
    const text = (json.content ?? [])
      .filter((b) => b.type === "text" && typeof b.text === "string")
      .map((b) => b.text as string)
      .join("\n")
      .trim();
    if (!text) throw new Error("Model returned an empty response");
    return text;
  } finally {
    clearTimeout(timer);
  }
}

function extractJson<T>(text: string): T {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("Response contained no JSON object");
  return JSON.parse(text.slice(start, end + 1)) as T;
}

export type { BrandAssetRules };

// -------------------------------------------------------------- initial prompt

export async function writeInitialPrompt(a: Parameters<typeof buildInitialPromptMessage>[0]) {
  return anthropic({
    system: INITIAL_PROMPT_SYSTEM,
    message: buildInitialPromptMessage(a),
    maxTokens: 4000,
  });
}

// -------------------------------------------------------------- step 1

export interface ExtractedSignature {
  category: SignatureCategory;
  name: string;
  description: string;
  origin: "extracted" | "instinct_brief";
}

const VALID_CATEGORIES: SignatureCategory[] = ["sonic", "visual", "verbal", "structural"];

export async function extractSignatures(
  a: Parameters<typeof buildExtractionMessage>[0],
): Promise<ExtractedSignature[]> {
  const text = await anthropic({
    system: EXTRACTION_SYSTEM,
    message: buildExtractionMessage(a),
    maxTokens: 2500,
  });
  const parsed = extractJson<{ signatures?: ExtractedSignature[] }>(text);
  return (parsed.signatures ?? [])
    .filter((s) => s && VALID_CATEGORIES.includes(s.category) && s.name?.trim())
    .slice(0, 4)
    .map((s) => ({
      category: s.category,
      name: s.name.trim(),
      description: (s.description ?? "").trim(),
      origin: s.origin === "instinct_brief" ? "instinct_brief" : "extracted",
    }));
}

// -------------------------------------------------------------- step 2

export interface PropagationSuggestion {
  signature_name: string;
  suggestion: string;
  rationale: string;
}

export async function proposeCrossReferences(
  a: Parameters<typeof buildPropagationMessage>[0],
): Promise<PropagationSuggestion[]> {
  if (a.registry.length === 0) return [];
  const text = await anthropic({
    system: PROPAGATION_SYSTEM,
    message: buildPropagationMessage(a),
    maxTokens: 2500,
  });
  const parsed = extractJson<{ suggestions?: PropagationSuggestion[] }>(text);
  return (parsed.suggestions ?? [])
    .filter((s) => s && s.suggestion?.trim())
    .slice(0, 3)
    .map((s) => ({
      signature_name: (s.signature_name ?? "").trim(),
      suggestion: s.suggestion.trim(),
      rationale: (s.rationale ?? "").trim(),
    }));
}

// -------------------------------------------------------------- step 3

export interface WriterAdResult {
  verdict: "pass" | "fail";
  reasoning: string;
  imperfection_verdict: string;
  revised_prompt: string;
}

export async function runWriterAdPass(
  a: Parameters<typeof buildWriterAdMessage>[0],
): Promise<WriterAdResult> {
  const text = await anthropic({
    system: WRITER_AD_SYSTEM,
    message: buildWriterAdMessage(a),
    maxTokens: 5000,
  });
  const p = extractJson<Partial<WriterAdResult>>(text);
  return {
    verdict: p.verdict === "fail" ? "fail" : "pass",
    reasoning: (p.reasoning ?? "").trim(),
    imperfection_verdict: (p.imperfection_verdict ?? "").trim(),
    revised_prompt: (p.revised_prompt ?? "").trim(),
  };
}

// -------------------------------------------------------------- step 4

export interface CdResult {
  cohesion: "pass" | "fail";
  reasoning: string;
  decisions: { id: string; decision: "accept" | "reject"; reason: string }[];
  prompt_notes: { prompt_id: string; note: string }[];
}

export async function runCreativeDirectorPass(
  a: Parameters<typeof buildCdMessage>[0],
): Promise<CdResult> {
  const text = await anthropic({
    system: CD_SYSTEM,
    message: buildCdMessage(a),
    maxTokens: 8000,
  });
  const p = extractJson<Partial<CdResult>>(text);
  return {
    cohesion: p.cohesion === "fail" ? "fail" : "pass",
    reasoning: (p.reasoning ?? "").trim(),
    decisions: (p.decisions ?? []).filter((d) => d && d.id),
    prompt_notes: (p.prompt_notes ?? []).filter((n) => n && n.prompt_id && n.note?.trim()),
  };
}

export async function reviseForCohesion(a: {
  note: string;
  prompt: string;
  channelName: string;
}): Promise<string> {
  return anthropic({
    system: COHESION_REVISION_SYSTEM,
    message: `CHANNEL: ${a.channelName}\n\nCREATIVE DIRECTOR NOTE:\n${a.note}\n\nPROMPT:\n${a.prompt}`,
    maxTokens: 4000,
  });
}

/** Rewrites one prompt so the Gate Two mandated element is carried natively. */
export async function applyMandateToPrompt(a: {
  mandate: string;
  channelName: string;
  lensName: string;
  prompt: string;
}): Promise<string> {
  return anthropic({
    system: MANDATE_SYSTEM,
    message: buildMandateMessage(a),
    maxTokens: 4000,
  });
}

export interface MandateComplianceResult {
  verdict: "present" | "weak" | "absent";
  carrier: string;
  reason: string;
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[“”"'’‘–—-]/g, " ")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Deterministic backstop. Live testing showed the judge will happily invent a
 * carrying phrase that is nowhere in the prompt, so a "present" verdict is only
 * trusted when the quoted phrase can actually be found in the prompt — verbatim,
 * or as a run of at least five consecutive words from the quote.
 */
function carrierIsInPrompt(carrier: string, prompt: string): boolean {
  const c = norm(carrier);
  const p = norm(prompt);
  if (c.length < 8) return false;
  if (p.includes(c)) return true;
  const words = c.split(" ");
  const WINDOW = 5;
  if (words.length < WINDOW) return false;
  for (let i = 0; i + WINDOW <= words.length; i++) {
    if (p.includes(words.slice(i, i + WINDOW).join(" "))) return true;
  }
  return false;
}

/**
 * Closed-question check that a mandated element genuinely survived the rewrite
 * in one channel's prompt. Cheap, and the only thing standing between "we asked
 * the model to carry it" and "we know it did".
 */
export async function checkMandateCompliance(a: {
  mandate: string;
  channelName: string;
  lensName: string;
  prompt: string;
}): Promise<MandateComplianceResult> {
  const text = await anthropic({
    system: MANDATE_COMPLIANCE_SYSTEM,
    message: buildMandateComplianceMessage(a),
    maxTokens: 700,
  });
  const p = extractJson<Partial<MandateComplianceResult>>(text);
  let verdict: MandateComplianceResult["verdict"] =
    p.verdict === "absent" ? "absent" : p.verdict === "weak" ? "weak" : "present";
  const carrier = (p.carrier ?? "").trim();
  let reason = (p.reason ?? "").trim();

  if (verdict !== "absent" && !carrierIsInPrompt(carrier, a.prompt)) {
    verdict = "absent";
    reason = `No carrying phrase found in the prompt — the judge cited "${carrier.slice(0, 120)}", which does not appear in it. ${reason}`.trim();
  }

  return { verdict, carrier, reason };
}

