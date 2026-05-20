import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Brand Grenade" },
      { name: "description", content: "Brand Grenade — design system ready." },
    ],
  }),
});

function Index() {
  return (
    <main className="min-h-screen bg-background text-text-primary">
      <div className="mx-auto max-w-3xl px-6 py-24">
        <span className="text-label text-primary">Brand Grenade</span>
        <h1 className="text-display mt-3">Design system ready.</h1>
        <p className="text-body-lg mt-4 text-text-secondary">
          Tokens, typography, spacing, radii and shadows are wired into{" "}
          <code className="text-mono text-primary">src/styles.css</code>. No
          screens have been built yet — ready for your first one.
        </p>

        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="bg-card-surface p-5">
            <div className="text-label text-text-tertiary">Accent</div>
            <div className="mt-3 flex items-center gap-3">
              <span className="h-10 w-10 rounded-md bg-primary" />
              <div>
                <div className="text-body">#C8873A</div>
                <div className="text-body-sm text-text-secondary">primary</div>
              </div>
            </div>
          </div>
          <div className="bg-card-surface p-5">
            <div className="text-label text-text-tertiary">Type</div>
            <div className="mt-3 text-h3">Inter · JetBrains Mono</div>
            <div className="text-mono mt-1 text-text-secondary">13px mono sample</div>
          </div>
        </div>
      </div>
    </main>
  );
}
