// Partner Hub sender. Woken by the database when an item is queued, and by a
// retry tick that exists only while items are waiting. It only delivers rows
// already in the outbox, so an unauthenticated call cannot send anything new.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hub-tick")({
  server: {
    handlers: {
      POST: async () => {
        const { drainHubOutbox } = await import("@/lib/hub.server");
        const r = await drainHubOutbox();
        return Response.json(r);
      },
    },
  },
});
