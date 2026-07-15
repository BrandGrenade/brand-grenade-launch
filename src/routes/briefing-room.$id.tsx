import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, useCallback } from "react";
import { ArrowLeft, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { TopNav } from "@/components/TopNav";
import {
  getBriefingWorkspace,
  updateBriefingIntake,
  runBriefingStep1,
  runBriefingStep2,
  runBriefingStep3,
  runBriefingStep4,
  setBriefingSelections,
  getBriefingHandoffPreview,
} from "@/lib/briefing-room.functions";
import type {
  Step1Output,
  Step2Output,
  Step3Output,
  Step4Output,
  EvidenceItem,
} from "@/lib/briefing-room-prompts";
import type { HandoffPayload } from "@/lib/briefing-room-handoff";
import {
  BRIEF_SECTIONS,
  composeBriefText,
  type BriefFields,
} from "@/lib/brief-schema";
import {
  PENDING_BRIEF_STORAGE_KEY,
  saveBrief,
} from "@/components/SavedBriefsLibrary";

const ANCHOR_END_MARKER = "=== END BRIEFING ROOM STRATEGIC ANCHOR ===";

function extractAnchorBlock(briefText: string): string {
  const idx = briefText.indexOf(ANCHOR_END_MARKER);
  if (idx < 0) return "";
  return briefText.slice(0, idx + ANCHOR_END_MARKER.length);
}

export const Route = createFileRoute("/briefing-room/$id")({
  component: WorkspacePage,
  head: () => ({ meta: [{ title: "Briefing Workspace — Brand Grenade" }] }),
});

type Ws = Awaited<ReturnType<typeof getBriefingWorkspace>>;

function WorkspacePage() {
  const { id } = Route.useParams();
  const load = useServerFn(getBriefingWorkspace);
  const saveIntake = useServerFn(updateBriefingIntake);
  const step1 = useServerFn(runBriefingStep1);
  const step2 = useServerFn(runBriefingStep2);
  const step3 = useServerFn(runBriefingStep3);
  const step4 = useServerFn(runBriefingStep4);
  const setSel = useServerFn(setBriefingSelections);
  const previewHandoff = useServerFn(getBriefingHandoffPreview);
  const navigate = useNavigate();

  const [ws, setWs] = useState<Ws | null>(null);
  const [brand, setBrand] = useState("");
  const [category, setCategory] = useState("");
  const [rawBrief, setRawBrief] = useState("");
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [busyStep, setBusyStep] = useState<null | 1 | 2 | 3 | 4>(null);
  const [savingIntake, setSavingIntake] = useState(false);
  const [preview, setPreview] = useState<HandoffPayload | null>(null);
  const [editedFields, setEditedFields] = useState<BriefFields | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [approving, setApproving] = useState(false);
  const [ackGaps, setAckGaps] = useState(false);

  const refresh = useCallback(async () => {
    const w = await load({ data: { id } });
    setWs(w);
    setBrand(w.brand_name);
    setCategory(w.category);
    setRawBrief(w.raw_brief);
    setEvidence(w.supporting_evidence ?? []);
  }, [load, id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function persistIntake() {
    setSavingIntake(true);
    try {
      await saveIntake({
        data: {
          id,
          brandName: brand,
          category,
          rawBrief,
          evidence,
        },
      });
      toast.success("Intake saved");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSavingIntake(false);
    }
  }

  async function runStep(n: 1 | 2 | 3 | 4) {
    setBusyStep(n);
    try {
      // Autosave intake before Step 1 so the server sees latest.
      if (n === 1) {
        await saveIntake({
          data: { id, brandName: brand, category, rawBrief, evidence },
        });
      }
      const fn = n === 1 ? step1 : n === 2 ? step2 : n === 3 ? step3 : step4;
      await fn({ data: { id } });
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : `Step ${n} failed`);
    } finally {
      setBusyStep(null);
    }
  }

  async function pickFrame(frame: "problem" | "opportunity" | "both") {
    // Optimistic local update so the "✓ Selected" state and any downstream
    // validation clears immediately, without waiting on the round-trip.
    setWs((prev) => (prev ? { ...prev, selected_frame: frame } : prev));
    // Any previously-loaded Step 5 preview is now stale — its blockers were
    // computed against the old (null) frame. Drop it so the user doesn't see
    // "A frame must be selected in Step 1" after they've selected one.
    setPreview(null);
    setEditedFields(null);
    setAckGaps(false);
    try {
      await setSel({ data: { id, selectedFrame: frame } });
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Selection failed");
      await refresh();
    }
  }

  async function pickTension(idx: number) {
    setWs((prev) => (prev ? { ...prev, selected_tension_index: idx } : prev));
    setPreview(null);
    setEditedFields(null);
    setAckGaps(false);
    try {
      await setSel({ data: { id, selectedTensionIndex: idx } });
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Selection failed");
      await refresh();
    }
  }

  async function loadPreview() {
    setPreviewLoading(true);
    try {
      const p = await previewHandoff({ data: { id } });
      setPreview(p);
      // Seed the editable copy from the server-composed fields. All eleven
      // fields become user-editable at Step 5 — this is a human checkpoint;
      // the edited copy (not the system-generated draft) ships to Stage 1.
      setEditedFields(JSON.parse(JSON.stringify(p.briefFields)) as BriefFields);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Preview failed");
    } finally {
      setPreviewLoading(false);
    }
  }

  async function approveAndHandOff() {
    if (!preview || !preview.ready || !editedFields) return;
    if (preview.gaps.length > 0 && !ackGaps) {
      toast.error("Acknowledge the open gaps before handing off.");
      return;
    }
    setApproving(true);
    try {
      const anchor = extractAnchorBlock(preview.briefText);
      const composed = composeBriefText(editedFields);
      const briefText = anchor ? `${anchor}\n\n${composed}` : composed;
      const saved = await saveBrief({
        brandName: editedFields.brandName || brand,
        category: editedFields.category || category,
        briefText,
        briefFields: editedFields,
      });
      if (!saved) {
        setApproving(false);
        return;
      }
      if (typeof window !== "undefined") {
        sessionStorage.setItem(PENDING_BRIEF_STORAGE_KEY, JSON.stringify(saved));
      }
      toast.success("Handed off to Saved Briefs — review and run Stage 1.");
      navigate({ to: "/brief" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Handoff failed");
      setApproving(false);
    }
  }


  if (!ws) {
    return (
      <div className="min-h-screen bg-background">
        <TopNav />
        <main className="mx-auto w-full max-w-[960px] px-5 pt-10">
          <p className="text-body-sm text-text-tertiary">Loading workspace…</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <main className="mx-auto w-full max-w-[960px] px-5 pb-16 pt-10 sm:px-6">
        <Link
          to="/briefing-room"
          className="inline-flex items-center gap-1.5 text-body-sm text-text-secondary hover:text-text-primary"
        >
          <ArrowLeft size={14} /> Back to Briefing Room
        </Link>

        <header className="mt-6">
          <span className="text-label text-primary">Briefing Workspace</span>
          <h1 className="text-h1 mt-3 text-text-primary">
            {ws.brand_name || "(untitled)"}
          </h1>
          <p className="text-body-sm mt-1 text-text-tertiary">
            Diagnose → capture truths → judge relevance → surface tension → structure
            into an eleven-field brief that Stage 1 accepts as fixed priority input.
          </p>
        </header>

        {rawBrief.trimStart().startsWith("[FROM_INTELLIGENCE_ENGINE") ? (
          <div
            className="mt-6 rounded-md border p-4"
            style={{
              borderColor: "rgba(59,130,246,0.35)",
              backgroundColor: "rgba(59,130,246,0.08)",
            }}
          >
            <div className="text-label text-primary">Pre-diagnosed by the Intelligence Lab</div>
            <p className="text-body-sm mt-1 text-text-secondary">
              This session was created from a selected Strategic Territory
              Intelligence report. The strategic anchor, tension, audience, cultural
              context, and creative territory direction are authoritative inputs —
              Step 1 will treat them as fixed priority, not claims to interrogate away.
            </p>
          </div>
        ) : null}



        {/* ─── INTAKE ─── */}
        <SectionCard title="Intake" subtitle="Paste or type the raw brief. Add any supporting evidence as separately-labelled blocks — do not merge them.">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Brand">
              <input
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                className="input-base h-10 w-full"
              />
            </Field>
            <Field label="Category">
              <input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="input-base h-10 w-full"
              />
            </Field>
          </div>
          <Field label="Raw brief">
            <textarea
              value={rawBrief}
              onChange={(e) => setRawBrief(e.target.value)}
              className="input-base w-full p-3"
              style={{ minHeight: 260, lineHeight: 1.6 }}
              maxLength={50000}
              placeholder="Paste the client brief exactly as received. At least 20 characters."
            />
            <p className="text-body-sm mt-1.5 text-text-tertiary">
              {rawBrief.trim().length} characters
            </p>
          </Field>

          <div className="mt-4">
            <div className="flex items-center justify-between">
              <span className="text-label text-text-secondary">Supporting Evidence</span>
              <button
                type="button"
                onClick={() =>
                  setEvidence((ev) => [...ev, { label: "", type: "research", content: "" }])
                }
                className="inline-flex items-center gap-1 text-body-sm text-primary hover:opacity-80"
              >
                <Plus size={13} /> Add evidence block
              </button>
            </div>
            <p className="text-body-sm mt-1 text-text-tertiary">
              For the EY / KPMG demo, label anything concocted as{" "}
              <span className="italic">ILLUSTRATIVE</span> — never present it as real client data.
            </p>
            <div className="mt-3 flex flex-col gap-3">
              {evidence.map((e, i) => (
                <div
                  key={i}
                  className="rounded-md p-3"
                  style={{ backgroundColor: "#141414", border: "1px solid #2A2A2A" }}
                >
                  <div className="flex items-center gap-2">
                    <input
                      value={e.label}
                      onChange={(ev) =>
                        setEvidence((arr) =>
                          arr.map((x, j) => (j === i ? { ...x, label: ev.target.value } : x)),
                        )
                      }
                      placeholder="Label (e.g. Nielsen Q3 tracking [ILLUSTRATIVE])"
                      className="input-base h-9 flex-1"
                    />
                    <select
                      value={e.type}
                      onChange={(ev) =>
                        setEvidence((arr) =>
                          arr.map((x, j) => (j === i ? { ...x, type: ev.target.value } : x)),
                        )
                      }
                      className="input-base h-9"
                    >
                      <option value="research">research</option>
                      <option value="tracking">tracking</option>
                      <option value="competitor">competitor</option>
                      <option value="qualitative">qualitative</option>
                      <option value="human_input">human input</option>
                      <option value="other">other</option>
                    </select>
                    <button
                      type="button"
                      onClick={() =>
                        setEvidence((arr) => arr.filter((_, j) => j !== i))
                      }
                      className="text-text-tertiary hover:text-red-400"
                      aria-label="Remove"
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <textarea
                    value={e.content}
                    onChange={(ev) =>
                      setEvidence((arr) =>
                        arr.map((x, j) => (j === i ? { ...x, content: ev.target.value } : x)),
                      )
                    }
                    placeholder="Paste the evidence text. Numbers, quotes, tracking figures, competitor context."
                    className="input-base mt-2 w-full p-2"
                    style={{ minHeight: 120, lineHeight: 1.5 }}
                    maxLength={50000}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={persistIntake}
              disabled={savingIntake}
              className="inline-flex h-9 items-center rounded-md px-4 text-[13px] font-semibold disabled:opacity-50"
              style={{ border: "1px solid var(--color-border)", color: "var(--color-text-primary)" }}
            >
              {savingIntake ? "Saving…" : "Save intake"}
            </button>
          </div>
        </SectionCard>

        {/* ─── STEP 1 ─── */}
        <StepCard
          n={1}
          title="Diagnose the real problem / opportunity"
          subtitle="Interrogate past the stated brief. Surface BOTH frames — the same truth run through opposite lenses often yields opposite territory."
          onRun={() => runStep(1)}
          busy={busyStep === 1}
          hasOutput={!!ws.diagnosis}
          runLabel={ws.diagnosis ? "Re-run diagnosis" : "Run diagnosis"}
          disabled={rawBrief.trim().length < 20}
          disabledReason="Raw brief must be at least 20 characters."
        >
          {ws.diagnosis && (
            <Step1View
              data={ws.diagnosis}
              selectedFrame={ws.selected_frame}
              onPick={pickFrame}
            />
          )}
        </StepCard>

        {/* ─── STEP 2 ─── */}
        <StepCard
          n={2}
          title="Define the truths"
          subtitle="Aggregate every truth in the raw brief and evidence. Four types, source-tagged, type-tagged, motivator-vs-discriminator flagged. Missing truth-types are surfaced honestly."
          onRun={() => runStep(2)}
          busy={busyStep === 2}
          hasOutput={!!ws.truths}
          runLabel={ws.truths ? "Re-run truth capture" : "Capture truths"}
          disabled={rawBrief.trim().length < 20}
          disabledReason="Raw brief must be at least 20 characters."
        >
          {ws.truths && <Step2View data={ws.truths} />}
        </StepCard>

        {/* ─── STEP 3 ─── */}
        <StepCard
          n={3}
          title="Establish relevance"
          subtitle="For each captured truth, connect it to the real problem/opportunity — or set it aside. Relevance can only be judged after Step 1."
          onRun={() => runStep(3)}
          busy={busyStep === 3}
          hasOutput={!!ws.relevance}
          runLabel={ws.relevance ? "Re-run relevance" : "Run relevance"}
          disabled={!ws.diagnosis || !ws.truths}
          disabledReason="Run Steps 1 and 2 first."
        >
          {ws.relevance && ws.truths && (
            <Step3View data={ws.relevance} truths={ws.truths.truths} />
          )}
        </StepCard>

        {/* ─── STEP 4 ─── */}
        <StepCard
          n={4}
          title="Collide → find the tension"
          subtitle="Truth alone is inert. Surface 2–3 candidate tensions. The human picks the one that drives the brief. If no genuine tension emerges, that flag IS the Briefing Room earning its keep."
          onRun={() => runStep(4)}
          busy={busyStep === 4}
          hasOutput={!!ws.tensions}
          runLabel={ws.tensions ? "Re-run tension search" : "Find tensions"}
          disabled={!ws.relevance}
          disabledReason="Run Steps 1–3 first."
        >
          {ws.tensions && (
            <Step4View
              data={ws.tensions}
              selectedIndex={ws.selected_tension_index}
              onPick={pickTension}
            />
          )}
        </StepCard>

        {/* ─── STEP 5 — STRUCTURE + PREVIEW ─── */}
        <StepCard
          n={5}
          title="Structure into Stage 1 format"
          subtitle="Compose the eleven-field brief plus the load-bearing Briefing Room Anchor block. Stage 1 has been amended to preserve the anchored tension verbatim in its Section 2 — no substitution, no dilution."
          onRun={loadPreview}
          busy={previewLoading}
          hasOutput={!!preview}
          runLabel={preview ? "Re-preview" : "Preview handoff"}
          disabled={!ws.tensions}
          disabledReason="Run Steps 1–4 first."
        >
          {preview && editedFields && (
            <HandoffPreviewView
              preview={preview}
              fields={editedFields}
              onFieldChange={(key, value) =>
                setEditedFields((prev) =>
                  prev
                    ? {
                        ...prev,
                        sections: { ...prev.sections, [key]: value },
                      }
                    : prev,
                )
              }
            />
          )}
        </StepCard>

        {/* ─── STEP 6 — APPROVE + HAND OFF ─── */}
        <section
          className="mt-6 rounded-md p-5"
          style={{ backgroundColor: "#101010", border: "1px solid #2A2A2A" }}
        >
          <div className="text-label text-primary">STEP 6</div>
          <h2 className="text-h3 mt-1 text-text-primary">Approve → hand off to Saved Briefs</h2>
          <p className="text-body-sm mt-1 text-text-tertiary">
            Lands the structured brief in your Saved Briefs library and opens it in the
            structured editor. Review, then use the existing Save-and-Run to fire Stage 1.
            The load-bearing tension rides in as an anchor block AND inside the barrier
            field — Stage 1 is instructed to preserve it verbatim in Section 2.
          </p>

          {!preview && (
            <p className="text-body-sm mt-4 text-text-tertiary">
              Run Step 5 (Preview handoff) first.
            </p>
          )}

          {preview && (
            <div className="mt-4">
              {preview.blockers.length > 0 && (
                <div
                  className="rounded-md p-3"
                  style={{ backgroundColor: "#2A1414", border: "1px solid #5C2A2A", color: "#F0A0A0" }}
                >
                  <div className="text-label mb-1">BLOCKERS</div>
                  <ul className="text-body-sm list-disc pl-5">
                    {preview.blockers.map((b, i) => <li key={i}>{b}</li>)}
                  </ul>
                </div>
              )}
              {preview.warnings.length > 0 && (
                <div
                  className="mt-3 rounded-md p-3"
                  style={{ backgroundColor: "#1A1611", border: "1px solid #3A2E1E", color: "#D4924A" }}
                >
                  <div className="text-label mb-1">WARNINGS</div>
                  <ul className="text-body-sm list-disc pl-5">
                    {preview.warnings.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </div>
              )}
              {preview.gaps.length > 0 && (
                <label className="mt-3 flex items-start gap-2 text-body-sm text-text-secondary">
                  <input
                    type="checkbox"
                    checked={ackGaps}
                    onChange={(e) => setAckGaps(e.target.checked)}
                    className="mt-1"
                  />
                  <span>
                    I acknowledge {preview.gaps.length} open gap{preview.gaps.length === 1 ? "" : "s"}{" "}
                    will be preserved in the brief and surfaced to Stage 1 as flags. The Briefing
                    Room does not paper over what it flagged.
                  </span>
                </label>
              )}
              <button
                type="button"
                onClick={approveAndHandOff}
                disabled={
                  approving ||
                  !preview.ready ||
                  (preview.gaps.length > 0 && !ackGaps)
                }
                className="mt-4 inline-flex h-10 items-center rounded-md px-5 text-[13px] font-semibold disabled:opacity-50"
                style={{ backgroundColor: "#D4924A", color: "#0A0A0A" }}
              >
                {approving ? "Handing off…" : "Approve and hand off to Saved Briefs"}
              </button>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

// ─── Presentational bits ────────────────────────────────────────────

function SectionCard(props: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className="mt-8 rounded-md p-5"
      style={{ backgroundColor: "#101010", border: "1px solid #2A2A2A" }}
    >
      <h2 className="text-h3 text-text-primary">{props.title}</h2>
      {props.subtitle && (
        <p className="text-body-sm mt-1 text-text-tertiary">{props.subtitle}</p>
      )}
      <div className="mt-4">{props.children}</div>
    </section>
  );
}

function StepCard(props: {
  n: number;
  title: string;
  subtitle: string;
  onRun: () => void;
  busy: boolean;
  hasOutput: boolean;
  runLabel: string;
  disabled?: boolean;
  disabledReason?: string;
  children?: React.ReactNode;
}) {
  return (
    <section
      className="mt-6 rounded-md p-5"
      style={{ backgroundColor: "#101010", border: "1px solid #2A2A2A" }}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-label text-primary">STEP {props.n}</div>
          <h2 className="text-h3 mt-1 text-text-primary">{props.title}</h2>
          <p className="text-body-sm mt-1 text-text-tertiary">{props.subtitle}</p>
        </div>
        <div className="shrink-0">
          <button
            type="button"
            onClick={props.onRun}
            disabled={props.busy || props.disabled}
            title={props.disabled ? props.disabledReason : undefined}
            className="inline-flex h-9 items-center rounded-md px-4 text-[13px] font-semibold disabled:opacity-50"
            style={{ backgroundColor: "#D4924A", color: "#0A0A0A" }}
          >
            {props.busy ? "Running…" : props.runLabel}
          </button>
        </div>
      </div>
      {props.disabled && (
        <p className="text-body-sm mt-2 text-text-tertiary">{props.disabledReason}</p>
      )}
      {props.children && <div className="mt-4">{props.children}</div>}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-label text-text-secondary">{label}</span>
      {children}
    </label>
  );
}

function SourcePills({ sources }: { sources: string[] }) {
  if (!sources?.length) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {sources.map((s, i) => (
        <span
          key={i}
          className="text-[10px] uppercase tracking-wider"
          style={{
            padding: "2px 6px",
            borderRadius: 4,
            backgroundColor: "#1A1611",
            color: "#D4924A",
            border: "1px solid #3A2E1E",
          }}
        >
          {s}
        </span>
      ))}
    </div>
  );
}

function Step1View(props: {
  data: Step1Output;
  selectedFrame: string | null;
  onPick: (frame: "problem" | "opportunity" | "both") => void;
}) {
  const { data } = props;
  const FrameCard = (which: "problem" | "opportunity") => {
    const item = which === "problem" ? data.real_problem : data.real_opportunity;
    const selected = props.selectedFrame === which;
    return (
      <div
        className="flex-1 rounded-md p-4"
        style={{
          backgroundColor: selected ? "#1A1611" : "#141414",
          border: `1px solid ${selected ? "#D4924A" : "#2A2A2A"}`,
        }}
      >
        <div className="text-label" style={{ color: which === "problem" ? "#C97070" : "#7CB57C" }}>
          {which === "problem" ? "REAL PROBLEM (defensive)" : "REAL OPPORTUNITY (generative)"}
        </div>
        <p className="text-body mt-2 text-text-primary">{item.statement}</p>
        <SourcePills sources={item.sources} />
        <button
          type="button"
          onClick={() => props.onPick(which)}
          className="mt-3 text-body-sm text-primary hover:opacity-80"
        >
          {selected ? "✓ Selected" : "Choose this frame"}
        </button>
      </div>
    );
  };
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row">
        {FrameCard("problem")}
        {FrameCard("opportunity")}
      </div>
      <div
        className="rounded-md p-4"
        style={{ backgroundColor: "#141414", border: "1px solid #2A2A2A" }}
      >
        <div className="text-label text-text-secondary">WHY ARE WE HERE (causal read)</div>
        <p className="text-body mt-2 text-text-primary">{data.why_are_we_here.statement}</p>
        <SourcePills sources={data.why_are_we_here.sources} />
      </div>
      <div
        className="rounded-md p-4"
        style={{ backgroundColor: "#141414", border: "1px solid #2A2A2A" }}
      >
        <div className="text-label text-text-secondary">PROBLEM SHAPE(S)</div>
        <p className="text-body mt-2 text-text-primary">
          {data.problem_shapes.join(", ") || "—"}
        </p>
      </div>
      {data.gaps.length > 0 && <GapsBlock title="EVIDENCE GAPS" gaps={data.gaps} />}
      <button
        type="button"
        onClick={() => props.onPick("both")}
        className="self-start text-body-sm text-text-tertiary hover:text-text-primary"
      >
        Keep both frames open
      </button>
    </div>
  );
}

function Step2View({ data }: { data: Step2Output }) {
  const groups: Array<[Step2Output["truths"][number]["category"], string]> = [
    ["product", "Product truths"],
    ["human", "Human truths"],
    ["cultural", "Cultural truths"],
    ["brand", "Brand / personal truths"],
  ];
  return (
    <div className="flex flex-col gap-4">
      {groups.map(([key, label]) => {
        const items = data.truths.filter((t) => t.category === key);
        return (
          <div key={key}>
            <div className="text-label text-text-secondary">{label}</div>
            {items.length === 0 ? (
              <p className="text-body-sm mt-1 text-text-tertiary italic">
                None captured — {data.missing_types.includes(key) ? "flagged as missing." : "not present in the supplied material."}
              </p>
            ) : (
              <ul className="mt-2 flex flex-col gap-2">
                {items.map((t, i) => (
                  <li
                    key={i}
                    className="rounded-md p-3"
                    style={{ backgroundColor: "#141414", border: "1px solid #2A2A2A" }}
                  >
                    <p className="text-body text-text-primary">{t.text}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <TagBadge label={t.source} tone="source" />
                      <TagBadge label={t.tag_type} tone={t.tag_type === "qualitative" ? "qual" : "quant"} />
                      <TagBadge label={t.role} tone={t.role === "discriminator" ? "good" : "warn"} />
                      {t.thorpe_candidate && <TagBadge label="Thorpe candidate" tone="thorpe" />}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
      {data.missing_generative_qualitative_fact && (
        <div
          className="rounded-md p-3"
          style={{ backgroundColor: "#2A1A0A", border: "1px solid #6B3A10", color: "#F0C88A" }}
        >
          <div className="text-label">MISSING: GENERATIVE QUALITATIVE FACT</div>
          <p className="text-body-sm mt-1">
            No Thorpe-level reframing fact is present. Without one, downstream strategy risks
            wallpaper. Consider commissioning short qual to source it.
          </p>
        </div>
      )}
      {data.notes.length > 0 && (
        <div>
          <div className="text-label text-text-secondary">Notes</div>
          <ul className="mt-1 list-disc pl-5">
            {data.notes.map((n, i) => (
              <li key={i} className="text-body-sm text-text-tertiary">
                {n}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Step3View({
  data,
  truths,
}: {
  data: Step3Output;
  truths: Step2Output["truths"];
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-body-sm text-text-secondary">{data.summary}</p>
      {(["relevant", "set_aside"] as const).map((v) => {
        const items = data.relevance.filter((r) => r.verdict === v);
        if (items.length === 0) return null;
        return (
          <div key={v}>
            <div className="text-label text-text-secondary">
              {v === "relevant" ? "RELEVANT TO REAL PROBLEM" : "SET ASIDE"}
            </div>
            <ul className="mt-2 flex flex-col gap-2">
              {items.map((r) => {
                const t = truths[r.truth_index];
                if (!t) return null;
                return (
                  <li
                    key={r.truth_index}
                    className="rounded-md p-3"
                    style={{ backgroundColor: "#141414", border: "1px solid #2A2A2A" }}
                  >
                    <div className="text-body-sm text-text-tertiary uppercase tracking-wider">
                      {t.category}
                    </div>
                    <p className="text-body mt-1 text-text-primary">{t.text}</p>
                    <p className="text-body-sm mt-2 italic text-text-secondary">
                      {r.connection}
                    </p>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function Step4View(props: {
  data: Step4Output;
  selectedIndex: number | null;
  onPick: (i: number) => void;
}) {
  if (props.data.no_tension_flag) {
    return (
      <div
        className="rounded-md p-4"
        style={{ backgroundColor: "#2A1A0A", border: "1px solid #6B3A10", color: "#F0C88A" }}
      >
        <div className="text-label">NO TENSION YET</div>
        <p className="text-body-sm mt-1">{props.data.no_tension_reason}</p>
      </div>
    );
  }
  return (
    <ul className="flex flex-col gap-3">
      {props.data.candidate_tensions.map((c, i) => {
        const selected = props.selectedIndex === i;
        return (
          <li
            key={i}
            className="rounded-md p-4"
            style={{
              backgroundColor: selected ? "#1A1611" : "#141414",
              border: `1px solid ${selected ? "#D4924A" : "#2A2A2A"}`,
            }}
          >
            <div className="text-label text-text-secondary">
              CANDIDATE #{i + 1} · frame: {c.frame}
            </div>
            <p className="text-body mt-2 text-text-primary">{c.statement}</p>
            <p className="text-body-sm mt-2 italic text-text-secondary">{c.why_it_matters}</p>
            <p className="text-body-sm mt-2 text-text-tertiary">
              Collides truths #{c.collided_truth_indices.join(", #")}
            </p>
            <button
              type="button"
              onClick={() => props.onPick(i)}
              className="mt-3 text-body-sm text-primary hover:opacity-80"
            >
              {selected ? "✓ Selected as the load-bearing tension" : "Select this tension"}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function GapsBlock({ title, gaps }: { title: string; gaps: string[] }) {
  return (
    <div
      className="rounded-md p-3"
      style={{ backgroundColor: "#2A1A0A", border: "1px solid #6B3A10", color: "#F0C88A" }}
    >
      <div className="text-label">{title}</div>
      <ul className="mt-1 list-disc pl-5">
        {gaps.map((g, i) => (
          <li key={i} className="text-body-sm">
            {g}
          </li>
        ))}
      </ul>
    </div>
  );
}

function TagBadge({
  label,
  tone,
}: {
  label: string;
  tone: "source" | "qual" | "quant" | "good" | "warn" | "thorpe";
}) {
  const palette: Record<string, { bg: string; fg: string; bd: string }> = {
    source: { bg: "#141414", fg: "#8A8680", bd: "#2A2A2A" },
    qual: { bg: "#0F1A14", fg: "#7CB57C", bd: "#1E3A2E" },
    quant: { bg: "#0F141A", fg: "#7C99B5", bd: "#1E2E3A" },
    good: { bg: "#0F1A14", fg: "#7CB57C", bd: "#1E3A2E" },
    warn: { bg: "#1A1611", fg: "#D4924A", bd: "#3A2E1E" },
    thorpe: { bg: "#2A1A0A", fg: "#F0C88A", bd: "#6B3A10" },
  };
  const p = palette[tone];
  return (
    <span
      className="text-[10px] uppercase tracking-wider"
      style={{
        padding: "2px 6px",
        borderRadius: 4,
        backgroundColor: p.bg,
        color: p.fg,
        border: `1px solid ${p.bd}`,
      }}
    >
      {label}
    </span>
  );
}

function HandoffPreviewView({
  preview,
  fields,
  onFieldChange,
}: {
  preview: HandoffPayload;
  fields: BriefFields;
  onFieldChange: (key: string, value: string) => void;
}) {
  const [showBrief, setShowBrief] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      <div
        className="rounded-md p-3"
        style={{ backgroundColor: "#141414", border: "1px solid #2A2A2A" }}
      >
        <div className="text-label" style={{ color: "#D4924A" }}>
          ANCHORED TENSION (rides into Stage 1 verbatim)
        </div>
        <p className="text-body mt-2 text-text-primary whitespace-pre-wrap">
          {extractAnchoredTension(preview.briefText) ?? "(none — no-tension flag preserved)"}
        </p>
      </div>

      <p className="text-body-sm text-text-tertiary">
        Human checkpoint — every field below is editable. Edit or replace the
        system-generated draft before approving. Your edited copy is what ships
        to Stage 1.
      </p>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {BRIEF_SECTIONS.flatMap((section) =>
          section.fields.map((field) => (
            <EditableMiniField
              key={field.key}
              label={`${section.num} · ${section.title}`}
              value={fields.sections[field.key] ?? ""}
              onChange={(v) => onFieldChange(field.key, v)}
            />
          )),
        )}
      </div>

      <button
        type="button"
        onClick={() => setShowBrief((v) => !v)}
        className="mt-2 self-start text-body-sm text-primary hover:opacity-80"
      >
        {showBrief ? "Hide" : "Show"} full brief_text that ships to Stage 1
      </button>
      {showBrief && (
        <pre
          className="mt-1 max-h-[420px] overflow-auto rounded-md p-3 text-[12px] leading-[1.55] whitespace-pre-wrap"
          style={{ backgroundColor: "#0A0A0A", border: "1px solid #2A2A2A", color: "#D8D3CC" }}
        >
          {(() => {
            const anchor = extractAnchorBlock(preview.briefText);
            const composed = composeBriefText(fields);
            return anchor ? `${anchor}\n\n${composed}` : composed;
          })()}
        </pre>
      )}
    </div>
  );
}

function EditableMiniField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div
      className="rounded-md p-3"
      style={{ backgroundColor: "#141414", border: "1px solid #2A2A2A" }}
    >
      <div className="text-label" style={{ color: "#8A8580" }}>{label}</div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input-base mt-1.5 w-full p-2 text-body-sm text-text-primary"
        style={{ minHeight: 120, lineHeight: 1.55 }}
        maxLength={50000}
      />
    </div>
  );
}

function extractAnchoredTension(briefText: string): string | null {
  const m = briefText.match(
    /ANCHORED TENSION[^:\n]*:[^\n]*\n\s{2,}(.+?)(?:\n\s{2,}Frame:|\n\s*\n|\n===)/s,
  );
  return m ? m[1].trim() : null;
}
