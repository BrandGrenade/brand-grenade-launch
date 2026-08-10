// Research Synthesiser — claim-level extraction, classification, verification,
// and structured field composition. Server-only.
//
// Step 1: read each uploaded blob, extract discrete classifiable claims.
// Step 2: each claim gets one-or-more of the six real categories + a source
//         type (externally-verifiable vs client-proprietary).
// Step 3: externally-verifiable claims are batched per category and run
//         through the existing runStageFactVerification web-search auditor.
//         Client-proprietary claims skip verification and get attribution.
// Step 4: compose structured, attributed entries per category field.

import { parseJsonLenient } from "@/lib/loc/json-sanitize";
import { runStageFactVerification } from "@/lib/fact-verify.server";
import {
  SYNTHESISER_CATEGORIES,
  type SynthesisedClaim,
  type SynthesiserCategory,
  type SynthesiserDocument,
  type SynthesiserResult,
  type SourceType,
  type VerificationStatus,
} from "./types";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-6";
const REQUEST_TIMEOUT_MS = 180_000;

/** Per-document text cap sent to the classifier (cost/latency control). */
const MAX_DOC_CHARS = 90_000;
const MAX_CLAIMS_PER_DOC = 40;

const CATEGORY_KEYS = SYNTHESISER_CATEGORIES.map((c) => c.key);

function categoryBlock(): string {
  return SYNTHESISER_CATEGORIES.map(
    (c) => `- "${c.key}" — ${c.title}: ${c.scope}`,
  ).join("\n");
}

const EXTRACT_SYSTEM = `You are a research intake analyst. You receive the raw extracted plain text of ONE research document. The text may be messy, unsorted, and cover several unrelated topics — a single market report often carries competitive intelligence, cultural signal and consumer research at once.

Your job is NOT to classify the document. Your job is to find every individually classifiable insight INSIDE it and file each one.

For each discrete claim or finding you extract:

1. CLAIM — one self-contained sentence stating the finding, including any figure, date, segment name or attribution present in the source. Under 300 characters. Never invent numbers or detail not present in the text. Do not extract headings, contents pages, disclaimers, boilerplate or page furniture.

2. CATEGORIES — one or more of these exact keys. Assign more than one ONLY when the claim genuinely belongs to more than one:
${categoryBlock()}

3. SOURCE TYPE — exactly one:
- "externally_verifiable" — public market statistics, published research, competitor activity, regulation, media/cultural reporting, anything a journalist could check against public sources.
- "client_proprietary" — the client's own paid or internal material: their commissioned survey data, brand tracker waves, CRM/sales/transaction data, internal segmentation, first-party research, unpublished workshop or stakeholder input. This data is real and valuable but is NOT publicly searchable, so it must never be routed to web verification.

When genuinely ambiguous, prefer "client_proprietary" — wrongly flagging real proprietary data as unverified is the worse failure.

Output ONLY a single JSON object, no prose, no markdown fences:

{"claims":[{"claim":"...","categories":["input_cultural_trends"],"source_type":"externally_verifiable"}]}

Return at most ${MAX_CLAIMS_PER_DOC} claims, prioritising the most load-bearing. If the document contains nothing classifiable, return {"claims":[]}.`;

interface RawClaim {
  claim?: unknown;
  categories?: unknown;
  source_type?: unknown;
}

async function callClaude(system: string, user: string): Promise<string> {
  const apiKey = process.env["ANTHROPIC_API_KEY"];
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const resp = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 8000,
        system,
        messages: [{ role: "user", content: user }],
      }),
      signal: controller.signal,
    });
    if (!resp.ok) {
      const body = await resp.text().catch(() => "");
      throw new Error(`Anthropic ${resp.status}: ${body.slice(0, 300)}`);
    }
    const json = (await resp.json()) as {
      content?: { type?: string; text?: string }[];
    };
    return (json.content ?? [])
      .filter((b) => b.type === "text")
      .map((b) => b.text ?? "")
      .join("");
  } finally {
    clearTimeout(timeout);
  }
}

function normaliseCategories(value: unknown): SynthesiserCategory[] {
  const list = Array.isArray(value) ? value : [value];
  const out: SynthesiserCategory[] = [];
  for (const v of list) {
    if (typeof v !== "string") continue;
    const key = v.trim() as SynthesiserCategory;
    if (CATEGORY_KEYS.includes(key) && !out.includes(key)) out.push(key);
  }
  return out;
}

async function extractClaimsFromDocument(
  doc: SynthesiserDocument,
  brandName: string,
  category: string,
): Promise<SynthesisedClaim[]> {
  const text = doc.text.slice(0, MAX_DOC_CHARS);
  const truncated = doc.text.length > MAX_DOC_CHARS;
  const user = `Brand under analysis: ${brandName}
Category: ${category}
Source document: ${doc.name}${truncated ? " (text truncated for length)" : ""}

--- BEGIN DOCUMENT TEXT ---
${text}
--- END DOCUMENT TEXT ---

Extract every individually classifiable claim. Begin your response with { and end with }.`;

  const raw = await callClaude(EXTRACT_SYSTEM, user);
  const parsed = parseJsonLenient(raw) as { claims?: RawClaim[] } | null;
  const claims = Array.isArray(parsed?.claims) ? parsed!.claims! : [];

  const out: SynthesisedClaim[] = [];
  for (const c of claims) {
    const claimText = typeof c.claim === "string" ? c.claim.trim() : "";
    if (claimText.length < 12) continue;
    const cats = normaliseCategories(c.categories);
    if (cats.length === 0) cats.push("input_bg_intel_pack");
    const sourceType: SourceType =
      c.source_type === "externally_verifiable"
        ? "externally_verifiable"
        : "client_proprietary";
    out.push({
      claim: claimText.slice(0, 400),
      categories: cats,
      sourceType,
      sourceDocument: doc.name,
      status: sourceType === "client_proprietary" ? "client_supplied" : "not_checked",
    });
  }
  return out.slice(0, MAX_CLAIMS_PER_DOC);
}

function normaliseForMatch(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function overlapScore(a: string, b: string): number {
  const at = new Set(normaliseForMatch(a).split(" ").filter((w) => w.length > 3));
  const bt = new Set(normaliseForMatch(b).split(" ").filter((w) => w.length > 3));
  if (at.size === 0 || bt.size === 0) return 0;
  let hit = 0;
  for (const w of at) if (bt.has(w)) hit++;
  return hit / Math.min(at.size, bt.size);
}

/** Batch externally-verifiable claims per category through the existing auditor. */
async function verifyCategoryBatch(
  categoryKey: SynthesiserCategory,
  claims: SynthesisedClaim[],
  brandName: string,
  category: string,
  warnings: string[],
): Promise<void> {
  if (claims.length === 0) return;
  const title =
    SYNTHESISER_CATEGORIES.find((c) => c.key === categoryKey)?.title ?? categoryKey;
  const doc = `# ${title} — externally-verifiable claims extracted from uploaded research\n\n${claims
    .map((c, i) => `${i + 1}. Real Fact: ${c.claim} (source: ${c.sourceDocument})`)
    .join("\n")}\n`;

  const outcome = await runStageFactVerification({
    stageKey: "synthesiser",
    output: doc,
    brandName,
    category,
  });

  if (!outcome.ranSearch) {
    warnings.push(
      `${title}: fact verification did not run (${outcome.error ?? "unknown error"}). Claims are marked unchecked.`,
    );
    return;
  }

  for (const claim of claims) {
    let best: { score: number; verdict: VerificationStatus; note: string } | null = null;
    for (const r of outcome.results) {
      const score = overlapScore(claim.claim, r.claim);
      if (score >= 0.5 && (!best || score > best.score)) {
        best = { score, verdict: r.verdict as VerificationStatus, note: r.note };
      }
    }
    if (best) {
      claim.status = best.verdict;
      claim.note = best.note;
    } else {
      claim.status = "unverified";
      claim.note = "Not corroborated in the verification pass.";
    }
  }
}

function statusLabel(claim: SynthesisedClaim): string {
  switch (claim.status) {
    case "verified":
      return "✅ Verified";
    case "unverified":
      return "⚠️ UNVERIFIED — requires human confirmation";
    case "contradicted":
      return "❌ CONTRADICTED by live search";
    case "client_supplied":
      return "🔒 Client-supplied — not independently checked";
    default:
      return "• Not checked";
  }
}

function composeField(
  categoryKey: SynthesiserCategory,
  claims: SynthesisedClaim[],
): string {
  if (claims.length === 0) return "";
  const title =
    SYNTHESISER_CATEGORIES.find((c) => c.key === categoryKey)?.title ?? categoryKey;
  const lines = claims.map((c, i) => {
    const attribution =
      c.sourceType === "client_proprietary"
        ? `Per ${c.sourceDocument}, client-supplied`
        : `Per ${c.sourceDocument}`;
    const note = c.note ? `\n   Note: ${c.note}` : "";
    return `${i + 1}. ${c.claim}\n   Source: ${attribution}\n   Status: ${statusLabel(c)}${note}`;
  });
  return `${title} — synthesised from uploaded research (${claims.length} entr${claims.length === 1 ? "y" : "ies"})\n\n${lines.join("\n\n")}\n`;
}

export async function synthesiseResearchDocuments(args: {
  brandName: string;
  category: string;
  documents: SynthesiserDocument[];
}): Promise<SynthesiserResult> {
  const warnings: string[] = [];

  const settled = await Promise.allSettled(
    args.documents.map((d) =>
      extractClaimsFromDocument(d, args.brandName, args.category),
    ),
  );

  const claims: SynthesisedClaim[] = [];
  settled.forEach((r, i) => {
    if (r.status === "fulfilled") {
      claims.push(...r.value);
    } else {
      const msg = r.reason instanceof Error ? r.reason.message : String(r.reason);
      warnings.push(
        `${args.documents[i]?.name ?? "document"}: extraction failed (${msg.slice(0, 160)}).`,
      );
    }
  });

  // Verification — externally-verifiable claims only, batched per category.
  const external = claims.filter((c) => c.sourceType === "externally_verifiable");
  let verificationRan = external.length === 0;
  if (external.length > 0) {
    const batches = CATEGORY_KEYS.map((key) => ({
      key,
      list: external.filter((c) => c.categories.includes(key)),
    })).filter((b) => b.list.length > 0);

    // Sequential per category — keeps each batch inside the auditor's claim cap
    // and avoids stacking long web-search calls in parallel. The whole chain
    // runs inside one browser request, so a wall-clock deadline is required:
    // without it six slow web-search batches can outlive the request and the
    // user loses every extracted claim with no error at all.
    const verifyDeadline = Date.now() + VERIFICATION_BUDGET_MS;
    for (const batch of batches) {
      if (Date.now() > verifyDeadline) {
        warnings.push(
          "Verification time budget reached — remaining claims are returned unverified rather than losing the whole synthesis.",
        );
        break;
      }
      try {
        await verifyCategoryBatch(
          batch.key,
          batch.list,
          args.brandName,
          args.category,
          warnings,
        );
        verificationRan = true;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        warnings.push(`Verification batch failed: ${msg.slice(0, 160)}`);
      }
    }

  }

  const fields = Object.fromEntries(
    CATEGORY_KEYS.map((key) => [
      key,
      composeField(
        key,
        claims.filter((c) => c.categories.includes(key)),
      ),
    ]),
  ) as Record<SynthesiserCategory, string>;

  return {
    claims,
    fields,
    stats: {
      totalClaims: claims.length,
      externallyVerifiable: external.length,
      clientProprietary: claims.length - external.length,
      verified: claims.filter((c) => c.status === "verified").length,
      flagged: claims.filter(
        (c) => c.status === "unverified" || c.status === "contradicted",
      ).length,
      verificationRan,
    },
    warnings,
  };
}
