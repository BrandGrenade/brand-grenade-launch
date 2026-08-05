import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { TopNav } from "@/components/TopNav";
import {
  createIntelligenceSession,
  runIntelligenceAnalysis,
} from "@/lib/intelligence.functions";
import { consumeSynthesiserHandoff } from "@/lib/synthesiser/handoff";
import {
  IntelligenceForm,
  type IntelligenceFormValues,
} from "@/components/intelligence/IntelligenceForm";


const searchSchema = z.object({
  brand: z.string().optional(),
});

export const Route = createFileRoute("/intelligence/new")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "Strategic Territory Intelligence Lab — Brand Grenade" },
      {
        name: "description",
        content:
          "Provide research inputs. The Intelligence Lab produces a ranked strategic territory intelligence report.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: IntelligenceNewPage,
});

function IntelligenceNewPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const createFn = useServerFn(createIntelligenceSession);
  const runFn = useServerFn(runIntelligenceAnalysis);
  // Room 00 is optional. When it was skipped there is no handoff and the form
  // renders exactly as it always has.
  const [handoff] = useState(() => consumeSynthesiserHandoff());
  const [initialBrand] = useState(handoff?.brand || (search.brand ?? ""));


  async function handleSubmit(values: IntelligenceFormValues): Promise<void> {
    try {
      const { sessionId } = await createFn({ data: values });
      void runFn({ data: { intelligenceSessionId: sessionId } }).catch(
        (err: unknown) => {
          console.warn("[Intelligence] run failed:", err);
        },
      );
      navigate({ to: "/intelligence/$id", params: { id: sessionId } });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to create session";
      toast.error(msg);
      throw err;
    }
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
            to="/dashboard"
            className="inline-flex items-center gap-2 text-label text-text-secondary hover:text-text-primary"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to dashboard
          </Link>

          <div className="mt-6">
            <span className="text-label text-text-secondary">Intelligence Lab</span>
            <h1 className="text-h2 mt-2 text-text-primary">
              Strategic Territory Intelligence Lab
            </h1>
            <p className="text-body mt-3 max-w-[720px] text-text-secondary">
              Provide your research inputs below. The Intelligence Lab analyses
              all inputs simultaneously and produces a ranked strategic
              territory intelligence report. Paste text, upload files
              (PDF, DOCX, PPTX, XLSX, CSV, TXT), or both.
            </p>
          </div>

          <IntelligenceForm
            initialBrand={initialBrand}
            submitLabel="Start Intelligence Lab"
            submittingLabel="Starting analysis…"
            cancelHref="/dashboard"
            onSubmit={handleSubmit}
          />
        </div>
      </main>
    </div>
  );
}
