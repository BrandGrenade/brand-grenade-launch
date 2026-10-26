import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/jlr-mandate-recovery")({
  server: { handlers: { POST: async ({ request }) => {
    const token = request.headers.get("authorization")?.replace(/^Bearer /i, "");
    if (!token) return new Response("Sign in required", { status: 401 });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data.user) return new Response("Sign in required", { status: 401 });
    const { assertSessionAccess } = await import("@/lib/auth-helpers.server");
    try { await assertSessionAccess("3470f1ad-b322-4230-8e3d-bf0072e95b7a", data.user.id); }
    catch { return new Response("Forbidden", { status: 403 }); }
    const { recoverJlrMandate } = await import("@/lib/stimulus/jlr-mandate-recovery.server");
    const userId = data.user.id;
    const encoder = new TextEncoder();
    const body = new ReadableStream({ async start(controller) {
      const emit = (value: object) => { try { controller.enqueue(encoder.encode(JSON.stringify(value) + "\n")); } catch { /* disconnected observer */ } };
      const timer = setInterval(() => emit({ keepalive: true }), 5000);
      try { const result = await recoverJlrMandate(userId, (message) => emit({ message })); emit({ done: true, ...result }); }
      catch (e) { emit({ done: true, error: e instanceof Error ? e.message : "Recovery failed" }); }
      finally { clearInterval(timer); try { controller.close(); } catch { /* disconnected observer */ } }
    } });
    return new Response(body, { headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store" } });
  } } },
});