import { Link, useRouterState } from "@tanstack/react-router";

/**
 * Low-contrast global footer. Currently hosts the discreet "Admin" link
 * that routes to /admin/tests (Tier 1 / Tier 2 integrity panels).
 *
 * Hidden on client-facing repository routes and admin preview so no
 * internal navigation leaks to visitors.
 */
const HIDDEN_PREFIXES = ["/ey", "/kpmg", "/deck", "/admin"];

export function AppFooter() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (HIDDEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return null;
  }
  return (
    <footer
      style={{
        borderTop: "1px solid #1C1C1C",
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
          e.currentTarget.style.color = "#8A8680";
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
