import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/briefing-room")({
  component: () => <Outlet />,
});
