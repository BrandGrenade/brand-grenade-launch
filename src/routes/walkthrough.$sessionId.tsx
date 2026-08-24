// Demo Mode — the linear walkthrough.
//
// One continuous, read-only narrative across Room 00 → Room 04 for an
// already-completed session. Presentation only: no retry, amend or
// regenerate controls, no error/stall state, no working-tool chrome.
// Nothing here writes to the session.

import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Loader2, X } from "lucide-react";
import { Prose } from "@/components/walkthrough/Prose";
import {
  CheckpointCard,
  DispositionLedger,
  Empty,
  JsonBlock,
  Panel,
  StepShell,
  parseDispositionRows,
} from "@/components/walkthrough/parts";
import { extractStage8Candidates } from "@/lib/stage9-disposition";
import { getWalkthrough } from "@/lib/walkthrough.functions";
import type { WalkthroughPayload } from "@/lib/walkthrough.server";

export const Route = createFileRoute("/walkthrough/$sessionId")({
  validateSearch: (search: Record<string, unknown>) => ({
    step: typeof search.step === "number" ? search.step : Number(search.step) || 0,
  }),
  head: () => ({
    meta: [
      { title: "Session walkthrough — Brand Grenade" },
      {
        name: "description",
        content: "A completed strategy run presented end to end as one linear narrative.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: WalkthroughPage,
});

const CREAM = "#EDE8E0";
const MUTED = "#8B8680";
const LINE = "#1C1A18";
const RED = "#E5484D";
const GREEN = "#7BB661";

type Step = { id: string; kicker: string; title: string; subtitle?: string; body: ReactNode };

/** Stage list for the narrative. Mirrors the pipeline manifest, but declared
 *  locally: the manifest module is server-only. */
const PHASE_1_STAGES: Array<{ col: keyof WalkthroughPayload["session"]; id: string; label: string }> = [
  { col: "stage_1_output", id: "1", label: "Brief Analysis" },
  { col: "stage_1b_output", id: "1b", label: "Brief Enhancement" },
  { col: "stage_2_output", id: "2", label: "Category Intelligence" },
  { col: "stage_3_output", id: "3", label: "Strategic Frameworks" },
  { col: "stage_4_output", id: "4", label: "Strategic Universes" },
  { col: "stage_4b_output", id: "4b", label: "Asset Mining & Product Facts" },
  { col: "stage_5_output", id: "5", label: "Insight Generation" },
  { col: "stage_6_output", id: "6", label: "Insight Validation" },
  { col: "stage_7_output", id: "7", label: "Territory Synthesis" },
  { col: "stage_8_output", id: "8", label: "Proposition Generation" },
];

const PHASE_1_LATE: Array<{ col: keyof WalkthroughPayload["session"]; id: string; label: string }> = [
  { col: "stage_10_output", id: "10", label: "Proposition Scoring" },
  { col: "stage_11_output", id: "11", label: "Integrity Testing" },
];

const PHASE_1_TAIL: Array<{ col: keyof WalkthroughPayload["session"]; id: string; label: string }> = [
  { col: "stage_13_output", id: "13", label: "Brand Fit Validation" },
  { col: "stage_13b_output", id: "13b", label: "Historical Validation" },
];

const PHASE_1_END: Array<{ col: keyof WalkthroughPayload["session"]; id: string; label: string }> = [
  { col: "stage_14_output", id: "14", label: "Territory Mapping" },
  { col: "stage_14b_output", id: "14b", label: "Channel Expression" },
  { col: "stage_14c_output", id: "14c", label: "Brand World Definition" },
  { col: "stage_15_output", id: "15", label: "Coherence Audit" },
];

const PHASE_2_STAGES: Array<{ col: keyof WalkthroughPayload["session"]; id: string; label: string }> = [
  { col: "stage_17_output", id: "17", label: "Detonation Territory" },
  { col: "stage_17b_output", id: "17b", label: "Detonation Intelligence" },
  { col: "stage_18_output", id: "18", label: "The Detonation" },
  { col: "stage_19_output", id: "19", label: "Activation Architecture" },
  { col: "stage_20_output", id: "20", label: "Master Detonation Brief" },
  { col: "stage_20b_output", id: "20b", label: "Channel Strategy & Audience Intelligence" },
];

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v : null;
}

function stageStep(
  session: WalkthroughPayload["session"],
  entry: { col: keyof WalkthroughPayload["session"]; id: string; label: string },
  kicker: string,
): Step | null {
  const text = str(session[entry.col]);
  if (!text) return null;
  return {
    id: `stage-${entry.id}`,
    kicker,
    title: `Stage ${entry.id.toUpperCase()} — ${entry.label}`,
    body: <Prose text={text} />,
  };
}

function buildSteps(data: WalkthroughPayload): Step[] {
  const s = data.session;
  const steps: Step[] = [];

  // ── Cover ────────────────────────────────────────────────────────────
  steps.push({
    id: "cover",
    kicker: "Walkthrough",
    title: s.brand_name,
    subtitle: `${s.category || "—"} · run started ${new Date(s.created_at).toLocaleDateString("en-GB")}`,
    body: (
      <>
        <Panel title="The brief">
          <Prose text={s.brief_text} />
        </Panel>
        {str(s.locked_big_idea) ? (
          <Panel title="Where this ends up">
            <p className="text-h2" style={{ color: CREAM }}>
              {str(s.locked_campaign_line) ?? str(s.locked_big_idea)}
            </p>
            {str(s.locked_campaign_line) ? <Prose text={s.locked_big_idea} /> : null}
          </Panel>
        ) : null}
      </>
    ),
  });

  // ── Room 00 — Research Synthesis ─────────────────────────────────────
  if (data.synthesiser) {
    const r = data.synthesiser;
    steps.push({
      id: "room-00",
      kicker: "Room 00 · Research Synthesiser",
      title: "Research Synthesis",
      subtitle: "Source material reduced to verified claims before any strategy is written.",
      body: (
        <Panel>
          <p className="text-body" style={{ color: CREAM }}>
            {r.claim_count} claims extracted and verified.
          </p>
          <p className="text-label" style={{ color: MUTED, marginTop: 8 }}>
            {r.applied_at
              ? `Applied to the brief on ${new Date(r.applied_at).toLocaleDateString("en-GB")}`
              : "Not applied to the brief"}
          </p>
        </Panel>
      ),
    });
  }

  // ── Room 01 — Intelligence Lab ───────────────────────────────────────
  if (data.intelligence) {
    const i = data.intelligence;
    const layers = [
      i.layer_1_output,
      i.layer_2_output,
      i.layer_3_output,
      i.layer_4_output,
      i.layer_5_output,
      i.layer_6_output,
      i.layer_7_output,
      i.layer_8_output,
      i.layer_9_output,
      i.layer_10_output,
    ];
    steps.push({
      id: "room-01",
      kicker: "Room 01 · Intelligence Lab",
      title: "Intelligence Lab",
      subtitle: "Ten layers of territory intelligence, ending in a single findings report.",
      body: (
        <>
          {str(i.final_report) ? (
            <Panel title="Findings">
              <Prose text={i.final_report} />
            </Panel>
          ) : (
            <Empty text="No final report was produced for this brand." />
          )}
          {layers.map((l, idx) =>
            str(l) ? (
              <Panel key={idx} title={`Layer ${idx + 1}`}>
                <Prose text={l} />
              </Panel>
            ) : null,
          )}
        </>
      ),
    });
  }

  // ── Room 02 — Briefing Room ──────────────────────────────────────────
  if (data.briefing) {
    const b = data.briefing;
    steps.push({
      id: "room-02",
      kicker: "Room 02 · Briefing Room",
      title: "Briefing Room",
      subtitle: "The governing tension the whole run is answerable to.",
      body: (
        <>
          {b.selected_frame ? (
            <Panel title="Selected frame">
              <p className="text-h3" style={{ color: CREAM }}>
                {b.selected_frame}
              </p>
            </Panel>
          ) : null}
          {b.tensions ? (
            <Panel title="Tensions considered">
              <JsonBlock value={b.tensions} />
            </Panel>
          ) : null}
          {b.diagnosis ? (
            <Panel title="Diagnosis">
              <JsonBlock value={b.diagnosis} />
            </Panel>
          ) : null}
          {b.truths ? (
            <Panel title="Truths">
              <JsonBlock value={b.truths} />
            </Panel>
          ) : null}
          {b.relevance ? (
            <Panel title="Relevance">
              <JsonBlock value={b.relevance} />
            </Panel>
          ) : null}
        </>
      ),
    });
  }

  // ── Checkpoint A ─────────────────────────────────────────────────────
  steps.push({
    id: "checkpoint-a",
    kicker: "Human checkpoint",
    title: "Checkpoint A — Brief confirmed",
    subtitle: "Nothing generates until a human signs off the brief the machine will work from.",
    body: (
      <CheckpointCard
        letter="A"
        label="Brief confirmed"
        what="The interrogated brief is accepted as the basis for the run."
        confirmed={Boolean(s.checkpoint_a_confirmed)}
        confirmedAt={s.checkpoint_a_confirmed_at}
        notes={s.checkpoint_a_notes}
      />
    ),
  });

  // ── Room 03 — Phase 1 stages 1–8 ─────────────────────────────────────
  for (const e of PHASE_1_STAGES) {
    const st = stageStep(s, e, "Room 03 · Strategy");
    if (st) steps.push(st);
  }

  // ── Checkpoint B ─────────────────────────────────────────────────────
  steps.push({
    id: "checkpoint-b",
    kicker: "Human checkpoint",
    title: "Checkpoint B — Propositions accepted for pressure",
    body: (
      <CheckpointCard
        letter="B"
        label="Propositions accepted"
        what="The generated proposition set is accepted into the distinctiveness check."
        confirmed={Boolean(s.checkpoint_b_confirmed)}
        confirmedAt={s.checkpoint_b_confirmed_at}
        notes={s.checkpoint_b_notes}
      />
    ),
  });

  // ── Stage 9 — Distinctiveness Check + disposition ledger ─────────────
  const candidates = extractStage8Candidates(s.stage_8_output);
  const ledger = parseDispositionRows(
    `${s.stage_9_output ?? ""}\n${s.stage_9_leftofcentre_output ?? ""}`,
    candidates,
  );
  if (str(s.stage_9_output) || ledger.length) {
    steps.push({
      id: "stage-9",
      kicker: "Room 03 · Strategy Pipeline",
      title: "Stage 9 — Distinctiveness Check",
      subtitle: "Every candidate accounted for. Nothing is filtered silently.",
      body: (
        <>
          <Panel title="Candidate disposition">
            <DispositionLedger rows={ledger} />
          </Panel>
          {str(s.stage_9_output) ? <Prose text={s.stage_9_output} /> : null}
          {str(s.stage_9_leftofcentre_output) ? (
            <Panel title="Left-of-centre engines">
              <Prose text={s.stage_9_leftofcentre_output} />
            </Panel>
          ) : null}
        </>
      ),
    });
  }

  for (const e of PHASE_1_LATE) {
    const st = stageStep(s, e, "Room 03 · Strategy");
    if (st) steps.push(st);
  }

  // ── Stage 12 — Selection, with rejections first-class ────────────────
  if (str(s.stage_12_output) || str(s.selected_smp)) {
    const rationales = [
      s.selection_rationale_1,
      s.selection_rationale_2,
      s.selection_rationale_3,
      s.selection_rationale_4,
      s.selection_rationale_5,
      s.selection_rationale_6,
    ].filter((r): r is string => Boolean(r && r.trim()));
    steps.push({
      id: "stage-12",
      kicker: "Room 03 · Strategy Pipeline",
      title: "Stage 12 — Proposition Selection",
      subtitle: "The full pool that was on the table, and why one was carried forward.",
      body: (
        <>
          {str(s.selected_smp) ? (
            <Panel title="Carried forward">
              <p className="text-h2" style={{ color: CREAM }}>
                {s.selected_smp}
              </p>
              {str(s.selected_smp_field_name) ? (
                <p className="text-label" style={{ color: MUTED, marginTop: 8 }}>
                  {s.selected_smp_field_name}
                  {s.selection_source ? ` · ${s.selection_source}` : ""}
                  {s.selection_engine ? ` · ${s.selection_engine}` : ""}
                </p>
              ) : null}
            </Panel>
          ) : null}
          {rationales.length ? (
            <Panel title="Why this one">
              {rationales.map((r, i) => (
                <p key={i} className="text-body" style={{ color: MUTED, marginBottom: 8 }}>
                  {r}
                </p>
              ))}
            </Panel>
          ) : null}
          {s.selection_rationale ? (
            <Panel title="Selection record">
              <JsonBlock value={s.selection_rationale} />
            </Panel>
          ) : null}
          {str(s.stage_12_output) ? (
            <Panel title="The full pool considered">
              <Prose text={s.stage_12_output} />
            </Panel>
          ) : null}
        </>
      ),
    });
  }

  // ── Checkpoint C ─────────────────────────────────────────────────────
  steps.push({
    id: "checkpoint-c",
    kicker: "Human checkpoint",
    title: "Checkpoint C — Proposition locked",
    body: (
      <CheckpointCard
        letter="C"
        label="Proposition locked"
        what="A single strategic proposition is selected by a human before validation runs."
        confirmed={Boolean(s.checkpoint_c_confirmed)}
        confirmedAt={s.checkpoint_c_confirmed_at}
        notes={s.checkpoint_c_notes}
        decision={str(s.selected_smp)}
      />
    ),
  });

  for (const e of PHASE_1_TAIL) {
    const st = stageStep(s, e, "Room 03 · Strategy");
    if (st) steps.push(st);
  }

  // ── Checkpoint D ─────────────────────────────────────────────────────
  steps.push({
    id: "checkpoint-d",
    kicker: "Human checkpoint",
    title: "Checkpoint D — Validation accepted",
    body: (
      <CheckpointCard
        letter="D"
        label="Validation accepted"
        what="Brand-fit and historical validation are read and accepted before mapping begins."
        confirmed={Boolean(s.checkpoint_d_confirmed)}
        confirmedAt={s.checkpoint_d_confirmed_at}
        notes={s.checkpoint_d_notes}
        decision={str(s.stage_17_selected_territory)}
      />
    ),
  });

  for (const e of PHASE_1_END) {
    const st = stageStep(s, e, "Room 03 · Strategy");
    if (st) steps.push(st);
  }

  // ── Detonation phase ─────────────────────────────────────────────────
  for (const e of PHASE_2_STAGES) {
    const st = stageStep(s, e, "Detonation");
    if (st) steps.push(st);
  }

  steps.push({
    id: "checkpoint-e",
    kicker: "Human checkpoint",
    title: "Checkpoint E — Detonation selected",
    body: (
      <CheckpointCard
        letter="E"
        label="Detonation selected"
        what="One detonation is chosen from the set before activation architecture is written."
        confirmed={Boolean(s.checkpoint_e_confirmed)}
        confirmedAt={s.checkpoint_e_confirmed_at}
        notes={s.checkpoint_e_notes}
        decision={str(s.stage_18_detonation_line) ?? str(s.stage_18_selected_detonation)}
      />
    ),
  });

  steps.push({
    id: "checkpoint-f",
    kicker: "Human checkpoint",
    title: "Checkpoint F — Master brief approved",
    body: (
      <CheckpointCard
        letter="F"
        label="Master brief approved"
        what="The master detonation brief is approved before any channel work is produced."
        confirmed={Boolean(s.checkpoint_f_confirmed || s.stage_20_approved)}
        confirmedAt={s.checkpoint_f_confirmed_at}
        notes={s.checkpoint_f_notes}
      />
    ),
  });

  // ── Room 04 — Creative Engine ────────────────────────────────────────
  if (data.creativeRun) {
    const run = data.creativeRun;
    const generated = data.directions.filter((d) => d.direction && d.direction.trim());
    steps.push({
      id: "room-04-sweep",
      kicker: "Room 04 · Creative Engine",
      title: "The lens sweep",
      subtitle: `${generated.length} of ${data.directions.length} lenses generated for “${run.channel_name}”.`,
      body: (
        <>
          {str(run.winning_line) ? (
            <Panel title="Locked master line">
              <p className="text-h2" style={{ color: CREAM }}>
                {run.winning_line}
              </p>
            </Panel>
          ) : null}
          {generated.length === 0 ? (
            <Empty text="No lens output was produced on this run." />
          ) : (
            generated.map((d) => (
              <Panel key={d.id} title={d.lens_name}>
                {str(d.campaign_line) ? (
                  <p className="text-h3" style={{ color: CREAM, marginBottom: 10 }}>
                    {d.campaign_line}
                  </p>
                ) : null}
                {str(d.root_tension) ? (
                  <p className="text-label" style={{ color: MUTED, marginBottom: 10 }}>
                    Root tension — {d.root_tension}
                  </p>
                ) : null}
                <Prose text={d.direction} />
                {str(d.expression_under_master) ? (
                  <div style={{ marginTop: 12, borderTop: `1px solid ${LINE}`, paddingTop: 12 }}>
                    <p className="text-label" style={{ color: MUTED }}>
                      Expression under master
                    </p>
                    <p className="text-body" style={{ color: CREAM, marginTop: 4 }}>
                      {d.expression_under_master}
                    </p>
                  </div>
                ) : null}
                {str(d.rationale) ? <Prose text={d.rationale} /> : null}
                {d.gate_one_approved ? (
                  <p className="text-label" style={{ color: GREEN, marginTop: 10 }}>
                    Approved at Gate One
                  </p>
                ) : null}
              </Panel>
            ))
          )}
        </>
      ),
    });

    if (run.convergence_ledger) {
      steps.push({
        id: "room-04-ledger",
        kicker: "Room 04 · Creative Engine",
        title: "Collision ledger",
        subtitle: "Where ideas converged, and what was rebuilt as a result.",
        body: <JsonBlock value={run.convergence_ledger} />,
      });
    }

    if (str(run.tiebreaker_output)) {
      steps.push({
        id: "room-04-tissue",
        kicker: "Room 04 · Creative Engine",
        title: "Tissue Check",
        body: <Prose text={run.tiebreaker_output} />,
      });
    }

    steps.push({
      id: "room-04-gate-one",
      kicker: "Human checkpoint",
      title: "Gate One — Ideas approved",
      body: (
        <CheckpointCard
          letter="1"
          label="Gate One"
          what="The ideas taken forward into orchestration are approved by a human."
          confirmed={Boolean(run.gate_one_confirmed)}
          confirmedAt={run.gate_one_confirmed_at}
          decision={str(run.winning_line)}
        />
      ),
    });
  }

  // ── Orchestration and channel briefs ─────────────────────────────────
  if (data.orchestration) {
    const o = data.orchestration;
    steps.push({
      id: "orchestration",
      kicker: "Room 04 · Orchestration",
      title: "Orchestration",
      subtitle: o.mandate_text ? `Mandated element — ${o.mandate_text}` : undefined,
      body: (
        <>
          {str(o.cd_output) ? <Prose text={o.cd_output} /> : null}
          <CheckpointCard
            letter="2"
            label="Gate Two"
            what="Channel prompts are confirmed against the mandate before export."
            confirmed={Boolean(o.gate_two_confirmed)}
            confirmedAt={o.gate_two_confirmed_at}
            notes={o.gate_two_notes}
          />
        </>
      ),
    });

    const finalPrompts = data.prompts.filter((p) => str(p.final_prompt) || str(p.working_prompt));
    if (finalPrompts.length) {
      steps.push({
        id: "channel-prompts",
        kicker: "Room 04 · Orchestration",
        title: "Channel prompts",
        body: (
          <>
            {finalPrompts.map((p) => (
              <Panel key={p.id} title={`${p.channel_name} · ${p.lens_name}`}>
                <Prose text={str(p.final_prompt) ?? p.working_prompt} />
              </Panel>
            ))}
          </>
        ),
      });
    }
  }

  if (s.stage_21_outputs) {
    steps.push({
      id: "stage-21",
      kicker: "Delivery",
      title: "Channel Detonation Briefs",
      body: <JsonBlock value={s.stage_21_outputs} />,
    });
  }

  if (str(s.stage_22_output)) {
    steps.push({
      id: "stage-22",
      kicker: "Delivery",
      title: "Brand Architecture",
      body: <Prose text={s.stage_22_output} />,
    });
  }

  return steps;
}

function WalkthroughPage() {
  const { sessionId } = Route.useParams();
  const { step } = useSearch({ from: "/walkthrough/$sessionId" });
  const navigate = useNavigate();
  const load = useServerFn(getWalkthrough);

  const { data, isLoading, error } = useQuery({
    queryKey: ["walkthrough", sessionId],
    queryFn: () => load({ data: { sessionId } }),
  });

  const steps = useMemo(() => (data ? buildSteps(data as WalkthroughPayload) : []), [data]);
  const index = Math.min(Math.max(step ?? 0, 0), Math.max(steps.length - 1, 0));

  const go = useCallback(
    (next: number) => {
      navigate({
        to: "/walkthrough/$sessionId",
        params: { sessionId },
        search: { step: Math.min(Math.max(next, 0), steps.length - 1) },
      });
    },
    [navigate, sessionId, steps.length],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(index + 1);
      if (e.key === "ArrowLeft") go(index - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, index]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [index]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="animate-spin" size={20} style={{ color: MUTED }} />
      </div>
    );
  }

  if (error || !data || steps.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div style={{ textAlign: "center" }}>
          <p className="text-body" style={{ color: MUTED }}>
            This session cannot be presented.
          </p>
          <Link to="/walkthrough" className="text-label" style={{ color: RED, marginTop: 12 }}>
            Back to sessions
          </Link>
        </div>
      </div>
    );
  }

  const current = steps[index]!;
  const brand = (data as WalkthroughPayload).session.brand_name;

  return (
    <div className="min-h-screen bg-background">
      {/* Presentation chrome only: title, position, exit. */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          backgroundColor: "#0A0908",
          borderBottom: `1px solid ${LINE}`,
        }}
      >
        <div
          style={{
            maxWidth: 1100,
            margin: "0 auto",
            padding: "14px 32px",
            display: "flex",
            alignItems: "center",
            gap: 20,
          }}
        >
          <span className="text-label" style={{ color: CREAM, letterSpacing: "0.12em" }}>
            {brand.toUpperCase()}
          </span>
          <span className="text-label" style={{ color: MUTED }}>
            {index + 1} / {steps.length}
          </span>
          <div style={{ flex: 1, height: 2, backgroundColor: LINE, borderRadius: 2 }}>
            <div
              style={{
                width: `${((index + 1) / steps.length) * 100}%`,
                height: "100%",
                backgroundColor: RED,
                borderRadius: 2,
              }}
            />
          </div>
          <Link to="/walkthrough" aria-label="Exit walkthrough" style={{ color: MUTED }}>
            <X size={16} />
          </Link>
        </div>
      </header>

      <main style={{ maxWidth: 900, margin: "0 auto", padding: "56px 32px 140px" }}>
        <StepShell
          kicker={current.kicker}
          title={current.title}
          {...(current.subtitle ? { subtitle: current.subtitle } : {})}
        >
          {current.body}
        </StepShell>
      </main>

      <nav
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: "#0A0908",
          borderTop: `1px solid ${LINE}`,
        }}
      >
        <div
          style={{
            maxWidth: 900,
            margin: "0 auto",
            padding: "14px 32px",
            display: "flex",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          <button
            onClick={() => go(index - 1)}
            disabled={index === 0}
            className="text-label"
            style={{
              color: index === 0 ? LINE : MUTED,
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "transparent",
              cursor: index === 0 ? "default" : "pointer",
            }}
          >
            <ArrowLeft size={14} /> Back
          </button>
          <span className="text-label" style={{ color: MUTED, textAlign: "center", flex: 1 }}>
            {steps[index + 1]?.title ?? "End of walkthrough"}
          </span>
          <button
            onClick={() => go(index + 1)}
            disabled={index >= steps.length - 1}
            className="text-label"
            style={{
              color: index >= steps.length - 1 ? LINE : CREAM,
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "transparent",
              cursor: index >= steps.length - 1 ? "default" : "pointer",
            }}
          >
            Next <ArrowRight size={14} />
          </button>
        </div>
      </nav>
    </div>
  );
}
