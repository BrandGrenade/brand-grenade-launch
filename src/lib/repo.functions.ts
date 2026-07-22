import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

const SLUGS = ["ey", "kpmg", "deck"] as const;
type Slug = (typeof SLUGS)[number];

const slugSchema = z.enum(SLUGS);

function clientIpAndUa(): { ip: string | null; ua: string | null } {
  try {
    const req = getRequest();
    const h = req.headers;
    const ip =
      h.get("cf-connecting-ip") ??
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      h.get("x-real-ip") ??
      null;
    return { ip, ua: h.get("user-agent") };
  } catch {
    return { ip: null, ua: null };
  }
}

export const getRepoSession = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: Slug }) => ({ slug: slugSchema.parse(d.slug) }))
  .handler(async ({ data }) => {
    const { visitorSession } = await import("./repo/session.server");
    const s = await visitorSession(data.slug);
    if (!s.data.visitorId || s.data.repositorySlug !== data.slug) {
      return { unlocked: false as const };
    }
    return {
      unlocked: true as const,
      visitorName: s.data.visitorName ?? "",
    };
  });

export const unlockRepo = createServerFn({ method: "POST" })
  .inputValidator((d: { slug: Slug; password: string }) => ({
    slug: slugSchema.parse(d.slug),
    password: z.string().min(1).max(200).parse(d.password),
  }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { visitorSession, verifyPassword } = await import("./repo/session.server");

    const { data: rows, error } = await supabaseAdmin
      .from("repository_visitors")
      .select("id, name, password_hash, is_active")
      .eq("repository_slug", data.slug)
      .eq("is_active", true);
    if (error) throw new Error(error.message);

    const match = (rows ?? []).find((r) => verifyPassword(data.password, r.password_hash));
    if (!match) return { ok: false as const };

    const s = await visitorSession(data.slug);
    await s.update({
      visitorId: match.id,
      visitorName: match.name,
      repositorySlug: data.slug,
    });

    const { ip, ua } = clientIpAndUa();
    await supabaseAdmin.from("repository_access_log").insert({
      repository_slug: data.slug,
      visitor_id: match.id,
      visitor_name: match.name,
      event_type: "unlock",
      ip_address: ip,
      user_agent: ua,
    });

    return { ok: true as const, visitorName: match.name };
  });

export const logoutRepo = createServerFn({ method: "POST" })
  .inputValidator((d: { slug: Slug }) => ({ slug: slugSchema.parse(d.slug) }))
  .handler(async ({ data }) => {
    const { visitorSession } = await import("./repo/session.server");
    const s = await visitorSession(data.slug);
    await s.clear();
    return { ok: true as const };
  });

export const logRepoVisit = createServerFn({ method: "POST" })
  .inputValidator((d: { slug: Slug }) => ({ slug: slugSchema.parse(d.slug) }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { visitorSession } = await import("./repo/session.server");
    const s = await visitorSession(data.slug);
    if (!s.data.visitorId || s.data.repositorySlug !== data.slug) {
      return { ok: false as const };
    }
    const { ip, ua } = clientIpAndUa();
    await supabaseAdmin.from("repository_access_log").insert({
      repository_slug: data.slug,
      visitor_id: s.data.visitorId,
      visitor_name: s.data.visitorName ?? null,
      event_type: "visit",
      ip_address: ip,
      user_agent: ua,
    });
    return { ok: true as const };
  });

export const listRepoDocuments = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: Slug }) => ({ slug: slugSchema.parse(d.slug) }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { visitorSession } = await import("./repo/session.server");
    const s = await visitorSession(data.slug);
    if (!s.data.visitorId || s.data.repositorySlug !== data.slug) {
      throw new Error("Unauthorized");
    }
    const { data: docs, error } = await supabaseAdmin
      .from("repository_documents")
      .select("id, title, description, file_type, storage_path, display_order, created_at")
      .eq("repository_slug", data.slug)
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return { documents: docs ?? [] };
  });

export const openRepoDocument = createServerFn({ method: "POST" })
  .inputValidator((d: { slug: Slug; documentId: string; action: "open" | "download" }) => ({
    slug: slugSchema.parse(d.slug),
    documentId: z.string().uuid().parse(d.documentId),
    action: z.enum(["open", "download"]).parse(d.action),
  }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { visitorSession } = await import("./repo/session.server");
    const s = await visitorSession(data.slug);
    if (!s.data.visitorId || s.data.repositorySlug !== data.slug) {
      throw new Error("Unauthorized");
    }

    const { data: doc, error: dErr } = await supabaseAdmin
      .from("repository_documents")
      .select("id, title, storage_path, file_type")
      .eq("id", data.documentId)
      .eq("repository_slug", data.slug)
      .maybeSingle();
    if (dErr) throw new Error(dErr.message);
    if (!doc) throw new Error("Document not found");

    const { data: signed, error: sErr } = await supabaseAdmin.storage
      .from("repository-documents")
      .createSignedUrl(doc.storage_path, 60 * 10, {
        download: data.action === "download" ? doc.title : undefined,
      });
    if (sErr || !signed) throw new Error(sErr?.message ?? "Signed URL failed");

    const { ip, ua } = clientIpAndUa();
    await supabaseAdmin.from("repository_access_log").insert({
      repository_slug: data.slug,
      visitor_id: s.data.visitorId,
      visitor_name: s.data.visitorName ?? null,
      event_type: data.action,
      document_id: doc.id,
      document_title: doc.title,
      ip_address: ip,
      user_agent: ua,
    });

    return { url: signed.signedUrl };
  });
