import { Link, useRouterState } from "@tanstack/react-router";

/**
 * Low-contrast global footer. Currently hosts the discreet "Admin" link
 * that routes to /admin/tests (Tier 1 / Tier 2 integrity panels).
 *
 * Hidden on client-facing repository routes and admin preview so no
 * internal navigation leaks to visitors.
 */
// Allowlist: internal app surfaces only. Anything else (homepage, login and
// every current or future client repository slug) never renders internal nav.
const INTERNAL_PREFIXES = [
  "/dashboard",
  "/pipeline",
  "/intelligence",
  "/briefing-room",
  "/brief",
  "/detonation",
  "/complete",
  "/settings",
];

export function AppFooter() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isInternal =
    pathname === "/" ||
    INTERNAL_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
  if (!isInternal) return null;
  return (
    <footer
      style={{
        borderTop: "1px solid #1C1A18",
        padding: "16px 24px",
        marginTop: 48,
        display: "flex",
        justifyContent: "flex-end",
      }}
    >
      <Link
        to="/admin/tests"
        style={{
          color: "#3A3632",
          fontSize: 11,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          textDecoration: "none",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = "#8B8680";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = "#3A3632";
        }}
      >
        Admin
      </Link>
    </footer>
  );
}
