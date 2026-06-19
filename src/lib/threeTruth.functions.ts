// Server functions for the Phase 2 Three Truth Canvas.
// - prepareThreeTruths: Extracts Product Truth (from Stage 13), Consumer Truth
//   (from Stage 5), and proposes a Cultural Truth via Claude using Stage 2/3.
// - saveCulturalTruth / saveBrandIntelligence: persistence.
// - extractBrandGuidelinesFromPdf: Claude PDF reading for Option A auto-fill.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callClaude } from "@/lib/claude.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertSessionOwner } from "@/lib/auth-helpers.server";

const MODEL = "claude-sonnet-4-5";

// --- prepareThreeTruths --------------------------------------------------

export const prepareThreeTruths = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { sessionId: string }) =>
    z.object({ sessionId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertSessionOwner(data.sessionId, context.userId);
    const { data: row, error } = await supabaseAdmin
      .from("sessions")
      .select(
        "id, brand_name, category, selected_smp, stage_2_output, stage_3_output, stage_5_output, stage_13_output, truth_product, truth_consumer, truth_cultural, truth_cultural_confidence, truth_cultural_confirmed",
      )
      .eq("id", data.sessionId)
      .single();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Session not found");

    // If we already have all three truths, return them as-is (idempotent).
    if (row.truth_product && row.truth_consumer && row.truth_cultural) {
      return {
        product: row.truth_product,
        consumer: row.truth_consumer,
        cultural: row.truth_cultural,
        culturalConfidence: row.truth_cultural_confidence ?? "MEDIUM",
        culturalConfirmed: Boolean(row.truth_cultural_confirmed),
      };
    }

    const system = `You extract concise strategic truths from longer strategy documents.
Return ONLY a valid JSON object — no prose, no markdown fences.
Each truth must be ONE sentence, maximum 30 words, written in confident declarative English.`;

    const user = `Brand: ${row.brand_name ?? "Untitled"}
Category: ${row.category ?? ""}
SMP: ${row.selected_smp ?? ""}

=== STAGE 13 OUTPUT (Product Truth Alignment) ===
${(row.stage_13_output ?? "").slice(0, 8000)}

=== STAGE 5 OUTPUT (Human Contradiction Statement) ===
${(row.stage_5_output ?? "").slice(0, 8000)}

=== STAGE 2 OUTPUT (Category / Competitive Intelligence) ===
${(row.stage_2_output ?? "").slice(0, 6000)}

=== STAGE 3 OUTPUT (Strategic Frameworks / Brand World) ===
${(row.stage_3_output ?? "").slice(0, 6000)}

Return JSON:
{
  "product_truth": "<one-sentence Product Truth derived from Stage 13>",
  "consumer_truth": "<one-sentence Consumer Truth derived from the Stage 5 Human Contradiction Statement>",
  "cultural_truth": "<one-sentence proposed Cultural Truth derived from Stage 2 + Stage 3 — a real cultural tension or shift the brand can ride>",
  "cultural_confidence": "HIGH | MEDIUM | LOW"
}`;

    const raw = await callClaude({
      systemPrompt: system,
      userMessage: user,
      model: MODEL,
      maxTokens: 64000,
      sessionId: data.sessionId,
      stageLabel: "Three Truths",
    });

    const parsed = extractJson(raw);
    const product = (parsed.product_truth ?? "").toString().trim();
    const consumer = (parsed.consumer_truth ?? "").toString().trim();
    const cultural = (parsed.cultural_truth ?? "").toString().trim();
    const confidence = normaliseConfidence(parsed.cultural_confidence);

    await supabaseAdmin
      .from("sessions")
      .update({
        truth_product: product || row.truth_product,
        truth_consumer: consumer || row.truth_consumer,
        truth_cultural: row.truth_cultural ?? cultural,
        truth_cultural_confidence:
          row.truth_cultural_confidence ?? confidence,
      })
      .eq("id", data.sessionId);

    return {
      product: product || row.truth_product || "",
      consumer: consumer || row.truth_consumer || "",
      cultural: row.truth_cultural ?? cultural,
      culturalConfidence: row.truth_cultural_confidence ?? confidence,
      culturalConfirmed: Boolean(row.truth_cultural_confirmed),
    };
  });

// --- saveCulturalTruth ---------------------------------------------------

export const saveCulturalTruth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { sessionId: string; text: string; confirm?: boolean }) =>
    z
      .object({
        sessionId: z.string().uuid(),
        text: z.string().min(1).max(2000),
        confirm: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertSessionOwner(data.sessionId, context.userId);
    const { error } = await supabaseAdmin
      .from("sessions")
      .update({
        truth_cultural: data.text.trim(),
        truth_cultural_confirmed: data.confirm ?? false,
      })
      .eq("id", data.sessionId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// --- saveBrandIntelligence ----------------------------------------------

const assetSchema = z.object({
  name: z.string().min(1).max(500),
  strength: z.enum(["strong", "weak", "convention"]),
});

export const saveBrandIntelligence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      sessionId: string;
      type: "existing" | "new";
      values?: string;
      tone?: string;
      assets?: Array<{ name: string; strength: "strong" | "weak" | "convention" }>;
      confirmed?: boolean;
    }) =>
      z
        .object({
          sessionId: z.string().uuid(),
          type: z.enum(["existing", "new"]),
          values: z.string().max(5000).optional(),
          tone: z.string().max(5000).optional(),
          assets: z.array(assetSchema).max(50).optional(),
          confirmed: z.boolean().optional(),
        })
        .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertSessionOwner(data.sessionId, context.userId);
    const baseUpdate = {
      brand_intel_type: data.type,
      brand_intel_confirmed: data.confirmed ?? false,
    };
    const update =
      data.type === "existing"
        ? {
            ...baseUpdate,
            brand_intel_values: data.values ?? "",
            brand_intel_tone: data.tone ?? "",
            brand_intel_assets: (data.assets ?? []) as unknown as never,
          }
        : {
            ...baseUpdate,
            brand_intel_values: null,
            brand_intel_tone: null,
            brand_intel_assets: null,
          };
    const { error } = await supabaseAdmin
      .from("sessions")
      .update(update)
      .eq("id", data.sessionId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// --- extractBrandGuidelinesFromPdf --------------------------------------

export const extractBrandGuidelinesFromPdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { sessionId: string; pdfBase64: string }) =>
    z
      .object({
        sessionId: z.string().uuid(),
        pdfBase64: z.string().min(100).max(15_000_000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured");

    const body = JSON.stringify({
      model: MODEL,
      max_tokens: 2000,
      system: `You extract brand guideline information from PDF documents.
Return ONLY a valid JSON object — no prose, no markdown fences.`,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: data.pdfBase64,
              },
            },
            {
              type: "text",
              text: `Extract from this brand guidelines PDF and return JSON:
{
  "values": "<comma-separated list of the brand's defined values>",
  "tone": "<key tone-of-voice descriptors, comma-separated>",
  "assets": [
    { "name": "<distinctive asset — visual, verbal, sonic, or tonal>", "strength": "strong | weak | convention" }
  ]
}
If the PDF doesn't contain enough data for a field, return an empty string or empty array.
Assess each asset's strength honestly: "strong" = ownable and distinctive,
"weak" = present but not yet distinctive, "convention" = category-standard.`,
            },
          ],
        },
      ],
    });

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body,
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Claude PDF extraction failed: ${resp.status} ${text.slice(0, 300)}`);
    }
    const json = (await resp.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const text = (json.content ?? [])
      .filter((b) => b.type === "text")
      .map((b) => b.text ?? "")
      .join("");
    const parsed = extractJson(text);
    const values = (parsed.values ?? "").toString();
    const tone = (parsed.tone ?? "").toString();
    const assetsRaw = Array.isArray(parsed.assets) ? parsed.assets : [];
    const assets = assetsRaw
      .map((a: { name?: unknown; strength?: unknown }) => ({
        name: typeof a.name === "string" ? a.name.trim() : "",
        strength: normaliseStrength(a.strength),
      }))
      .filter((a: { name: string }) => a.name.length > 0)
      .slice(0, 30);
    return { values, tone, assets };
  });

// --- helpers -------------------------------------------------------------

function extractJson(raw: string): Record<string, unknown> {
  const trimmed = raw.trim().replace(/^```json\s*/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch {
        /* fall through */
      }
    }
    return {};
  }
}

function normaliseConfidence(v: unknown): "HIGH" | "MEDIUM" | "LOW" {
  const s = String(v ?? "").toUpperCase();
  if (s === "HIGH" || s === "MEDIUM" || s === "LOW") return s;
  return "MEDIUM";
}

function normaliseStrength(v: unknown): "strong" | "weak" | "convention" {
  const s = String(v ?? "").toLowerCase();
  if (s.startsWith("strong")) return "strong";
  if (s.startsWith("conv") || s.includes("convention")) return "convention";
  return "weak";
}
