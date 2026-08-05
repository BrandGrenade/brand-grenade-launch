import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Circle,
  Download,
  Loader2,
  Send,
  Star,
} from "lucide-react";
import { toast } from "sonner";
import { TopNav } from "@/components/TopNav";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { supabase } from "@/integrations/supabase/client";
import {
  createBriefingRoomFromIntelligence,
} from "@/lib/intelligence.functions";
import { downloadDocument00APdf } from "@/lib/intelligence/pdf-00A";


export const Route = createFileRoute("/intelligence/$id")({
  head: () => ({
    meta: [
      { title: "Intelligence report — Brand Grenade" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: IntelligenceRunPage,
});

// ── Types ────────────────────────────────────────────────────────────────

type BriefType = "commercial" | "government";
type ResonanceRating = "high" | "moderate" | "low" | "counterproductive";
type RiskClass = "low" | "medium" | "high" | "very_high";

interface WhiteSpaceCell {
  assessment?: string;
  evidence?: string;
  territory_type?: "rational" | "emotional" | "both";
}
interface BrandPermission {
  score?: number;
  rationale?: string;
  permission_sources?: string[];
  permission_gaps?: string[];
}
interface FirstMover {
  score?: number;
  adoption_curve_stage?: string;
  competitive_response_scenario?: string;
  window_duration?: string;
  investment_threshold?: string;
}
interface HermitCrab {
  shell_value?: string;
  vacancy_timeline?: string;
  return_risk?: "low" | "medium" | "high";
  shape_compatibility?: string;
  vacancy_type?: string;
}
interface CulturalAdaptation {
  resonance_overall?: ResonanceRating;
  resonance_by_context?: { context?: string; rating?: ResonanceRating; notes?: string }[];
  adaptation_requirement?: string;
  cultural_risk_flags?: string[];
  cald_mapping?: null | {
    communities?: { community?: string; resonance?: string; adaptation?: string }[];
  };
}
interface HistoricalValidation {
  risk_classification?: RiskClass;
  risk_rationale?: string;
  commercial_precedents?: { case_description?: string; outcome?: string; structural_conditions?: string }[];
  government_precedents?: { case_description?: string; outcome?: string; structural_conditions?: string }[];
}
interface MeasurementFramework {
  brand_associations_to_track?: string[];
  competitive_response_signals?: string[];
  behaviour_change_metrics?: {
    immediate_0_4_weeks?: string[];
    short_term_3_6_months?: string[];
    medium_term_12_24_months?: string[];
  };
  early_warning_signals?: string[];
}
interface Prebrief {
  strategic_anchor?: string;
  tension?: string;
  audience?: string;
  cultural_context?: string;
  creative_territory_direction?: string;
  must_include?: string[];
  must_avoid?: string[];
}
interface Territory {
  id: string;
  name?: string;
  description?: string;
  type?:
    | "category_ownership"
    | "differentiated_positioning"
    | "category_creation"
    | "hermit_crab"
    | "moment_activated";
  white_space?: {
    perceptual?: WhiteSpaceCell;
    emotional?: WhiteSpaceCell;
    cultural?: WhiteSpaceCell;
    motivational?: WhiteSpaceCell;
  };
  brand_permission?: BrandPermission;
  first_mover?: FirstMover;
  hermit_crab?: HermitCrab | null;
  cultural_adaptation?: CulturalAdaptation;
  audience_readiness?: ResonanceRating | "resistant";
  audience_readiness_rationale?: string;
  historical_validation?: HistoricalValidation;
  budget_scale_threshold?: string;
  budget_rationale?: string;
  timing_sequencing?: { recommendation?: string; is_gateway_territory?: boolean; phase?: string };
  longevity_saturation?: {
    compounding_potential?: string;
    saturation_timeline?: string;
    evolution_requirement?: string;
    exit_signal?: string;
  };
  measurement_framework?: MeasurementFramework;
  strategic_recommendation?: "claim" | "do_not_claim" | "claim_with_conditions";
  recommendation_rationale?: string;
  conditions?: string[];
  prebrief_for_briefing_room?: Prebrief;
}
interface GovernmentAddendum {
  institutional_trust_assessment?: string;
  backlash_risk?: "low" | "medium" | "high";
  backlash_rationale?: string;
  accountability_documentation?: string;
  audience_resistance_mapping?: { segment?: string; resistance_level?: string; rationale?: string }[];
  cald_multicultural_strategy?: string;
}
interface CompletenessAssessment {
  inputs_present?: string[];
  inputs_absent?: string[];
  confidence?: "high" | "moderate" | "low";
  gap_impact_notes?: string[];
}
interface IntelligenceReport {
  completeness_assessment?: CompletenessAssessment;
  executive_summary?: string;
  territories?: Territory[];
  recommended_primary_territory_id?: string;
  government_addendum?: GovernmentAddendum | null;
}

interface SessionRow {
  id: string;
  user_id: string;
  brand_name: string | null;
  category: string | null;
  status: string | null;
  stage_status: string | null;
  current_layer: number | null;
  final_report: string | null;
  report_metadata: unknown;
  last_error: string | null;
  completed_at: string | null;
  territory_input: string | null;
  additional_context: string | null;
  input_primary_consumer: string | null;
  input_brand_health: string | null;
  input_competitive_audit: string | null;
  input_cultural_trends: string | null;
  input_audience_segmentation: string | null;
  input_bg_intel_pack: string | null;
}

// ── Constants ────────────────────────────────────────────────────────────

const LAYER_LABELS: Record<number, string> = {
  0: "Initialising analysis",
  1: "Assessing research inputs",
  2: "Classifying territory types",
  3: "Mapping white space across four dimensions",
  4: "Assessing brand permission and competitive vulnerability",
  5: "Evaluating first-mover advantage",
  6: "Validating against historical evidence",
  7: "Mapping cultural adaptation",
  8: "Assessing audience readiness and commercial factors",
  9: "Building measurement framework",
  10: "Compiling ranked intelligence report",
};

const TYPE_LABEL: Record<NonNullable<Territory["type"]>, { label: string; color: string }> = {
  category_ownership: { label: "Category Ownership", color: "#C81E1E" },
  differentiated_positioning: { label: "Differentiated Positioning", color: "#C81E1E" },
  category_creation: { label: "Category Creation", color: "#C81E1E" },
  hermit_crab: { label: "Hermit Crab", color: "#C81E1E" },
  moment_activated: { label: "Moment Activated", color: "#C81E1E" },
};

const RISK_COLOR: Record<RiskClass, string> = {
  low: "#C81E1E",
  medium: "#C81E1E",
  high: "#C81E1E",
  very_high: "#C81E1E",
};

const RECOMMENDATION_STYLE: Record<
  NonNullable<Territory["strategic_recommendation"]>,
  { label: string; color: string }
> = {
  claim: { label: "Claim", color: "#C81E1E" },
  claim_with_conditions: { label: "Claim with Conditions", color: "#C81E1E" },
  do_not_claim: { label: "Do Not Claim", color: "#C81E1E" },
};

const CONFIDENCE_COLOR: Record<string, string> = {
  high: "#C81E1E",
  moderate: "#C81E1E",
  low: "#C81E1E",
};

// ── Utilities ────────────────────────────────────────────────────────────

function parseReport(raw: string | null): IntelligenceReport | null {
  if (!raw || !raw.trim()) return null;
  try {
    return JSON.parse(raw) as IntelligenceReport;
  } catch {
    return null;
  }
}

function stageLayer(stageStatus: string | null, currentLayer: number | null): number {
  if (typeof currentLayer === "number") return Math.max(0, Math.min(10, currentLayer));
  if (!stageStatus) return 0;
  const m = /^(?:running|complete):(\d+)/.exec(stageStatus);
  return m ? Math.max(0, Math.min(10, Number(m[1]))) : 0;
}

// ── Page ─────────────────────────────────────────────────────────────────

function IntelligenceRunPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [row, setRow] = useState<SessionRow | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [selectedTerritoryId, setSelectedTerritoryId] = useState<string | null>(null);

  // Poll session row until complete/failed.
  useEffect(() => {
    let alive = true;
    let interval: ReturnType<typeof setInterval> | null = null;
    const fetchRow = async () => {
      const { data } = await supabase
        .from("intelligence_sessions")
        .select(
          "id, user_id, brand_name, category, status, stage_status, current_layer, final_report, report_metadata, last_error, completed_at, territory_input, additional_context, input_primary_consumer, input_brand_health, input_competitive_audit, input_cultural_trends, input_audience_segmentation, input_bg_intel_pack",
        )
        .eq("id", id)
        .maybeSingle();
      if (!alive) return;
      if (!data) {
        setLoaded(true);
        return;
      }
      setRow(data as unknown as SessionRow);
      setLoaded(true);
      if (data.status === "complete" || data.status === "failed") {
        if (interval) clearInterval(interval);
      }
    };
    void fetchRow();
    interval = setInterval(fetchRow, 3000);
    return () => {
      alive = false;
      if (interval) clearInterval(interval);
    };
  }, [id]);

  // Ownership check — redirect if session belongs to another user.
  useEffect(() => {
    if (!row) return;
    void (async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user && row.user_id && row.user_id !== data.user.id) {
        toast.error("You don't have access to that intelligence run");
        navigate({ to: "/dashboard" });
      }
    })();
  }, [row, navigate]);

  const report = useMemo(() => parseReport(row?.final_report ?? null), [row?.final_report]);
  const availableTerritories = report?.territories ?? [];
  const primaryTerritoryId = report?.recommended_primary_territory_id ?? null;

  useEffect(() => {
    if (!availableTerritories.length) {
      setSelectedTerritoryId(null);
      return;
    }

    const currentStillExists = availableTerritories.some((t) => t.id === selectedTerritoryId);
    if (currentStillExists) return;

    const defaultId =
      primaryTerritoryId && availableTerritories.some((t) => t.id === primaryTerritoryId)
        ? primaryTerritoryId
        : availableTerritories[0]?.id;
    setSelectedTerritoryId(defaultId ?? null);
  }, [availableTerritories, primaryTerritoryId, selectedTerritoryId]);

  const briefType: BriefType = useMemo(() => {
    const meta = row?.report_metadata;
    if (meta && typeof meta === "object" && !Array.isArray(meta)) {
      const bt = (meta as Record<string, unknown>).brief_type;
      if (typeof bt === "string" && bt.trim().toLowerCase() === "government") {
        return "government";
      }
    }
    return "commercial";
  }, [row?.report_metadata]);


  const [downloading, setDownloading] = useState(false);
  const [handingOff, setHandingOff] = useState(false);
  const handoffFn = useServerFn(createBriefingRoomFromIntelligence);
  const handleSendToBriefingRoom = useCallback(async () => {
    if (!row || !selectedTerritoryId) return;
    setHandingOff(true);
    try {
      const res = await handoffFn({
        data: {
          intelligenceSessionId: row.id,
          selectedTerritoryId,
        },
      });
      toast.success("Territory sent to Briefing Room");
      navigate({ to: "/briefing-room/$id", params: { id: res.workspaceId } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Handoff failed");
    } finally {
      setHandingOff(false);
    }
  }, [row, selectedTerritoryId, handoffFn, navigate]);
  const handleDownloadPdf = useCallback(async () => {
    if (!row || !report) return;
    setDownloading(true);
    try {
      await downloadDocument00APdf({
        brandName: row.brand_name || "Brand",
        category: row.category || "",
        briefType,
        completedAt: row.completed_at,
        report,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "PDF generation failed");
    } finally {
      setDownloading(false);
    }
  }, [row, report, briefType]);

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

  if (!row) {
    return (
      <div className="min-h-screen bg-background">
        <TopNav />
        <main className="mx-auto max-w-[720px] px-6 py-16">
          <BackLink id={id} />
          <Card className="mt-6 p-6">
            <p className="text-body text-text-primary">Session not found.</p>
          </Card>
        </main>
      </div>
    );
  }

  // Failed state
  if (row.status === "failed") {
    return (
      <div className="min-h-screen bg-background">
        <TopNav />
        <main className="mx-auto max-w-[720px] px-6 py-16">
          <BackLink id={id} />
          <div className="mt-6">
            <span className="text-label text-primary">Intelligence Lab</span>
            <h1 className="text-h2 mt-2 text-text-primary">
              {row.brand_name || "Analysis failed"}
            </h1>
          </div>
          <Card className="mt-6 p-6 border-destructive/40">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 flex-shrink-0 text-destructive mt-0.5" />
              <div className="flex-1">
                <p className="text-body text-text-primary font-medium">Analysis failed</p>
                <p className="text-sm text-text-secondary mt-1">
                  {row.last_error ?? "Unknown error"}
                </p>
                <Link
                  to="/intelligence/$id/edit"
                  params={{ id }}
                  className="mt-4 inline-flex h-9 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold"
                  style={{
                    backgroundColor: "#C81E1E",
                    color: "#0A0908",
                    boxShadow: "0 2px 12px rgba(200, 30, 30,0.25)",
                  }}
                >
                  Edit Inputs
                </Link>
              </div>
            </div>
          </Card>
        </main>
      </div>
    );
  }

  // Draft state — inputs are saved, analysis has not been started.
  if (row.status === "draft") {
    return (
      <div className="min-h-screen bg-background">
        <TopNav />
        <main className="mx-auto max-w-[720px] px-6 py-16">
          <BackLink id={id} />
          <div className="mt-6">
            <span className="text-label text-primary">Intelligence Lab</span>
            <h1 className="text-h2 mt-2 text-text-primary">
              {row.brand_name || "Research inputs saved"}
            </h1>
            {row.category ? (
              <p className="text-body text-text-secondary mt-1">{row.category}</p>
            ) : null}
          </div>
          <Card className="mt-8 p-6">
            <p className="text-body text-text-primary font-medium">Inputs saved</p>
            <p className="text-sm text-text-secondary mt-2">
              Analysis is not running. Edit the inputs to re-run the intelligence analysis.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Link
                to="/intelligence/$id/edit"
                params={{ id }}
                className="inline-flex items-center justify-center gap-2 h-9 px-4 rounded-md text-sm font-semibold"
                style={{
                  backgroundColor: "#C81E1E",
                  color: "#0A0908",
                  boxShadow: "0 2px 12px rgba(200, 30, 30,0.25)",
                }}
              >
                Edit Inputs
              </Link>
            </div>
          </Card>
        </main>
      </div>
    );
  }

  // Running state — show live progress instead of the "not active" fallback.
  if (row.status === "running") {
    const layer = row.current_layer ?? 0;
    const pct = Math.min(100, Math.max(5, Math.round((layer / 10) * 100)));
    return (
      <div className="min-h-screen bg-background">
        <TopNav />
        <main className="mx-auto max-w-[720px] px-6 py-16">
          <BackLink id={id} />
          <div className="mt-6">
            <span className="text-label text-primary">Intelligence Lab</span>
            <h1 className="text-h2 mt-2 text-text-primary">
              {row.brand_name || "Analysis in progress"}
            </h1>
            {row.category ? (
              <p className="text-body text-text-secondary mt-1">{row.category}</p>
            ) : null}
          </div>
          <Card className="mt-8 p-6">
            <p className="text-body text-text-primary font-medium">
              Analysing… layer {Math.max(1, layer)} of 10
            </p>
            <p className="mt-2 text-sm text-text-secondary">
              The intelligence engine is streaming. This page updates automatically.
            </p>
            <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-card/5">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${pct}%`, backgroundColor: "#C81E1E" }}
              />
            </div>
          </Card>
        </main>
      </div>
    );
  }

  // Interrupted / unavailable report state — do not block access behind a spinner.
  if (row.status !== "complete" || !report) {
    // If status is complete but report failed to parse — show a graceful error.
    if (row.status === "complete" && !report) {
      return (
        <div className="min-h-screen bg-background">
          <TopNav />
          <main className="mx-auto max-w-[720px] px-6 py-16">
            <BackLink id={id} />
            <Card className="mt-6 p-6 border-destructive/40">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 flex-shrink-0 text-destructive mt-0.5" />
                <div className="flex-1">
                  <p className="text-body text-text-primary font-medium">
                    Report could not be parsed
                  </p>
                  <p className="text-sm text-text-secondary mt-1">
                    The engine returned data that could not be read as a valid report.
                  </p>
                  <Link
                    to="/intelligence/$id/edit"
                    params={{ id }}
                    className="mt-4 inline-flex h-9 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold"
                    style={{
                      backgroundColor: "#C81E1E",
                      color: "#0A0908",
                      boxShadow: "0 2px 12px rgba(200, 30, 30,0.25)",
                    }}
                  >
                    Edit Inputs
                  </Link>
                </div>
              </div>
            </Card>
          </main>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-background">
        <TopNav />
        <main className="mx-auto max-w-[720px] px-6 py-16">
          <BackLink id={id} />
          <div className="mt-6">
            <span className="text-label text-primary">Intelligence Lab</span>
            <h1 className="text-h2 mt-2 text-text-primary">
              {row.brand_name || "Intelligence inputs"}
            </h1>
            {row.category ? (
              <p className="text-body text-text-secondary mt-1">{row.category}</p>
            ) : null}
          </div>
          <Card className="mt-8 p-6">
            <p className="text-body font-medium text-text-primary">
              Analysis is not currently active.
            </p>
            <p className="mt-2 text-sm text-text-secondary">
              Open the saved inputs below, add or change the research, then re-run the intelligence analysis from the edit form.
            </p>
            <div className="mt-5">
              <Link
                to="/intelligence/$id/edit"
                params={{ id }}
                className="inline-flex items-center justify-center gap-2 h-9 px-4 rounded-md text-sm font-semibold"
                style={{
                  backgroundColor: "#C81E1E",
                  color: "#0A0908",
                  boxShadow: "0 2px 12px rgba(200, 30, 30,0.25)",
                }}
              >
                Edit Inputs
              </Link>
            </div>
          </Card>
        </main>
      </div>
    );
  }

  // Complete state — full report display.
  const territories = availableTerritories;
  const primaryId = primaryTerritoryId;
  const ordered = primaryId
    ? [...territories].sort((a, b) => (a.id === primaryId ? -1 : b.id === primaryId ? 1 : 0))
    : territories;
  const selectedTerritory = ordered.find((t) => t.id === selectedTerritoryId) ?? null;

  const completeness = report.completeness_assessment ?? null;
  const govAddendum =
    briefType === "government" && report.government_addendum ? report.government_addendum : null;

  const dateStr = row.completed_at
    ? new Date(row.completed_at).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "";

  return (
    <div className="min-h-screen bg-background pb-32">
      <TopNav />
      <main
        className="px-5 py-10 sm:px-8 lg:px-8 lg:py-12"
        style={{
          paddingLeft: "max(20px, min(32px, 5vw))",
          paddingRight: "max(20px, min(32px, 5vw))",
        }}
      >
        <div className="mx-auto max-w-[1080px]">
          <BackLink id={id} />

          {/* Header */}
          <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
            <div>
              <span className="text-label text-primary">Strategic Territory Intelligence Report</span>
              <h1 className="text-h2 mt-2 text-text-primary">{row.brand_name}</h1>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-text-secondary">
                {row.category ? <span>{row.category}</span> : null}
                <span className="text-text-secondary/40">·</span>
                <Badge variant="outline" className="text-xs">
                  {briefType === "government" ? "Government" : "Commercial"}
                </Badge>
                {completeness?.confidence ? (
                  <Badge
                    className="text-xs"
                    style={{
                      backgroundColor: `${CONFIDENCE_COLOR[completeness.confidence]}22`,
                      color: CONFIDENCE_COLOR[completeness.confidence],
                      borderColor: `${CONFIDENCE_COLOR[completeness.confidence]}55`,
                    }}
                    variant="outline"
                  >
                    Confidence:{" "}
                    {completeness.confidence.charAt(0).toUpperCase() +
                      completeness.confidence.slice(1)}
                  </Badge>
                ) : null}
                {dateStr ? (
                  <>
                    <span className="text-text-secondary/40">·</span>
                    <span>{dateStr}</span>
                  </>
                ) : null}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadPdf}
                disabled={downloading}
              >
                {downloading ? (
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="mr-2 h-3.5 w-3.5" />
                )}
                Download PDF
              </Button>
              <Link
                to="/intelligence/$id/edit"
                params={{ id }}
                className="text-sm text-text-secondary underline underline-offset-4 hover:text-text-primary"
              >
                Edit Inputs
              </Link>
            </div>
          </div>


          {/* Executive summary */}
          {report.executive_summary ? (
            <Card className="mt-8 p-6">
              <span className="text-label text-text-secondary">Executive summary</span>
              <p className="text-body text-text-primary mt-2 leading-relaxed">
                {report.executive_summary}
              </p>
            </Card>
          ) : null}



          {/* Completeness assessment */}
          {completeness ? (
            <Accordion type="single" collapsible className="mt-6">
              <AccordionItem value="completeness" className="border rounded-lg px-4">
                <AccordionTrigger className="text-label">
                  Completeness assessment
                </AccordionTrigger>
                <AccordionContent>
                  <div className="grid gap-4 md:grid-cols-2 pb-2">
                    <div>
                      <p className="text-label text-text-secondary mb-2">Inputs present</p>
                      <ul className="space-y-1.5">
                        {(completeness.inputs_present ?? []).map((x, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-text-primary">
                            <CheckCircle2
                              className="h-4 w-4 mt-0.5 flex-shrink-0"
                              style={{ color: "#C81E1E" }}
                            />
                            <span>{x}</span>
                          </li>
                        ))}
                        {(completeness.inputs_present ?? []).length === 0 ? (
                          <li className="text-sm text-text-secondary">None</li>
                        ) : null}
                      </ul>
                    </div>
                    <div>
                      <p className="text-label text-text-secondary mb-2">Inputs absent</p>
                      <ul className="space-y-2">
                        {(completeness.inputs_absent ?? []).map((x, i) => (
                          <li key={i} className="text-sm text-text-secondary">
                            <div className="flex items-start gap-2">
                              <Circle className="h-4 w-4 mt-0.5 flex-shrink-0 text-text-secondary/60" />
                              <div>
                                <div className="text-text-primary">{x}</div>
                                {completeness.gap_impact_notes?.[i] ? (
                                  <div className="text-xs mt-0.5 text-text-secondary italic">
                                    {completeness.gap_impact_notes[i]}
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          </li>
                        ))}
                        {(completeness.inputs_absent ?? []).length === 0 ? (
                          <li className="text-sm text-text-secondary">None</li>
                        ) : null}
                      </ul>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          ) : null}

          {/* Territories */}
          <section className="mt-10">
            <h2 className="text-h3 text-text-primary">Territories</h2>
            <p className="text-sm text-text-secondary mt-1">
              Ranked by strategic value. The recommended primary territory is marked.
            </p>
            <div className="mt-6 space-y-5">
              {ordered.map((t) => (
                <TerritoryCard
                  key={t.id}
                  territory={t}
                  isPrimary={t.id === primaryId}
                  selected={t.id === selectedTerritoryId}
                  onSelect={() => setSelectedTerritoryId(t.id)}
                />
              ))}
              {ordered.length === 0 ? (
                <Card className="p-6">
                  <p className="text-body text-text-secondary">
                    No territories were returned in the report.
                  </p>
                </Card>
              ) : null}
            </div>
          </section>

          {/* Government addendum */}
          {govAddendum ? <GovernmentAddendumSection addendum={govAddendum} /> : null}
        </div>
      </main>

      {/* Sticky action bar */}
      <div
        className="fixed bottom-0 left-0 right-0 z-40 border-t"
        style={{
          backgroundColor: "hsl(var(--background) / 0.95)",
          backdropFilter: "blur(8px)",
          borderColor: "rgba(148,163,184,0.15)",
        }}
      >
        <div className="mx-auto max-w-[1080px] flex items-center justify-between gap-3 px-6 py-4">
          <div className="text-xs text-text-secondary">
            {selectedTerritoryId
              ? `Selected: ${selectedTerritory?.name ?? "territory"}`
              : "Select a territory to enable handoff."}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadPdf}
              disabled={downloading}
            >
              {downloading ? (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="mr-2 h-3.5 w-3.5" />
              )}
              Download PDF — Document 00A
            </Button>
            <Button
              size="sm"
              disabled={!selectedTerritoryId || handingOff}
              onClick={handleSendToBriefingRoom}
              className="bg-primary text-background hover:bg-primary disabled:opacity-60"
            >
              {handingOff ? (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="mr-2 h-3.5 w-3.5" />
              )}
              Send Selected Territory to Briefing Room
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────

function BackLink(_props: { id?: string } = {}) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
      <Link
        to="/dashboard"
        className="inline-flex items-center gap-2 text-label text-text-secondary hover:text-text-primary"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to dashboard
      </Link>
      <Link
        to="/intelligence"
        className="inline-flex items-center gap-2 text-label text-text-secondary hover:text-text-primary"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> All Intelligence Lab sessions
      </Link>
    </div>
  );
}

function TerritoryCard({
  territory,
  isPrimary,
  selected,
  onSelect,
}: {
  territory: Territory;
  isPrimary: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  const typeMeta = territory.type ? TYPE_LABEL[territory.type] : null;
  const risk = territory.historical_validation?.risk_classification;
  const rec = territory.strategic_recommendation
    ? RECOMMENDATION_STYLE[territory.strategic_recommendation]
    : null;
  const fmScore = territory.first_mover?.score;

  return (
    <Card
      onClick={onSelect}
      className={`p-6 cursor-pointer transition-all ${
        selected ? "ring-2 ring-primary" : "hover:border-primary/30"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {isPrimary ? (
              <Badge
                className="text-xs"
                style={{
                  backgroundColor: "rgba(200, 30, 30,0.15)",
                  color: "#C81E1E",
                  borderColor: "rgba(200, 30, 30,0.4)",
                }}
                variant="outline"
              >
                <Star className="mr-1 h-3 w-3 fill-current" /> Recommended
              </Badge>
            ) : null}
            {typeMeta ? (
              <Badge
                className="text-xs"
                variant="outline"
                style={{
                  backgroundColor: `${typeMeta.color}18`,
                  color: typeMeta.color,
                  borderColor: `${typeMeta.color}55`,
                }}
              >
                {typeMeta.label}
              </Badge>
            ) : null}
          </div>
          <h3 className="text-h3 text-text-primary mt-2">{territory.name ?? "Untitled territory"}</h3>
          {territory.description ? (
            <p className="text-body text-text-secondary mt-1.5">{territory.description}</p>
          ) : null}
        </div>
        <Button
          type="button"
          size="sm"
          variant={selected ? "default" : "outline"}
          aria-pressed={selected}
          onClick={(e) => {
            e.stopPropagation();
            onSelect();
          }}
        >
          {selected ? "Selected" : "Select"}
        </Button>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-xs">
        {typeof fmScore === "number" ? (
          <Metric label="First mover" value={`${fmScore}/10`} />
        ) : null}
        {risk ? (
          <div className="flex items-center gap-1.5">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: RISK_COLOR[risk] }}
            />
            <span className="text-text-secondary">Risk:</span>
            <span className="text-text-primary capitalize">{risk.replace("_", " ")}</span>
          </div>
        ) : null}
        {rec ? (
          <Badge
            className="text-xs"
            variant="outline"
            style={{
              backgroundColor: `${rec.color}18`,
              color: rec.color,
              borderColor: `${rec.color}55`,
            }}
          >
            {rec.label}
          </Badge>
        ) : null}
      </div>

      {territory.conditions && territory.conditions.length > 0 ? (
        <div className="mt-3 text-xs text-text-secondary">
          <span className="font-medium text-text-primary">Conditions:</span>{" "}
          {territory.conditions.join(" · ")}
        </div>
      ) : null}

      <div onClick={(e) => e.stopPropagation()}>
        <Accordion type="multiple" className="mt-4">
          {territory.white_space ? (
            <AccordionItem value="whitespace">
              <AccordionTrigger className="text-label">White Space</AccordionTrigger>
              <AccordionContent>
                <div className="grid gap-3 md:grid-cols-2">
                  {(["perceptual", "emotional", "cultural", "motivational"] as const).map((k) => {
                    const cell = territory.white_space?.[k];
                    if (!cell) return null;
                    return (
                      <div key={k} className="rounded border p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-label capitalize">{k}</span>
                          {cell.territory_type ? (
                            <Badge variant="outline" className="text-[10px] capitalize">
                              {cell.territory_type}
                            </Badge>
                          ) : null}
                        </div>
                        {cell.assessment ? (
                          <p className="text-sm text-text-primary mt-2">{cell.assessment}</p>
                        ) : null}
                        {cell.evidence ? (
                          <p className="text-xs text-text-secondary mt-1.5 italic">
                            {cell.evidence}
                          </p>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </AccordionContent>
            </AccordionItem>
          ) : null}

          {territory.brand_permission ? (
            <AccordionItem value="permission">
              <AccordionTrigger className="text-label">
                Brand Permission
                {typeof territory.brand_permission.score === "number"
                  ? ` — ${territory.brand_permission.score}/10`
                  : ""}
              </AccordionTrigger>
              <AccordionContent>
                {territory.brand_permission.rationale ? (
                  <p className="text-sm text-text-primary">
                    {territory.brand_permission.rationale}
                  </p>
                ) : null}
                <StringList
                  className="mt-3"
                  label="Permission sources"
                  items={territory.brand_permission.permission_sources}
                />
                <StringList
                  className="mt-3"
                  label="Permission gaps"
                  items={territory.brand_permission.permission_gaps}
                />
              </AccordionContent>
            </AccordionItem>
          ) : null}

          {territory.first_mover ? (
            <AccordionItem value="firstmover">
              <AccordionTrigger className="text-label">First Mover Detail</AccordionTrigger>
              <AccordionContent>
                <KV k="Adoption curve stage" v={territory.first_mover.adoption_curve_stage} />
                <KV
                  k="Competitive response"
                  v={territory.first_mover.competitive_response_scenario}
                />
                <KV k="Window duration" v={territory.first_mover.window_duration} />
                <KV
                  k="Investment threshold"
                  v={territory.first_mover.investment_threshold}
                />
              </AccordionContent>
            </AccordionItem>
          ) : null}

          {territory.hermit_crab ? (
            <AccordionItem value="hermit">
              <AccordionTrigger className="text-label">Hermit Crab</AccordionTrigger>
              <AccordionContent>
                <KV k="Shell value" v={territory.hermit_crab.shell_value} />
                <KV k="Vacancy timeline" v={territory.hermit_crab.vacancy_timeline} />
                <KV k="Return risk" v={territory.hermit_crab.return_risk} />
                <KV k="Shape compatibility" v={territory.hermit_crab.shape_compatibility} />
                <KV k="Vacancy type" v={territory.hermit_crab.vacancy_type} />
              </AccordionContent>
            </AccordionItem>
          ) : null}

          {territory.cultural_adaptation ? (
            <AccordionItem value="cultural">
              <AccordionTrigger className="text-label">Cultural Adaptation</AccordionTrigger>
              <AccordionContent>
                <KV k="Overall resonance" v={territory.cultural_adaptation.resonance_overall} />
                <KV
                  k="Adaptation requirement"
                  v={territory.cultural_adaptation.adaptation_requirement?.replace(/_/g, " ")}
                />
                {territory.cultural_adaptation.resonance_by_context?.length ? (
                  <div className="mt-3">
                    <p className="text-label text-text-secondary mb-1.5">By context</p>
                    <ul className="space-y-1.5 text-sm">
                      {territory.cultural_adaptation.resonance_by_context.map((r, i) => (
                        <li key={i} className="text-text-primary">
                          <span className="font-medium">{r.context}</span>{" "}
                          <span className="text-text-secondary">— {r.rating}</span>
                          {r.notes ? (
                            <div className="text-xs text-text-secondary mt-0.5">{r.notes}</div>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <StringList
                  className="mt-3"
                  label="Cultural risk flags"
                  items={territory.cultural_adaptation.cultural_risk_flags}
                />
                {territory.cultural_adaptation.cald_mapping?.communities?.length ? (
                  <div className="mt-3">
                    <p className="text-label text-text-secondary mb-1.5">CALD mapping</p>
                    <ul className="space-y-1.5 text-sm">
                      {territory.cultural_adaptation.cald_mapping.communities.map((c, i) => (
                        <li key={i}>
                          <span className="text-text-primary font-medium">{c.community}</span>{" "}
                          <span className="text-text-secondary">— {c.resonance}</span>
                          {c.adaptation ? (
                            <div className="text-xs text-text-secondary mt-0.5">
                              {c.adaptation}
                            </div>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </AccordionContent>
            </AccordionItem>
          ) : null}

          <AccordionItem value="audience_commercial">
            <AccordionTrigger className="text-label">Audience &amp; Commercial</AccordionTrigger>
            <AccordionContent>
              <KV k="Readiness" v={territory.audience_readiness} />
              {territory.audience_readiness_rationale ? (
                <p className="text-sm text-text-primary mt-1">
                  {territory.audience_readiness_rationale}
                </p>
              ) : null}
              <KV k="Budget threshold" v={territory.budget_scale_threshold} />
              {territory.budget_rationale ? (
                <p className="text-sm text-text-primary mt-1">{territory.budget_rationale}</p>
              ) : null}
              {territory.timing_sequencing ? (
                <>
                  <KV k="Phase" v={territory.timing_sequencing.phase} />
                  <KV
                    k="Timing"
                    v={territory.timing_sequencing.recommendation}
                  />
                  {territory.timing_sequencing.is_gateway_territory ? (
                    <Badge variant="outline" className="mt-2 text-xs">
                      Gateway territory
                    </Badge>
                  ) : null}
                </>
              ) : null}
            </AccordionContent>
          </AccordionItem>

          {territory.longevity_saturation ? (
            <AccordionItem value="longevity">
              <AccordionTrigger className="text-label">Longevity &amp; Saturation</AccordionTrigger>
              <AccordionContent>
                <KV k="Compounding potential" v={territory.longevity_saturation.compounding_potential} />
                <KV k="Saturation timeline" v={territory.longevity_saturation.saturation_timeline} />
                <KV k="Evolution requirement" v={territory.longevity_saturation.evolution_requirement} />
                <KV k="Exit signal" v={territory.longevity_saturation.exit_signal} />
              </AccordionContent>
            </AccordionItem>
          ) : null}

          {territory.historical_validation ? (
            <AccordionItem value="historical">
              <AccordionTrigger className="text-label">Historical Validation</AccordionTrigger>
              <AccordionContent>
                <KV
                  k="Risk classification"
                  v={territory.historical_validation.risk_classification?.replace(/_/g, " ")}
                />
                {territory.historical_validation.risk_rationale ? (
                  <p className="text-sm text-text-primary mt-1">
                    {territory.historical_validation.risk_rationale}
                  </p>
                ) : null}
                <PrecedentList
                  label="Commercial precedents"
                  items={territory.historical_validation.commercial_precedents}
                />
                <PrecedentList
                  label="Government precedents"
                  items={territory.historical_validation.government_precedents}
                />
              </AccordionContent>
            </AccordionItem>
          ) : null}

          {territory.measurement_framework ? (
            <AccordionItem value="measurement">
              <AccordionTrigger className="text-label">Measurement Framework</AccordionTrigger>
              <AccordionContent>
                <StringList
                  label="Brand associations to track"
                  items={territory.measurement_framework.brand_associations_to_track}
                />
                <StringList
                  className="mt-3"
                  label="Competitive response signals"
                  items={territory.measurement_framework.competitive_response_signals}
                />
                {territory.measurement_framework.behaviour_change_metrics ? (
                  <div className="mt-3 grid gap-3 md:grid-cols-3">
                    <MetricsList
                      label="0–4 weeks"
                      items={
                        territory.measurement_framework.behaviour_change_metrics
                          .immediate_0_4_weeks
                      }
                    />
                    <MetricsList
                      label="3–6 months"
                      items={
                        territory.measurement_framework.behaviour_change_metrics
                          .short_term_3_6_months
                      }
                    />
                    <MetricsList
                      label="12–24 months"
                      items={
                        territory.measurement_framework.behaviour_change_metrics
                          .medium_term_12_24_months
                      }
                    />
                  </div>
                ) : null}
                <StringList
                  className="mt-3"
                  label="Early warning signals"
                  items={territory.measurement_framework.early_warning_signals}
                />
              </AccordionContent>
            </AccordionItem>
          ) : null}

          {territory.prebrief_for_briefing_room ? (
            <AccordionItem value="prebrief">
              <AccordionTrigger className="text-label">Pre-Brief Preview</AccordionTrigger>
              <AccordionContent>
                <KV k="Strategic anchor" v={territory.prebrief_for_briefing_room.strategic_anchor} />
                <KV k="Tension" v={territory.prebrief_for_briefing_room.tension} />
                <KV k="Audience" v={territory.prebrief_for_briefing_room.audience} />
                <KV k="Cultural context" v={territory.prebrief_for_briefing_room.cultural_context} />
                <KV
                  k="Creative territory direction"
                  v={territory.prebrief_for_briefing_room.creative_territory_direction}
                />
                <StringList
                  className="mt-3"
                  label="Must include"
                  items={territory.prebrief_for_briefing_room.must_include}
                />
                <StringList
                  className="mt-3"
                  label="Must avoid"
                  items={territory.prebrief_for_briefing_room.must_avoid}
                />
              </AccordionContent>
            </AccordionItem>
          ) : null}
        </Accordion>
      </div>
    </Card>
  );
}

function GovernmentAddendumSection({ addendum }: { addendum: GovernmentAddendum }) {
  const backlashColor = addendum.backlash_risk
    ? RISK_COLOR[addendum.backlash_risk as RiskClass] ?? "#8B8680"
    : "#8B8680";
  return (
    <section className="mt-10">
      <h2 className="text-h3 text-text-primary">Government Addendum</h2>
      <Card className="mt-4 p-6 space-y-5">
        {addendum.institutional_trust_assessment ? (
          <div>
            <p className="text-label text-text-secondary">Institutional trust</p>
            <p className="text-body text-text-primary mt-1">
              {addendum.institutional_trust_assessment}
            </p>
          </div>
        ) : null}
        {addendum.backlash_risk ? (
          <div>
            <p className="text-label text-text-secondary">Backlash risk</p>
            <div className="mt-1 flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: backlashColor }}
              />
              <span className="text-body text-text-primary capitalize">
                {addendum.backlash_risk}
              </span>
            </div>
            {addendum.backlash_rationale ? (
              <p className="text-sm text-text-secondary mt-1.5">
                {addendum.backlash_rationale}
              </p>
            ) : null}
          </div>
        ) : null}
        {addendum.accountability_documentation ? (
          <div>
            <p className="text-label text-text-secondary">Accountability documentation</p>
            <p className="text-body text-text-primary mt-1">
              {addendum.accountability_documentation}
            </p>
          </div>
        ) : null}
        {addendum.audience_resistance_mapping?.length ? (
          <div>
            <p className="text-label text-text-secondary mb-2">Audience resistance mapping</p>
            <div className="overflow-hidden rounded border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-text-secondary border-b">
                    <th className="px-3 py-2">Segment</th>
                    <th className="px-3 py-2">Resistance</th>
                    <th className="px-3 py-2">Rationale</th>
                  </tr>
                </thead>
                <tbody>
                  {addendum.audience_resistance_mapping.map((r, i) => (
                    <tr key={i} className="border-b last:border-b-0">
                      <td className="px-3 py-2 text-text-primary">{r.segment}</td>
                      <td className="px-3 py-2 text-text-primary">{r.resistance_level}</td>
                      <td className="px-3 py-2 text-text-secondary">{r.rationale}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
        {addendum.cald_multicultural_strategy ? (
          <div>
            <p className="text-label text-text-secondary">CALD multicultural strategy</p>
            <p className="text-body text-text-primary mt-1">
              {addendum.cald_multicultural_strategy}
            </p>
          </div>
        ) : null}
      </Card>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-text-secondary">{label}:</span>
      <span className="text-text-primary font-medium">{value}</span>
    </div>
  );
}

function KV({ k, v }: { k: string; v?: string | null }) {
  if (!v) return null;
  return (
    <div className="text-sm">
      <span className="text-text-secondary">{k}:</span>{" "}
      <span className="text-text-primary">{v}</span>
    </div>
  );
}

function StringList({
  label,
  items,
  className,
}: {
  label: string;
  items?: string[];
  className?: string;
}) {
  if (!items || items.length === 0) return null;
  return (
    <div className={className}>
      <p className="text-label text-text-secondary mb-1.5">{label}</p>
      <ul className="space-y-1 text-sm text-text-primary list-disc pl-5">
        {items.map((x, i) => (
          <li key={i}>{x}</li>
        ))}
      </ul>
    </div>
  );
}

function MetricsList({ label, items }: { label: string; items?: string[] }) {
  return (
    <div className="rounded border p-3">
      <p className="text-label text-text-secondary mb-1.5">{label}</p>
      {items && items.length > 0 ? (
        <ul className="space-y-1 text-sm text-text-primary list-disc pl-5">
          {items.map((x, i) => (
            <li key={i}>{x}</li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-text-secondary italic">None</p>
      )}
    </div>
  );
}

function PrecedentList({
  label,
  items,
}: {
  label: string;
  items?: { case_description?: string; outcome?: string; structural_conditions?: string }[];
}) {
  if (!items || items.length === 0) return null;
  return (
    <div className="mt-3">
      <p className="text-label text-text-secondary mb-1.5">{label}</p>
      <ul className="space-y-2">
        {items.map((p, i) => (
          <li key={i} className="rounded border p-3 text-sm">
            {p.case_description ? (
              <div className="text-text-primary font-medium">{p.case_description}</div>
            ) : null}
            {p.outcome ? (
              <div className="text-text-secondary mt-1">
                <span className="text-xs">Outcome: </span>
                {p.outcome}
              </div>
            ) : null}
            {p.structural_conditions ? (
              <div className="text-text-secondary text-xs mt-1 italic">
                {p.structural_conditions}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}



