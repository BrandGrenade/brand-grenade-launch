// New server-side document generation system.
//
// Replaces browser PDF rendering. Generates a complete HTML document
// section-by-section via Anthropic, uploads it to Supabase Storage, and
// returns a signed URL for the client to open in a new tab. The user
// prints to PDF natively from the browser.
//
// Yields progress events so the UI can show "Writing: <section>" status,
// and writes the per-format status/URL to the sessions table so a poller
// can also observe progress.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  buildHtmlDocument,
  getSectionDefs,
  type DocFormat,
  type SessionLike,
} from "./document-generator.server";

// Direct Anthropic call with 30s timeout + retry + fallback.
// Used in place of the streaming callClaude here because each section
// is small (≤1200 tokens) and we want a hard per-section ceiling so a
// single slow/empty response cannot block the whole document.
async function callAnthropic(
  systemPrompt: string,
  userMessage: string,
  maxTokens: number,
  sectionName = "unknown",
  retries = 2,
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured");

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-5",
          max_tokens: maxTokens,
          messages: [{ role: "user", content: userMessage }],
          system: systemPrompt,
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const t = await response.text().catch(() => "");
        throw new Error(`API error: ${response.status} ${t.slice(0, 200)}`);
      }
      const data = (await response.json()) as { content?: Array<{ text?: string }> };
      const text = data?.content?.[0]?.text ?? "";
      console.error(
        `[section: ${sectionName}] Response length: ${text?.length} First 200 chars: ${text?.substring(0, 200)}`,
      );
      if (!text || text.trim().length < 50) {
        throw new Error("Empty response");
      }
      return text.trim();
    } catch (err) {
      if (attempt === retries) {
        const msg = err instanceof Error ? err.message : "unknown error";
        console.error(`[generateDocument] section call failed after ${retries + 1} attempts: ${msg}`);
        return `This section could not be generated. Please regenerate the document.`;
      }
      await new Promise((r) => setTimeout(r, 5000));
    } finally {
      clearTimeout(timeout);
    }
  }
  return "";
}

const Input = z.object({
  sessionId: z.string().uuid(),
  format: z.enum(["consulting", "agency", "workshop"]),
  force: z.boolean().optional(),
});

const URL_COLS: Record<DocFormat, "doc_consulting_url" | "doc_agency_url" | "doc_workshop_url"> = {
  consulting: "doc_consulting_url",
  agency: "doc_agency_url",
  workshop: "doc_workshop_url",
};
const STATUS_COLS: Record<
  DocFormat,
  "doc_consulting_status" | "doc_agency_status" | "doc_workshop_status"
> = {
  consulting: "doc_consulting_status",
  agency: "doc_agency_status",
  workshop: "doc_workshop_status",
};

const SIGNED_URL_TTL = 60 * 60 * 24 * 7; // 7 days

// Schedule background work on Cloudflare via ctx.waitUntil when available,
// otherwise fall back to firing the promise unawaited (best-effort).
function scheduleBackground(p: Promise<unknown>): void {
  const ctx = (globalThis as unknown as { __cfCtx?: { waitUntil?: (p: Promise<unknown>) => void } })
    .__cfCtx;
  const wu = ctx?.waitUntil?.bind(ctx);
  if (typeof wu === "function") {
    wu(p.catch((e) => console.error("[generateDocument bg]", e)));
  } else {
    // Best-effort fallback (local dev / no Workers ctx).
    void p.catch((e) => console.error("[generateDocument bg]", e));
  }
}

async function runGeneration(sessionId: string, format: DocFormat): Promise<void> {

  const { data: session, error } = await supabaseAdmin
    .from("sessions")
    .select("*")
    .eq("id", sessionId)
    .single();
  if (error || !session) {
    console.error(`[generateDocument] session not found: ${error?.message ?? "no row"}`);
    return;
  }

  const sessionForSections: SessionLike = {
    brand_name: session.brand_name,
    category: session.category,
    selected_smp: session.selected_smp,
    stage_1_output: session.stage_1_output,
    stage_2_output: session.stage_2_output,
    stage_5_output: session.stage_5_output,
    stage_7_output: session.stage_7_output,
    stage_8_output: session.stage_8_output,
    stage_10_output: session.stage_10_output,
    stage_11_output: session.stage_11_output,
    stage_12_output: session.stage_12_output,
    stage_13_output: session.stage_13_output,
    stage_14_output: session.stage_14_output,
    stage_14b_output: session.stage_14b_output,
    stage_14c_output: session.stage_14c_output,
    stage_15_output: session.stage_15_output,
  };

  const sectionDefs = getSectionDefs(format, sessionForSections);

  try {
    const results = await runInBatches(sectionDefs, 3);


    const sections: Record<string, string> = {};
    for (const r of results) sections[r.name] = r.content;

    const html = buildHtmlDocument(sections, sessionForSections, format);
    const filename = `${sessionId}/${format}.html`;
    const htmlBytes = new TextEncoder().encode(html);

    const { error: uploadError } = await supabaseAdmin.storage
      .from("documents")
      .upload(filename, htmlBytes, {
        contentType: "text/html; charset=utf-8",
        upsert: true,
      });
    if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

    const { data: signed, error: signError } = await supabaseAdmin.storage
      .from("documents")
      .createSignedUrl(filename, SIGNED_URL_TTL);
    if (signError || !signed?.signedUrl) {
      throw new Error(`Sign URL failed: ${signError?.message ?? "no url"}`);
    }

    const readyUpdate =
      format === "consulting"
        ? { doc_consulting_status: "ready", doc_consulting_url: signed.signedUrl }
        : format === "agency"
          ? { doc_agency_status: "ready", doc_agency_url: signed.signedUrl }
          : { doc_workshop_status: "ready", doc_workshop_url: signed.signedUrl };
    await supabaseAdmin.from("sessions").update(readyUpdate).eq("id", sessionId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Document generation failed";
    console.error(`[generateDocument] failed: ${msg}`);
    const errorUpdate =
      format === "consulting"
        ? { doc_consulting_status: "error" }
        : format === "agency"
          ? { doc_agency_status: "error" }
          : { doc_workshop_status: "error" };
    await supabaseAdmin.from("sessions").update(errorUpdate).eq("id", sessionId);
  }
}

export const generateDocument = createServerFn({ method: "POST" })
  .inputValidator((i) => Input.parse(i))
  .handler(async ({ data }) => {
    const { sessionId, format, force } = data;
    const urlCol = URL_COLS[format];
    const statusCol = STATUS_COLS[format];

    const { data: session, error } = await supabaseAdmin
      .from("sessions")
      .select(`id, ${urlCol}, ${statusCol}`)
      .eq("id", sessionId)
      .single();
    if (error || !session) {
      throw new Error(`Session not found: ${error?.message ?? "no row"}`);
    }

    // Reuse cached doc unless force.
    if (!force) {
      const existingUrl = (session as Record<string, unknown>)[urlCol] as
        | string
        | null
        | undefined;
      const existingStatus = (session as Record<string, unknown>)[statusCol] as
        | string
        | null
        | undefined;
      if (existingStatus === "ready" && existingUrl) {
        return { status: "ready" as const, url: existingUrl, format, sessionId, cached: true };
      }
    }

    // Mark generating immediately and respond. Generation continues in the
    // background via ctx.waitUntil (Cloudflare Workers), so it isn't subject
    // to the per-request timeout. The client polls doc_<format>_status.
    const generatingUpdate =
      format === "consulting"
        ? { doc_consulting_status: "generating", doc_consulting_url: null }
        : format === "agency"
          ? { doc_agency_status: "generating", doc_agency_url: null }
          : { doc_workshop_status: "generating", doc_workshop_url: null };
    await supabaseAdmin.from("sessions").update(generatingUpdate).eq("id", sessionId);

    scheduleBackground(runGeneration(sessionId, format));

    return { status: "generating" as const, url: null, format, sessionId, cached: false };
  });

