import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { TopNav } from "@/components/TopNav";
import { supabase } from "@/integrations/supabase/client";
import {
  runIntelligenceAnalysis,
  updateAndRerunIntelligenceSession,
} from "@/lib/intelligence.functions";
import {
  IntelligenceForm,
  type BriefType,
  type IntelligenceFormValues,
  type InputMap,
} from "@/components/intelligence/IntelligenceForm";

export const Route = createFileRoute("/intelligence/$id_/edit")({
  head: () => ({
    meta: [
      { title: "Edit Intelligence Inputs — Brand Grenade" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: IntelligenceEditPage,
});

interface Loaded {
  brand: string;
  category: string;
  briefType: BriefType;
  markets: string;
  audienceNotes: string;
  inputs: Partial<InputMap>;
}

function IntelligenceEditPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const updateFn = useServerFn(updateAndRerunIntelligenceSession);
  const runFn = useServerFn(runIntelligenceAnalysis);

  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const { data } = await supabase
        .from("intelligence_sessions")
        .select(
          "id, user_id, brand_name, category, territory_input, additional_context, report_metadata, input_primary_consumer, input_brand_health, input_competitive_audit, input_cultural_trends, input_audience_segmentation, input_bg_intel_pack",
        )
        .eq("id", id)
        .maybeSingle();
      if (!alive) return;
      if (!data) {
        setNotFound(true);
        return;
      }
      const meta = data.report_metadata;
      const briefType: BriefType =
        meta && typeof meta === "object" && !Array.isArray(meta) &&
        (meta as Record<string, unknown>).brief_type === "government"
          ? "government"
          : "commercial";
      setLoaded({
        brand: data.brand_name ?? "",
        category: data.category ?? "",
        briefType,
        markets: data.territory_input ?? "",
        audienceNotes: data.additional_context ?? "",
        inputs: {
          input_primary_consumer: data.input_primary_consumer ?? "",
          input_brand_health: data.input_brand_health ?? "",
          input_competitive_audit: data.input_competitive_audit ?? "",
          input_cultural_trends: data.input_cultural_trends ?? "",
          input_audience_segmentation: data.input_audience_segmentation ?? "",
          input_bg_intel_pack: data.input_bg_intel_pack ?? "",
        },
      });
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  async function handleSubmit(values: IntelligenceFormValues): Promise<void> {
    try {
      await updateFn({
        data: {
          intelligenceSessionId: id,
          ...values,
        },
      });
      void runFn({ data: { intelligenceSessionId: id } }).catch(
        (err: unknown) => {
          console.warn("[Intelligence] re-run failed:", err);
        },
      );
      toast.success("Re-running intelligence analysis…");
      navigate({ to: "/intelligence/$id", params: { id } });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to update session";
      toast.error(msg);
      throw err;
    }
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-background">
        <TopNav />
        <main className="mx-auto max-w-[720px] px-6 py-16">
          <p className="text-body text-text-primary">Session not found.</p>
        </main>
      </div>
    );
  }

  if (!loaded) {
    return (
      <div className="min-h-screen bg-background">
        <TopNav />
        <main className="mx-auto max-w-[720px] px-6 py-16">
          <div className="flex items-center gap-3 text-text-secondary">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        </main>
      </div>
    );
  }

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
        <div className="mx-auto max-w-[1080px]">
          <Link
            to="/intelligence/$id"
            params={{ id }}
            className="inline-flex items-center gap-2 text-label text-text-secondary hover:text-text-primary"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to report
          </Link>

          <div className="mt-6">
            <span className="text-label text-primary">Intelligence Lab</span>
            <h1 className="text-h2 mt-2 text-text-primary">
              Edit Research Inputs — {loaded.brand || "Untitled"}
            </h1>
            <p className="text-body mt-3 max-w-[720px] text-text-secondary">
              Update any field below and re-run the analysis. The existing
              session will be updated in place — the URL and session ID stay
              the same. A previous Briefing Room handoff is preserved.
            </p>
          </div>

          <IntelligenceForm
            initialBrand={loaded.brand}
            initialCategory={loaded.category}
            initialBriefType={loaded.briefType}
            initialMarkets={loaded.markets}
            initialAudienceNotes={loaded.audienceNotes}
            initialInputs={loaded.inputs}
            submitLabel="Re-run Intelligence Analysis"
            submittingLabel="Re-running…"
            cancelHref="/intelligence/$id"
            cancelLabel="Back to report"
            onSubmit={handleSubmit}
          />
        </div>
      </main>
    </div>
  );
}
