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
import { callClaude } from "./claude.server";
import {
  buildHtmlDocument,
  getSectionDefs,
  type DocFormat,
  type SessionLike,
} from "./document-generator.server";

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

export const generateDocument = createServerFn({ method: "POST" })
  .inputValidator((i) => Input.parse(i))
  .handler(async function* ({ data }) {
    const { sessionId, format, force } = data;
    const urlCol = URL_COLS[format];
    const statusCol = STATUS_COLS[format];

    const { data: session, error } = await supabaseAdmin
      .from("sessions")
      .select("*")
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
        yield { done: true as const, url: existingUrl, format, cached: true };
        return;
      }
    }

    // Mark generating
    const generatingUpdate =
      format === "consulting"
        ? { doc_consulting_status: "generating", doc_consulting_url: null }
        : format === "agency"
          ? { doc_agency_status: "generating", doc_agency_url: null }
          : { doc_workshop_status: "generating", doc_workshop_url: null };
    await supabaseAdmin
      .from("sessions")
      .update(generatingUpdate)
      .eq("id", sessionId);

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
    const sections: Record<string, string> = {};

    try {
      for (let i = 0; i < sectionDefs.length; i++) {
        const def = sectionDefs[i];
        yield {
          section: { index: i, total: sectionDefs.length, name: def.name },
        };
        try {
          sections[def.name] = await callClaude({
            systemPrompt: def.systemPrompt,
            userMessage: def.userMessage,
            maxTokens: def.maxTokens,
            temperature: 0.7,
            sessionId,
            stageLabel: `Document — ${def.name}`,
            stageNumber: "16",
            stageName: "Document Assembly",
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : "section call failed";
          sections[def.name] = `*[Section "${def.name}" could not be generated: ${msg}]*`;
        }
      }

      yield { section: { index: sectionDefs.length, total: sectionDefs.length, name: "assembling" } };

      const html = buildHtmlDocument(sections, sessionForSections, format);
      const filename = `${sessionId}/${format}.html`;

      const { error: uploadError } = await supabaseAdmin.storage
        .from("documents")
        .upload(filename, html, {
          contentType: "text/html",
          upsert: true,
        });
      if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

      const { data: signed, error: signError } = await supabaseAdmin.storage
        .from("documents")
        .createSignedUrl(filename, SIGNED_URL_TTL);
      if (signError || !signed?.signedUrl) {
        throw new Error(`Sign URL failed: ${signError?.message ?? "no url"}`);
      }

      await supabaseAdmin
        .from("sessions")
        .update({ [statusCol]: "ready", [urlCol]: signed.signedUrl })
        .eq("id", sessionId);

      yield { done: true as const, url: signed.signedUrl, format, cached: false };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Document generation failed";
      await supabaseAdmin
        .from("sessions")
        .update({ [statusCol]: "error" })
        .eq("id", sessionId);
      throw new Error(msg);
    }
  });
