import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const SLUGS = ["ey", "kpmg", "deck"] as const;
const slugSchema = z.enum(SLUGS);

async function requireAdmin() {
  const { adminSession } = await import("./repo/session.server");
  const s = await adminSession();
  if (!s.data.unlocked) throw new Error("Unauthorized");
}

export const adminLogin = createServerFn({ method: "POST" })
  .inputValidator((d: { password: string }) => ({
    password: z.string().min(1).max(200).parse(d.password),
  }))
  .handler(async ({ data }) => {
    const { adminSession, verifyAdminPassword } = await import("./repo/session.server");
    if (!verifyAdminPassword(data.password)) return { ok: false as const };
    const s = await adminSession();
    await s.update({ unlocked: true });
    return { ok: true as const };
  });

export const adminLogout = createServerFn({ method: "POST" }).handler(async () => {
  const { adminSession } = await import("./repo/session.server");
  const s = await adminSession();
  await s.clear();
  return { ok: true as const };
});

export const adminStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { adminSession } = await import("./repo/session.server");
  const s = await adminSession();
  return { unlocked: !!s.data.unlocked };
});

// ---- Visitor management ----

export const listVisitors = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: (typeof SLUGS)[number] }) => ({ slug: slugSchema.parse(d.slug) }))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: visitors, error } = await supabaseAdmin
      .from("repository_visitors")
      .select("id, name, organisation, email, created_at")
      .eq("repository_slug", data.slug)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { visitors: visitors ?? [] };
  });

export const createVisitor = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      slug: (typeof SLUGS)[number];
      name: string;
      organisation?: string;
      email?: string;
      password: string;
    }) => ({
      slug: slugSchema.parse(d.slug),
      name: z.string().min(1).max(200).parse(d.name),
      organisation: d.organisation ? z.string().max(200).parse(d.organisation) : null,
      email: d.email ? z.string().email().max(200).parse(d.email) : null,
      password: z.string().min(6).max(200).parse(d.password),
    }),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { hashPassword } = await import("./repo/session.server");
    const { error } = await supabaseAdmin.from("repository_visitors").insert({
      repository_slug: data.slug,
      name: data.name,
      organisation: data.organisation,
      email: data.email,
      password_hash: hashPassword(data.password),
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const deleteVisitor = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => ({ id: z.string().uuid().parse(d.id) }))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("repository_visitors").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const resetVisitorPassword = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string; password: string }) => ({
    id: z.string().uuid().parse(d.id),
    password: z.string().min(6).max(200).parse(d.password),
  }))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { hashPassword } = await import("./repo/session.server");
    const { error } = await supabaseAdmin
      .from("repository_visitors")
      .update({ password_hash: hashPassword(data.password) })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

// ---- Document management ----

export const listDocuments = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: (typeof SLUGS)[number] }) => ({ slug: slugSchema.parse(d.slug) }))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: docs, error } = await supabaseAdmin
      .from("repository_documents")
      .select("id, title, description, file_type, storage_path, display_order, created_at")
      .eq("repository_slug", data.slug)
      .order("display_order", { ascending: true });
    if (error) throw new Error(error.message);
    return { documents: docs ?? [] };
  });

export const uploadDocument = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      slug: (typeof SLUGS)[number];
      title: string;
      description?: string;
      fileName: string;
      fileType: "pdf" | "html" | "other";
      fileBase64: string;
      contentType: string;
      displayOrder?: number;
    }) => ({
      slug: slugSchema.parse(d.slug),
      title: z.string().min(1).max(300).parse(d.title),
      description: d.description ? z.string().max(2000).parse(d.description) : null,
      fileName: z.string().min(1).max(300).parse(d.fileName),
      fileType: z.enum(["pdf", "html", "other"]).parse(d.fileType),
      fileBase64: z.string().min(1).parse(d.fileBase64),
      contentType: z.string().min(1).max(200).parse(d.contentType),
      displayOrder: typeof d.displayOrder === "number" ? d.displayOrder : 0,
    }),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const buf = Buffer.from(data.fileBase64, "base64");
    // 25 MB cap
    if (buf.byteLength > 25 * 1024 * 1024) throw new Error("File exceeds 25MB");
    const safeName = data.fileName.replace(/[^a-zA-Z0-9._-]+/g, "_");
    const path = `${data.slug}/${crypto.randomUUID()}-${safeName}`;
    const { error: upErr } = await supabaseAdmin.storage
      .from("repository-documents")
      .upload(path, buf, { contentType: data.contentType, upsert: false });
    if (upErr) throw new Error(upErr.message);
    const { error } = await supabaseAdmin.from("repository_documents").insert({
      repository_slug: data.slug,
      title: data.title,
      description: data.description,
      file_type: data.fileType,
      storage_path: path,
      display_order: data.displayOrder ?? 0,
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const deleteDocument = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => ({ id: z.string().uuid().parse(d.id) }))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: doc } = await supabaseAdmin
      .from("repository_documents")
      .select("storage_path")
      .eq("id", data.id)
      .maybeSingle();
    if (doc?.storage_path) {
      await supabaseAdmin.storage.from("repository-documents").remove([doc.storage_path]);
    }
    const { error } = await supabaseAdmin.from("repository_documents").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

// ---- Access log / stats ----

export const getRepoStats = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: (typeof SLUGS)[number] }) => ({ slug: slugSchema.parse(d.slug) }))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const nowMs = Date.now();
    const weekIso = new Date(nowMs - 7 * 86400000).toISOString();
    const monthIso = new Date(nowMs - 30 * 86400000).toISOString();

    async function count(sinceIso: string | null) {
      let q = supabaseAdmin
        .from("repository_access_log")
        .select("id", { count: "exact", head: true })
        .eq("repository_slug", data.slug)
        .eq("event_type", "visit");
      if (sinceIso) q = q.gte("created_at", sinceIso);
      const { count: c, error } = await q;
      if (error) throw new Error(error.message);
      return c ?? 0;
    }

    const [week, month, all, logRes, visitorRes] = await Promise.all([
      count(weekIso),
      count(monthIso),
      count(null),
      supabaseAdmin
        .from("repository_access_log")
        .select("id, visitor_id, visitor_name, event_type, document_title, ip_address, created_at")
        .eq("repository_slug", data.slug)
        .order("created_at", { ascending: false })
        .limit(500),
      supabaseAdmin
        .from("repository_visitors")
        .select("id, name, organisation, email")
        .eq("repository_slug", data.slug),
    ]);
    if (logRes.error) throw new Error(logRes.error.message);
    if (visitorRes.error) throw new Error(visitorRes.error.message);

    const logs = logRes.data ?? [];
    const visitors = visitorRes.data ?? [];

    const perVisitor = new Map<
      string,
      {
        id: string;
        name: string;
        organisation: string | null;
        email: string | null;
        visits: number;
        opens: number;
        downloads: number;
        lastAt: string | null;
      }
    >();
    for (const v of visitors) {
      perVisitor.set(v.id, {
        id: v.id,
        name: v.name,
        organisation: v.organisation,
        email: v.email,
        visits: 0,
        opens: 0,
        downloads: 0,
        lastAt: null,
      });
    }
    for (const l of logs) {
      if (!l.visitor_id) continue;
      const p = perVisitor.get(l.visitor_id);
      if (!p) continue;
      if (l.event_type === "visit") p.visits += 1;
      if (l.event_type === "open") p.opens += 1;
      if (l.event_type === "download") p.downloads += 1;
      if (!p.lastAt || (l.created_at && l.created_at > p.lastAt)) p.lastAt = l.created_at;
    }

    return {
      visits: { week, month, all },
      visitors: Array.from(perVisitor.values()).sort((a, b) => {
        return (b.lastAt ?? "").localeCompare(a.lastAt ?? "");
      }),
      recentLog: logs.slice(0, 200),
    };
  });

export const exportRepoLogCsv = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: (typeof SLUGS)[number] }) => ({ slug: slugSchema.parse(d.slug) }))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("repository_access_log")
      .select("created_at, visitor_name, event_type, document_title, ip_address, user_agent")
      .eq("repository_slug", data.slug)
      .order("created_at", { ascending: false })
      .limit(10000);
    if (error) throw new Error(error.message);
    const header = "timestamp,visitor,event,document,ip,user_agent";
    const esc = (s: unknown) => {
      const v = s == null ? "" : String(s);
      return `"${v.replace(/"/g, '""')}"`;
    };
    const body = (rows ?? [])
      .map((r) =>
        [r.created_at, r.visitor_name, r.event_type, r.document_title, r.ip_address, r.user_agent]
          .map(esc)
          .join(","),
      )
      .join("\n");
    return { csv: `${header}\n${body}` };
  });
