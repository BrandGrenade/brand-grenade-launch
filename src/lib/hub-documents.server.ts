// Turns a queued document reference into the actual file the user would
// download from that Room, rendered to PDF. Under 5 MB it travels inline as
// base64; larger files go to private storage with a 24-hour signed link.
// Never a page link.

const INLINE_LIMIT = 5 * 1024 * 1024;
const LINK_TTL_SECONDS = 24 * 60 * 60;

export type HubDocument =
  | { name: string; mime: string; content_base64: string }
  | { name: string; mime: string; url: string };

export type ResolvedDoc =
  | { ok: true; document: HubDocument; bytes: number; delivery: "file" | "link" }
  | { ok: false; reason: string };

async function sourceHtml(ref: string): Promise<{ html: string; fileBase: string }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  if (ref.startsWith("intel:")) {
    const id = ref.slice(6);
    const { data: s, error } = await supabaseAdmin.from("intelligence_sessions").select("*").eq("id", id).maybeSingle();
    if (error || !s?.final_report) throw new Error("Intelligence report not found");
    const { buildDocument00AMinto } = await import("./intelligence/doc-00A-minto");
    const { researchEvidenceFromSession } = await import("./intelligence/research-evidence");
    const meta = (s.report_metadata ?? {}) as Record<string, unknown>;
    const html = buildDocument00AMinto({
      sourceRunId: s.id,
      brandName: s.brand_name || "Brand",
      category: s.category || "",
      briefType: meta.brief_type === "government" ? "government" : "commercial",
      completedAt: s.completed_at ?? s.updated_at,
      report: JSON.parse(s.final_report),
      research: researchEvidenceFromSession(s as unknown as Record<string, unknown>),
      revision: meta.doc00a_revision as number,
      runRef: meta.doc00a_run_ref as string,
      regeneratedAt: meta.doc00a_regenerated_at as string,
    } as never);
    return { html, fileBase: `Strategic-Territory-Intelligence-Report-${(s.brand_name || "brand").replace(/[^A-Za-z0-9]+/g, "-")}` };
  }
  if (ref.startsWith("session:")) {
    const [, id, format] = ref.split(":");
    if (!id || !["consulting", "agency", "workshop"].includes(format ?? "")) throw new Error("Bad document reference");
    const { data, error } = await supabaseAdmin.storage.from("documents").download(`${id}/${format}.html`);
    if (error || !data) throw new Error(`Stored ${format} document not found`);
    return { html: await data.text(), fileBase: `${format}-document-${id.slice(0, 8)}` };
  }
  throw new Error("This document type cannot be generated as a file");
}

async function renderPdf(html: string): Promise<Uint8Array> {
  const key = process.env["BROWSERLESS_API_KEY"];
  if (!key) throw new Error("PDF renderer not configured");
  const res = await fetch(`https://production-sfo.browserless.io/pdf?token=${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ html, options: { printBackground: true, preferCSSPageSize: true, format: "A4" } }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!res.ok) throw new Error(`PDF render failed (${res.status})`);
  return new Uint8Array(await res.arrayBuffer());
}

export async function resolveHubDocument(name: string, ref: string, outboxId: string): Promise<ResolvedDoc> {
  try {
    const { html, fileBase } = await sourceHtml(ref);
    const pdf = await renderPdf(html);
    const fileName = `${fileBase}.pdf`;
    if (pdf.byteLength < INLINE_LIMIT) {
      return {
        ok: true,
        bytes: pdf.byteLength,
        delivery: "file",
        document: { name: fileName, mime: "application/pdf", content_base64: Buffer.from(pdf).toString("base64") },
      };
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const path = `hub/${outboxId}/${fileName}`;
    const up = await supabaseAdmin.storage.from("documents").upload(path, pdf, { contentType: "application/pdf", upsert: true });
    if (up.error) throw new Error(`Upload failed: ${up.error.message}`);
    const { data: signed, error } = await supabaseAdmin.storage.from("documents").createSignedUrl(path, LINK_TTL_SECONDS);
    if (error || !signed?.signedUrl) throw new Error("Could not create download link");
    return { ok: true, bytes: pdf.byteLength, delivery: "link", document: { name: fileName, mime: "application/pdf", url: signed.signedUrl } };
  } catch (e) {
    void name;
    return { ok: false, reason: (e instanceof Error ? e.message : "File generation failed").slice(0, 500) };
  }
}
