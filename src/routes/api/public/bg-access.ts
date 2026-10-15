// BG access point (read only). Callers authenticate with an access key in the
// x-bg-access-key header; the handler checks it before reading anything.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/bg-access")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleAccessRequest } = await import("@/lib/access/access.server");
        return handleAccessRequest(request);
      },
      GET: async () =>
        Response.json(
          { request_id: crypto.randomUUID(), error_code: "invalid_request", message: "POST only." },
          { status: 405, headers: { allow: "POST" } },
        ),
    },
  },
});
