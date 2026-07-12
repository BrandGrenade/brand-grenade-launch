import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { TopNav } from "@/components/TopNav";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/intelligence/$id")({
  head: () => ({
    meta: [
      { title: "Intelligence run — Brand Grenade" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: IntelligenceRunPage,
});

function IntelligenceRunPage() {
  const { id } = Route.useParams();
  const [status, setStatus] = useState<string | null>(null);
  const [brand, setBrand] = useState<string>("");

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      const { data } = await supabase
        .from("intelligence_sessions")
        .select("status, stage_status, brand_name")
        .eq("id", id)
        .maybeSingle();
      if (!alive || !data) return;
      setStatus(data.stage_status ?? data.status ?? null);
      setBrand(data.brand_name ?? "");
    };
    void tick();
    const int = setInterval(tick, 3000);
    return () => {
      alive = false;
      clearInterval(int);
    };
  }, [id]);

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <main className="mx-auto max-w-[720px] px-6 py-16">
        <span className="text-label text-primary">Intelligence Engine</span>
        <h1 className="text-h2 mt-2 text-text-primary">
          {brand || "Analysis in progress"}
        </h1>
        <Card className="mt-8 p-6">
          <div className="flex items-center gap-3">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span className="text-body text-text-primary">
              {status ?? "Starting…"}
            </span>
          </div>
          <p className="text-sm text-text-secondary mt-3">
            The engine is running a single streaming call across 10 analytical
            layers. This page updates every few seconds.
          </p>
        </Card>
        <div className="mt-6">
          <Link to="/dashboard" className="text-label text-text-secondary hover:text-text-primary">
            ← Back to dashboard
          </Link>
        </div>
      </main>
    </div>
  );
}
