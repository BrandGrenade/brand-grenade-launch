import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/brief")({
  component: BriefLayout,
});

function BriefLayout() {
  return <Outlet />;
}