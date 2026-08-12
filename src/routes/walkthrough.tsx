import { Outlet, createFileRoute } from "@tanstack/react-router";
import { RequireAuth } from "@/components/RequireAuth";

export const Route = createFileRoute("/walkthrough")({
  component: () => (
    <RequireAuth>
      <Outlet />
    </RequireAuth>
  ),
});
