import { Outlet, createFileRoute } from "@tanstack/react-router";
import { RequireAuth } from "@/components/RequireAuth";

export const Route = createFileRoute("/synthesiser")({
  component: () => (
    <RequireAuth>
      <Outlet />
    </RequireAuth>
  ),
});
