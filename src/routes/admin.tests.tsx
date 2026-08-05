import { createFileRoute, Link } from "@tanstack/react-router";
import { TopNav } from "@/components/TopNav";
import { PreflightFullCheckPanel } from "@/components/PreflightFullCheckPanel";
import { PreflightStatusBanner } from "@/components/PreflightStatusBanner";
import { Stage20RescorePanel } from "@/components/Stage20RescorePanel";

export const Route = createFileRoute("/admin/tests")({
  head: () => ({
    meta: [
      { title: "Admin — Platform Tests" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminTestsPage,
});

function AdminTestsPage() {
  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <main
        className="px-5 py-10 sm:px-8 lg:px-8 lg:py-12"
        style={{
          paddingLeft: "max(20px, min(32px, 5vw))",
          paddingRight: "max(20px, min(32px, 5vw))",
        }}
      >
        <div className="mx-auto max-w-[1280px]">
          <header className="mb-8">
            <span className="text-label text-primary">Admin</span>
            <h1 className="text-h2 mt-3 text-text-primary">Platform Tests</h1>
            <p className="text-body mt-2 text-text-secondary">
              Tier One and Tier Two integrity checks. Not for client
              presentation.{" "}
              <Link to="/dashboard" style={{ color: "#C81E1E" }}>
                Back to dashboard
              </Link>
              {" · "}
              <Link to="/admin/repositories" style={{ color: "#C81E1E" }}>
                Repositories admin
              </Link>
              .
            </p>
          </header>

          <PreflightFullCheckPanel />
          <PreflightStatusBanner />
          <Stage20RescorePanel />
        </div>
      </main>
    </div>
  );
}
