import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/done-for-you")({
  beforeLoad: () => {
    throw redirect({ to: "/consulting", statusCode: 301 });
  },
});