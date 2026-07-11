import { createFileRoute, Link } from "@tanstack/react-router";
import { TopNav } from "@/components/TopNav";

export const Route = createFileRoute("/intelligence/new")({
  head: () => ({
    meta: [
      { title: "Intelligence Engine — Coming Soon" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: IntelligenceNewPage,
});

function IntelligenceNewPage() {
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
        <div className="mx-auto max-w-[720px] pt-12">
          <span className="text-label text-primary">Intelligence Engine</span>
          <h1 className="text-h2 mt-3 text-text-primary">Coming soon</h1>
          <p className="text-body mt-3 text-text-secondary">
            The Strategic Territory Intelligence Engine is scheduled for a
            subsequent build. This route is reserved as its entry point so
            the platform launch strip is complete now.
          </p>
          <div className="mt-8">
            <Link
              to="/dashboard"
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "10px 20px",
                borderRadius: 8,
                border: "1px solid #D4924A",
                color: "#D4924A",
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              Back to dashboard
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
