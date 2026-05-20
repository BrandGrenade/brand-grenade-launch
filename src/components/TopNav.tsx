import { Link } from "@tanstack/react-router";

export function TopNav() {
  return (
    <nav className="flex h-14 items-center justify-between border-b border-border bg-background px-5 sm:px-8">
      <Link
        to="/dashboard"
        className="text-label text-text-primary"
        style={{ letterSpacing: "0.12em" }}
      >
        Brand Grenade
      </Link>

      <div className="flex items-center gap-3">
        <div
          aria-label="Account"
          className="flex h-8 w-8 items-center justify-center rounded-full"
          style={{ backgroundColor: "var(--color-border)" }}
        >
          <span className="text-body-sm text-text-secondary">BG</span>
        </div>
        <Link
          to="/brief"
          className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-[13px] font-semibold text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          New Run
        </Link>
      </div>
    </nav>
  );
}
