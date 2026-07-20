import { createFileRoute } from "@tanstack/react-router";

// Proxy route: streams a repository document with a browser-correct
// Content-Type. Supabase Storage force-serves HTML as `text/plain` with
// `X-Content-Type-Options: nosniff` on private buckets (anti-XSS), which
// prevents inline rendering even when the stored mimetype is text/html.
// This route re-serves the bytes with the right header after auth check.

export const Route = createFileRoute("/api/repo/view/$documentId")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const documentId = params.documentId;
        const url = new URL(request.url);
        const action = url.searchParams.get("action") === "download" ? "download" : "open";
        const isAdminPreview = url.searchParams.get("admin") === "1";

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { visitorSession, adminSession } = await import("@/lib/repo/session.server");

        // Look up document + slug
        const { data: doc, error: dErr } = await supabaseAdmin
          .from("repository_documents")
          .select("id, title, storage_path, repository_slug, file_type")
          .eq("id", documentId)
          .maybeSingle();
        if (dErr) return new Response(dErr.message, { status: 500 });
        if (!doc) return new Response("Not found", { status: 404 });

        // Auth: either the matching visitor session, or admin session for preview
        let visitorId: string | null = null;
        let visitorName: string | null = null;
        if (isAdminPreview) {
          const s = await adminSession();
          if (!s.data.unlocked) return new Response("Unauthorized", { status: 401 });
        } else {
          const s = await visitorSession(doc.repository_slug);
          if (!s.data.visitorId || s.data.repositorySlug !== doc.repository_slug) {
            return new Response("Unauthorized", { status: 401 });
          }
          visitorId = s.data.visitorId;
          visitorName = s.data.visitorName ?? null;
        }

        // Fetch bytes via service role (bypasses the storage HTML content-type override)
        const { data: blob, error: fErr } = await supabaseAdmin.storage
          .from("repository-documents")
          .download(doc.storage_path);
        if (fErr || !blob) return new Response(fErr?.message ?? "Fetch failed", { status: 500 });

        // Determine content-type
        const ext = doc.storage_path.toLowerCase().split(".").pop() ?? "";
        let contentType = "application/octet-stream";
        if (doc.file_type === "html" || ext === "html" || ext === "htm") {
          contentType = "text/html; charset=utf-8";
        } else if (doc.file_type === "pdf" || ext === "pdf") {
          contentType = "application/pdf";
        } else if (ext === "png") contentType = "image/png";
        else if (ext === "jpg" || ext === "jpeg") contentType = "image/jpeg";
        else if (ext === "gif") contentType = "image/gif";
        else if (ext === "svg") contentType = "image/svg+xml";
        else if (ext === "txt") contentType = "text/plain; charset=utf-8";
        else if (ext === "json") contentType = "application/json; charset=utf-8";

        // Log real visitor opens; skip logging for admin preview
        if (!isAdminPreview && visitorId) {
          const h = request.headers;
          const ip =
            h.get("cf-connecting-ip") ??
            h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
            h.get("x-real-ip") ??
            null;
          await supabaseAdmin.from("repository_access_log").insert({
            repository_slug: doc.repository_slug,
            visitor_id: visitorId,
            visitor_name: visitorName,
            event_type: action,
            document_id: doc.id,
            document_title: doc.title,
            ip_address: ip,
            user_agent: h.get("user-agent"),
          });
        }

        const headers: Record<string, string> = {
          "content-type": contentType,
          "cache-control": "private, no-store",
          "x-content-type-options": "nosniff",
        };
        if (action === "download") {
          const safe = doc.title.replace(/"/g, "");
          headers["content-disposition"] = `attachment; filename="${safe}"`;
        } else {
          headers["content-disposition"] = "inline";
        }

        const buf = await blob.arrayBuffer();
        return new Response(buf, { status: 200, headers });
      },
    },
  },
});
