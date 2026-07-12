import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { ArrowLeft, Check, Circle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { TopNav } from "@/components/TopNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createIntelligenceSession,
  runIntelligenceAnalysis,
} from "@/lib/intelligence.functions";

const searchSchema = z.object({
  brand: z.string().optional(),
});

export const Route = createFileRoute("/intelligence/new")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "Strategic Territory Intelligence Engine — Brand Grenade" },
      {
        name: "description",
        content:
          "Provide research inputs. The engine produces a ranked strategic territory intelligence report.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: IntelligenceNewPage,
});

type BriefType = "commercial" | "government";

interface SectionSpec {
  key:
    | "input_primary_consumer"
    | "input_brand_health"
    | "input_competitive_audit"
    | "input_cultural_trends"
    | "input_audience_segmentation"
    | "input_bg_intel_pack";
  number: string;
  title: string;
  description: string;
  helper: string;
}

const SECTIONS: SectionSpec[] = [
  {
    key: "input_primary_consumer",
    number: "01",
    title: "Primary Consumer Research",
    description:
      "Quantitative consumer attitude studies, brand perception surveys, category usage and attitude studies.",
    helper: "Absence reduces confidence in perceptual and emotional white space mapping.",
  },
  {
    key: "input_brand_health",
    number: "02",
    title: "Brand Health Tracking Data",
    description:
      "Longitudinal brand health metrics — awareness, consideration, preference, brand association strength over time.",
    helper: "Absence reduces confidence in hermit crab vulnerability identification.",
  },
  {
    key: "input_competitive_audit",
    number: "03",
    title: "Competitive Communications Audit",
    description:
      "What competitors are currently saying across advertising, PR, social, and owned content.",
    helper: "Absence reduces confidence in competitive vulnerability mapping.",
  },
  {
    key: "input_cultural_trends",
    number: "04",
    title: "Cultural Trend Analysis",
    description:
      "Cultural intelligence reports, social listening data, media trend reporting.",
    helper: "Absence reduces confidence in moment-activated opportunity identification.",
  },
  {
    key: "input_audience_segmentation",
    number: "05",
    title: "Audience Segmentation Research",
    description:
      "Defined audience segments by attitude, behaviour, need state, or cultural identity.",
    helper: "Absence reduces confidence in audience readiness assessment.",
  },
  {
    key: "input_bg_intel_pack",
    number: "06",
    title: "Brand Grenade Intelligence Pack",
    description: "The standard Brand Grenade pre-pipeline intelligence document.",
    helper: "Functions as research substitute when primary research is not available.",
  },
];

type InputMap = Record<SectionSpec["key"], string>;

const EMPTY_INPUTS: InputMap = {
  input_primary_consumer: "",
  input_brand_health: "",
  input_competitive_audit: "",
  input_cultural_trends: "",
  input_audience_segmentation: "",
  input_bg_intel_pack: "",
};

function IntelligenceNewPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const createFn = useServerFn(createIntelligenceSession);
  const runFn = useServerFn(runIntelligenceAnalysis);

  const [brand, setBrand] = useState(search.brand ?? "");
  const [category, setCategory] = useState("");
  const [briefType, setBriefType] = useState<BriefType>("commercial");
  const [markets, setMarkets] = useState("");
  const [audienceNotes, setAudienceNotes] = useState("");
  const [inputs, setInputs] = useState<InputMap>(EMPTY_INPUTS);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<{
    brand?: string;
    category?: string;
    inputs?: string;
  }>({});

  const presentCount = useMemo(
    () => SECTIONS.filter((s) => inputs[s.key].trim().length > 0).length,
    [inputs],
  );

  const confidence: "High" | "Moderate" | "Low" =
    presentCount >= 4 ? "High" : presentCount >= 2 ? "Moderate" : "Low";

  const confidenceColor =
    confidence === "High"
      ? "#22C55E"
      : confidence === "Moderate"
        ? "#D4924A"
        : "#94A3B8";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;

    const nextErrors: typeof errors = {};
    if (brand.trim().length < 1) nextErrors.brand = "Brand name is required";
    if (category.trim().length < 1) nextErrors.category = "Category is required";
    if (presentCount < 1)
      nextErrors.inputs = "Provide at least one research input below";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      toast.error("Please complete the required fields");
      return;
    }

    setBusy(true);
    try {
      const { sessionId } = await createFn({
        data: {
          brand_name: brand.trim(),
          category: category.trim(),
          brief_type: briefType,
          markets: markets.trim() || null,
          audience_context_notes: audienceNotes.trim() || null,
          input_primary_consumer: inputs.input_primary_consumer.trim() || null,
          input_brand_health: inputs.input_brand_health.trim() || null,
          input_competitive_audit: inputs.input_competitive_audit.trim() || null,
          input_cultural_trends: inputs.input_cultural_trends.trim() || null,
          input_audience_segmentation:
            inputs.input_audience_segmentation.trim() || null,
          input_bg_intel_pack: inputs.input_bg_intel_pack.trim() || null,
        },
      });
      // Fire and forget — the /intelligence/$id page polls the row.
      void runFn({ data: { intelligenceSessionId: sessionId } }).catch(
        (err: unknown) => {
          console.warn("[Intelligence] run failed:", err);
        },
      );
      navigate({ to: "/intelligence/$id", params: { id: sessionId } });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to create session";
      toast.error(msg);
      setBusy(false);
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
            <span className="text-label text-primary">Intelligence Engine</span>
            <h1 className="text-h2 mt-2 text-text-primary">
              Strategic Territory Intelligence Engine
            </h1>
            <p className="text-body mt-3 max-w-[720px] text-text-secondary">
              Provide your research inputs below. The engine analyses all inputs
              simultaneously and produces a ranked strategic territory
              intelligence report.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-10 grid gap-8 lg:grid-cols-[1fr_320px]">
            <div className="space-y-8">
              {/* Framing fields */}
              <Card className="p-6">
                <h2 className="text-h4 text-text-primary">Brief framing</h2>
                <div className="mt-5 grid gap-5 md:grid-cols-2">
                  <div>
                    <Label htmlFor="brand">Brand name *</Label>
                    <Input
                      id="brand"
                      value={brand}
                      onChange={(e) => setBrand(e.target.value)}
                      maxLength={200}
                      className="mt-1.5"
                    />
                    {errors.brand ? (
                      <p className="mt-1.5 text-xs text-destructive">{errors.brand}</p>
                    ) : null}
                  </div>
                  <div>
                    <Label htmlFor="category">Category *</Label>
                    <Input
                      id="category"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      maxLength={200}
                      className="mt-1.5"
                    />
                    {errors.category ? (
                      <p className="mt-1.5 text-xs text-destructive">{errors.category}</p>
                    ) : null}
                  </div>
                  <div>
                    <Label htmlFor="briefType">Brief type</Label>
                    <Select
                      value={briefType}
                      onValueChange={(v) => setBriefType(v as BriefType)}
                    >
                      <SelectTrigger id="briefType" className="mt-1.5">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="commercial">Commercial</SelectItem>
                        <SelectItem value="government">Government</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="markets">Markets</Label>
                    <Input
                      id="markets"
                      value={markets}
                      onChange={(e) => setMarkets(e.target.value)}
                      placeholder="e.g. Australia, United Kingdom"
                      maxLength={500}
                      className="mt-1.5"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="audience">Audience context notes</Label>
                    <Input
                      id="audience"
                      value={audienceNotes}
                      onChange={(e) => setAudienceNotes(e.target.value)}
                      placeholder="e.g. Multicultural focus, CALD communities, specific demographic segments"
                      maxLength={2000}
                      className="mt-1.5"
                    />
                  </div>
                </div>
              </Card>

              {/* Six research input sections */}
              {SECTIONS.map((s) => {
                const present = inputs[s.key].trim().length > 0;
                return (
                  <Card key={s.key} className="p-6">
                    <div className="flex items-baseline gap-3">
                      <span
                        className="text-label"
                        style={{ color: present ? "#22C55E" : "#94A3B8" }}
                      >
                        {s.number}
                      </span>
                      <div className="flex-1">
                        <h3 className="text-h4 text-text-primary">{s.title}</h3>
                        <p className="text-sm mt-1 text-text-secondary">{s.description}</p>
                        <p className="text-xs mt-1 italic text-text-secondary/80">
                          {s.helper}
                        </p>
                      </div>
                    </div>
                    <Textarea
                      value={inputs[s.key]}
                      onChange={(e) =>
                        setInputs((prev) => ({ ...prev, [s.key]: e.target.value }))
                      }
                      placeholder="Paste content here…"
                      className="mt-4 min-h-[160px] font-mono text-xs"
                      maxLength={200_000}
                    />
                  </Card>
                );
              })}

              {errors.inputs ? (
                <p className="text-sm text-destructive">{errors.inputs}</p>
              ) : null}

              <div className="flex items-center justify-end gap-3">
                <Link
                  to="/dashboard"
                  className="text-label text-text-secondary hover:text-text-primary"
                >
                  Cancel
                </Link>
                <Button type="submit" disabled={busy} size="lg">
                  {busy ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Starting analysis…
                    </>
                  ) : (
                    "Run Intelligence Engine"
                  )}
                </Button>
              </div>
            </div>

            {/* Completeness preview */}
            <aside className="lg:sticky lg:top-24 lg:self-start">
              <Card className="p-5">
                <h2 className="text-h5 text-text-primary">Completeness preview</h2>
                <p className="text-xs text-text-secondary mt-1">
                  Updates live as you fill in sections.
                </p>

                <div className="mt-4 space-y-2">
                  {SECTIONS.map((s) => {
                    const present = inputs[s.key].trim().length > 0;
                    return (
                      <div key={s.key} className="flex items-start gap-2.5 text-xs">
                        {present ? (
                          <Check
                            className="h-4 w-4 flex-shrink-0 mt-0.5"
                            style={{ color: "#22C55E" }}
                          />
                        ) : (
                          <Circle
                            className="h-4 w-4 flex-shrink-0 mt-0.5"
                            style={{ color: "#475569" }}
                          />
                        )}
                        <span
                          className={present ? "text-text-primary" : "text-text-secondary"}
                        >
                          {s.number} · {s.title}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div
                  className="mt-5 pt-4 border-t"
                  style={{ borderColor: "rgba(148,163,184,0.15)" }}
                >
                  <div className="flex items-baseline justify-between">
                    <span className="text-label text-text-secondary">
                      Predicted confidence
                    </span>
                    <span
                      className="text-h4 font-semibold"
                      style={{ color: confidenceColor }}
                    >
                      {confidence}
                    </span>
                  </div>
                  <p className="text-xs text-text-secondary mt-1.5">
                    {presentCount} of 6 inputs present
                  </p>
                </div>
              </Card>
            </aside>
          </form>
        </div>
      </main>
    </div>
  );
}
