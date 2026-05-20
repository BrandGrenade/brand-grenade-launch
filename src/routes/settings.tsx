import { createFileRoute } from "@tanstack/react-router";
import { TopNav } from "@/components/TopNav";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
  head: () => ({
    meta: [
      { title: "Settings — Brand Grenade" },
      { name: "description", content: "Account and workspace settings." },
    ],
  }),
});

function SettingsPage() {
  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <main className="mx-auto max-w-[800px] px-5 py-12 sm:px-8">
        <span className="text-label text-primary">Account</span>
        <h1 className="text-h2 mt-3 text-text-primary">Settings</h1>
        <p className="text-body mt-3 text-text-secondary">
          Settings will live here. Nothing to configure yet.
        </p>
      </main>
    </div>
  );
}
