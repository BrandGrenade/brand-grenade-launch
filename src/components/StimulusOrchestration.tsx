// CREATIVE STIMULUS ENGINE — PHASE 3 UI. The Orchestration Engine.
// Session-level: runs across every Gate One-confirmed channel at once.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  startOrchestration,
  runOrchestrationStep,
  loadOrchestrationState,
  listOrchestrations,
  setCrossRefDecision,
  rejectPromptAtCd,
  getBrandAssetRules,
  saveBrandAssetRules,
} from "@/lib/stimulus-orchestration.functions";
import {
  setGateTwoApproval,
  sendPromptBackWithNotes,
  retrySetWithAmendment,
  confirmGateTwo,
  getFullFinishedExport,
} from "@/lib/stimulus-gate-two.functions";
import { buildFullFinishedExport, download } from "@/lib/stimulus-export";
import { SIGNATURE_CATEGORIES } from "@/lib/stimulus/orchestration-prompts";


const AMBER = "#C81E1E";
const MUTED = "#8B8680";
const RED = "#C81E1E";
const GREEN = "#C81E1E";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

const PHASES: { id: string; label: string }[] = [
  { id: "initial_prompts", label: "Initial prompts" },
  { id: "extract", label: "1 · Signature Registry" },
  { id: "propagate", label: "2 · Propagation" },
  { id: "wad", label: "3 · Writer / AD" },
  { id: "cd", label: "4 · Creative Director" },
  { id: "complete", label: "Ready for Gate Two" },
];

function Btn({
  children,
  onClick,
  active,
  disabled,
  tone,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
  tone?: string;
}) {
  const colour = tone ?? AMBER;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="text-mono"
      style={{
        border: `1px solid ${active ? colour : "#1C1A18"}`,
        background: active ? `${colour}1A` : "transparent",
        color: active ? colour : MUTED,
        borderRadius: 6,
        padding: "6px 12px",
        fontSize: 11,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  );
}

function Label({ children, tone }: { children: React.ReactNode; tone?: string }) {
  return (
    <span
      className="text-mono"
      style={{
        color: tone ?? MUTED,
        border: `1px solid ${tone ?? "#1C1A18"}`,
        borderRadius: 4,
        padding: "2px 7px",
        fontSize: 10,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
      }}
    >
      {children}
    </span>
  );
}

function BrandAssetPanel({ brandName }: { brandName: string }) {
  const get = useServerFn(getBrandAssetRules);
  const save = useServerFn(saveBrandAssetRules);
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({
    colours: "",
    logoReferences: "",
    typography: "",
    packagingRules: "",
    legalLines: "",
    notes: "",
  });

  useEffect(() => {
    if (!open || !brandName) return;
    void (async () => {
      const r = await get({ data: { brandName } });
      if (r.rules)
        setForm({
          colours: r.rules.colours,
          logoReferences: r.rules.logoReferences,
          typography: r.rules.typography,
          packagingRules: r.rules.packagingRules,
          legalLines: r.rules.legalLines,
          notes: r.rules.notes,
        });
    })();
  }, [open, brandName, get]);

  const field = (key: keyof typeof form, label: string, placeholder: string) => (
    <label style={{ display: "block", marginBottom: 10 }}>
      <span className="text-mono" style={{ color: MUTED, fontSize: 10, letterSpacing: "0.1em" }}>
        {label.toUpperCase()}
      </span>
      <textarea
        value={form[key]}
        onChange={(e) => {
          setSaved(false);
          setForm((f) => ({ ...f, [key]: e.target.value }));
        }}
        placeholder={placeholder}
        rows={2}
        style={{
          width: "100%",
          marginTop: 4,
          background: "#0A0908",
          color: "#EDE8E0",
          border: "1px solid #1C1A18",
          borderRadius: 6,
          padding: 8,
          fontFamily: "inherit",
          fontSize: 13,
        }}
      />
    </label>
  );

  return (
    <div style={{ border: "1px solid #1C1A18", borderRadius: 8, padding: 14, marginBottom: 16 }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{ background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left" }}
      >
        <span className="text-mono" style={{ color: AMBER, fontSize: 11, letterSpacing: "0.12em" }}>
          BRAND ASSET LIBRARY — {brandName.toUpperCase()}
        </span>
        <div className="text-body-sm" style={{ color: MUTED, marginTop: 4 }}>
          Rules and references only. Brand Grenade never hosts or generates the real asset files — prompts
          reference the client's approved asset instead of asking a tool to recreate it. Reusable across
          sessions for this brand. {open ? "Hide" : "Edit"}.
        </div>
      </button>
      {open && (
        <div style={{ marginTop: 12 }}>
          {field("colours", "Colours", "Primary #XXXXXX, secondary …")}
          {field("logoReferences", "Logo references", "Logo per client's approved Adobe CC Library asset X")}
          {field("typography", "Typography", "Brand typeface, licensed weights")}
          {field("packagingRules", "Packaging placement rules", "Pack must appear front-facing, lower right third …")}
          {field("legalLines", "Mandatory legal lines", "Required disclaimers")}
          {field("notes", "Other rules", "Clear space, co-branding, restrictions")}
          <Btn
            active
            onClick={async () => {
              await save({ data: { brandName, ...form } });
              setSaved(true);
            }}
          >
            {saved ? "Saved" : "Save brand rules"}
          </Btn>
        </div>
      )}
    </div>
  );
}

export function StimulusOrchestration({ sessionId, brandName }: { sessionId: string; brandName: string }) {
  const start = useServerFn(startOrchestration);
  const step = useServerFn(runOrchestrationStep);
  const load = useServerFn(loadOrchestrationState);
  const list = useServerFn(listOrchestrations);
  const decide = useServerFn(setCrossRefDecision);
  const reject = useServerFn(rejectPromptAtCd);
  const approveTwo = useServerFn(setGateTwoApproval);
  const sendBack = useServerFn(sendPromptBackWithNotes);
  const retrySet = useServerFn(retrySetWithAmendment);
  const confirmTwo = useServerFn(confirmGateTwo);
  const fullExport = useServerFn(getFullFinishedExport);

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string>("");
  const [orchId, setOrchId] = useState<string | null>(null);
  const [runs, setRuns] = useState<Row[]>([]);
  const [state, setState] = useState<{
    orchestration: Row;
    prompts: Row[];
    signatures: Row[];
    crossRefs: Row[];
  } | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [rejectFor, setRejectFor] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [sendBackFor, setSendBackFor] = useState<string | null>(null);
  const [sendBackNotes, setSendBackNotes] = useState("");
  const [gateTwoNote, setGateTwoNote] = useState("");
  const [amendNotes, setAmendNotes] = useState("");
  const [showAmend, setShowAmend] = useState(false);


  const refreshList = useCallback(async () => {
    const r = await list({ data: { sessionId } });
    setRuns(r.orchestrations as Row[]);
  }, [list, sessionId]);

  useEffect(() => {
    if (open) void refreshList();
  }, [open, refreshList]);

  const refreshState = useCallback(
    async (id: string) => {
      const s = await load({ data: { orchestrationId: id } });
      setState(s as any);
    },
    [load],
  );

  const drive = useCallback(
    async (id: string) => {
      setBusy(true);
      setErr(null);
      try {
        let done = false;
        let guard = 0;
        while (!done && guard < 60) {
          guard += 1;
          const r = await step({ data: { orchestrationId: id } });
          done = r.done;
          setNote(`${r.phase} — ${r.note}`);
          await refreshState(id);
        }
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Orchestration failed");
        await refreshState(id);
      } finally {
        setBusy(false);
      }
    },
    [step, refreshState],
  );

  const handleStart = async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await start({ data: { sessionId } });
      setOrchId(r.orchestrationId);
      await refreshList();
      await drive(r.orchestrationId);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not start orchestration");
      setBusy(false);
    }
  };

  const openRun = async (id: string) => {
    setOrchId(id);
    await refreshState(id);
  };

  const orch = state?.orchestration;
  const activePrompts = useMemo(
    () => (state?.prompts ?? []).filter((p) => p.status === "active"),
    [state],
  );
  const rejectedPrompts = useMemo(
    () => (state?.prompts ?? []).filter((p) => p.status !== "active"),
    [state],
  );
  const activeSignatures = useMemo(
    () => (state?.signatures ?? []).filter((s) => s.status === "active"),
    [state],
  );
  const retiredSignatures = useMemo(
    () => (state?.signatures ?? []).filter((s) => s.status !== "active"),
    [state],
  );
  const refsFor = (promptId: string) =>
    (state?.crossRefs ?? []).filter((c) => c.prompt_id === promptId);

  return (
    <div style={{ marginTop: 28, border: `1px solid ${AMBER}33`, borderRadius: 8, padding: 20, backgroundColor: "#0A0908" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{ width: "100%", textAlign: "left", background: "none", border: "none", padding: 0, cursor: "pointer" }}
      >
        <div className="text-mono" style={{ color: AMBER, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase" }}>
          Orchestration Engine — Writer / AD / CD passes
        </div>
        <div className="text-body-sm" style={{ color: MUTED, marginTop: 6 }}>
          Runs on the Gate One-approved set across every confirmed channel at once. Builds the Campaign
          Signature Registry, suggests cross-references, applies the craft pass, then a Creative Director
          judgment on the whole set. {open ? "Hide" : "Open"}.
        </div>
      </button>

      {open && (
        <div style={{ marginTop: 18 }}>
          <BrandAssetPanel brandName={brandName} />

          {err && (
            <div className="text-body-sm" style={{ color: RED, marginBottom: 12 }}>
              {err}
            </div>
          )}

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <Btn active disabled={busy} onClick={handleStart}>
              {busy ? "Running…" : "Run orchestration on approved set"}
            </Btn>
            {runs.map((r) => (
              <Btn key={r.id} active={r.id === orchId} disabled={busy} onClick={() => void openRun(r.id)}>
                {`${r.status} · v${r.registry_version} · ${new Date(r.created_at).toLocaleDateString()} · ${String(r.id).slice(0, 6)}`}
              </Btn>
            ))}
            {orchId && !busy && (
              <Btn onClick={() => void drive(orchId)}>Resume</Btn>
            )}
          </div>

          {note && (
            <div className="text-mono" style={{ color: MUTED, fontSize: 10, marginTop: 10, letterSpacing: "0.1em" }}>
              {note.toUpperCase()}
            </div>
          )}

          {orch && (
            <>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 14 }}>
                {PHASES.map((p) => (
                  <Label key={p.id} tone={orch.status === p.id ? AMBER : undefined}>
                    {p.label}
                  </Label>
                ))}
                <Label tone={MUTED}>{`registry v${orch.registry_version}`}</Label>
              </div>
              {orch.phase_note && (
                <div className="text-body-sm" style={{ color: MUTED, marginTop: 8 }}>
                  {orch.phase_note}
                </div>
              )}

              {/* ---------------- Campaign Signature Registry ---------------- */}
              <div style={{ marginTop: 20 }}>
                <div className="text-mono" style={{ color: AMBER, fontSize: 10, letterSpacing: "0.12em" }}>
                  CAMPAIGN SIGNATURE REGISTRY — {activeSignatures.length} ACTIVE
                  {retiredSignatures.length ? ` · ${retiredSignatures.length} RETIRED` : ""}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10, marginTop: 10 }}>
                  {activeSignatures.map((s) => (
                    <div key={s.id} style={{ border: "1px solid #1C1A18", borderRadius: 6, padding: 10 }}>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
                        <Label tone={AMBER}>
                          {SIGNATURE_CATEGORIES.find((c) => c.id === s.category)?.label ?? s.category}
                        </Label>
                        {s.origin === "instinct_brief" && <Label tone={GREEN}>human instinct</Label>}
                        <Label>{s.source_channel}</Label>
                      </div>
                      <div className="text-body-sm" style={{ color: "#EDE8E0" }}>{s.name}</div>
                      <div className="text-body-sm" style={{ color: MUTED, marginTop: 4 }}>{s.description}</div>
                    </div>
                  ))}
                  {retiredSignatures.map((s) => (
                    <div key={s.id} style={{ border: `1px dashed ${RED}55`, borderRadius: 6, padding: 10, opacity: 0.7 }}>
                      <Label tone={RED}>retired</Label>
                      <div className="text-body-sm" style={{ color: MUTED, marginTop: 6 }}>
                        {s.name} — {s.retired_reason}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ---------------- Prompts ---------------- */}
              <div style={{ marginTop: 22, display: "grid", gap: 12 }}>
                {activePrompts.map((p) => {
                  const refs = refsFor(p.id);
                  const isOpen = expanded === p.id;
                  const tone =
                    p.wad_status === "flagged" ? RED : p.wad_status === "pending" ? MUTED : GREEN;
                  return (
                    <div key={p.id} style={{ border: "1px solid #1C1A18", borderRadius: 8, padding: 14 }}>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                        <Label tone={AMBER}>{p.channel_name}</Label>
                        <Label>{p.lens_name}</Label>
                        <Label tone={tone}>{`craft: ${p.wad_status}`}</Label>
                        {refs.length > 0 && <Label>{`${refs.length} cross-ref`}</Label>}
                        <Btn onClick={() => setExpanded(isOpen ? null : p.id)}>{isOpen ? "Collapse" : "Open"}</Btn>
                        <Btn tone={RED} onClick={() => setRejectFor(rejectFor === p.id ? null : p.id)}>
                          Reject at CD
                        </Btn>
                        {orch.status === "complete" && (
                          <>
                            <Label tone={p.gate_two_approved ? GREEN : MUTED}>
                              {p.gate_two_approved ? "gate two: signed off" : "gate two: pending"}
                            </Label>
                            <Btn
                              tone={GREEN}
                              active={Boolean(p.gate_two_approved)}
                              disabled={busy || Boolean(orch.gate_two_confirmed)}
                              onClick={async () => {
                                setBusy(true);
                                setErr(null);
                                try {
                                  await approveTwo({
                                    data: { promptId: p.id, approved: !p.gate_two_approved },
                                  });
                                  if (orchId) await refreshState(orchId);
                                } catch (e) {
                                  setErr(e instanceof Error ? e.message : "Gate Two sign-off failed");
                                } finally {
                                  setBusy(false);
                                }
                              }}
                            >
                              {p.gate_two_approved ? "Signed off — undo" : "Sign off (on-brief)"}
                            </Btn>
                            <Btn
                              disabled={busy || Boolean(orch.gate_two_confirmed)}
                              onClick={() => setSendBackFor(sendBackFor === p.id ? null : p.id)}
                            >
                              Send back with notes
                            </Btn>
                          </>
                        )}
                      </div>

                      {sendBackFor === p.id && (
                        <div style={{ marginTop: 10 }}>
                          <textarea
                            value={sendBackNotes}
                            onChange={(e) => setSendBackNotes(e.target.value)}
                            rows={2}
                            placeholder="On-brief / on-strategy notes for this prompt. Craft pass re-runs on it, then a full CD re-check."
                            style={{
                              width: "100%",
                              background: "#0A0908",
                              color: "#EDE8E0",
                              border: `1px solid ${AMBER}55`,
                              borderRadius: 6,
                              padding: 8,
                              fontFamily: "inherit",
                              fontSize: 13,
                            }}
                          />
                          <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                            <Btn
                              active
                              disabled={busy || !sendBackNotes.trim()}
                              onClick={async () => {
                                if (!orchId) return;
                                setBusy(true);
                                setErr(null);
                                try {
                                  await sendBack({
                                    data: { promptId: p.id, notes: sendBackNotes.trim() },
                                  });
                                  setSendBackFor(null);
                                  setSendBackNotes("");
                                } catch (e) {
                                  setErr(e instanceof Error ? e.message : "Send back failed");
                                  setBusy(false);
                                  return;
                                }
                                setBusy(false);
                                await drive(orchId);
                              }}
                            >
                              Send back and rework
                            </Btn>
                            <Btn onClick={() => setSendBackFor(null)}>Cancel</Btn>
                          </div>
                        </div>
                      )}


                      {rejectFor === p.id && (
                        <div style={{ marginTop: 10 }}>
                          <textarea
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            rows={2}
                            placeholder="Why is this direction out? Its signatures retire and dependent prompts re-propagate."
                            style={{
                              width: "100%",
                              background: "#0A0908",
                              color: "#EDE8E0",
                              border: `1px solid ${RED}55`,
                              borderRadius: 6,
                              padding: 8,
                              fontFamily: "inherit",
                              fontSize: 13,
                            }}
                          />
                          <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                            <Btn
                              tone={RED}
                              active
                              disabled={busy || !rejectReason.trim()}
                              onClick={async () => {
                                if (!orchId) return;
                                setBusy(true);
                                try {
                                  const r = await reject({
                                    data: { promptId: p.id, reason: rejectReason.trim() },
                                  });
                                  setNote(
                                    `Late rejection: ${r.retiredSignatures} signature(s) retired, ${r.repropagatedPrompts} prompt(s) re-propagating at registry v${r.registryVersion}.`,
                                  );
                                  setRejectFor(null);
                                  setRejectReason("");
                                } finally {
                                  setBusy(false);
                                }
                                await drive(orchId);
                              }}
                            >
                              Confirm rejection
                            </Btn>
                            <Btn onClick={() => setRejectFor(null)}>Cancel</Btn>
                          </div>
                        </div>
                      )}

                      {p.wad_reasoning && (
                        <div className="text-body-sm" style={{ color: tone, marginTop: 10, whiteSpace: "pre-wrap" }}>
                          {p.wad_reasoning}
                        </div>
                      )}
                      {p.wad_notes && (
                        <div className="text-body-sm" style={{ color: MUTED, marginTop: 6, whiteSpace: "pre-wrap" }}>
                          {p.wad_notes}
                        </div>
                      )}
                      {p.cd_note && (
                        <div className="text-body-sm" style={{ color: AMBER, marginTop: 6 }}>
                          CD note: {p.cd_note}
                        </div>
                      )}

                      {refs.length > 0 && (
                        <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
                          {refs.map((c) => (
                            <div
                              key={c.id}
                              style={{
                                border: `1px solid ${
                                  c.status === "accepted" ? GREEN : c.status === "rejected" || c.status === "voided" ? RED : "#1C1A18"
                                }55`,
                                borderRadius: 6,
                                padding: 10,
                              }}
                            >
                              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                                <Label
                                  tone={
                                    c.status === "accepted"
                                      ? GREEN
                                      : c.status === "rejected" || c.status === "voided"
                                        ? RED
                                        : MUTED
                                  }
                                >
                                  {c.status === "suggested" ? "suggestion" : c.status}
                                </Label>
                                {c.status !== "voided" && (
                                  <>
                                    <Btn
                                      tone={GREEN}
                                      disabled={busy}
                                      onClick={async () => {
                                        await decide({ data: { crossRefId: c.id, decision: "accepted" } });
                                        if (orchId) await refreshState(orchId);
                                      }}
                                    >
                                      Accept
                                    </Btn>
                                    <Btn
                                      tone={RED}
                                      disabled={busy}
                                      onClick={async () => {
                                        await decide({ data: { crossRefId: c.id, decision: "rejected" } });
                                        if (orchId) await refreshState(orchId);
                                      }}
                                    >
                                      Reject
                                    </Btn>
                                  </>
                                )}
                              </div>
                              <div className="text-body-sm" style={{ color: "#EDE8E0", marginTop: 6 }}>
                                {c.suggestion}
                              </div>
                              {c.rationale && (
                                <div className="text-body-sm" style={{ color: MUTED, marginTop: 4 }}>
                                  {c.rationale}
                                </div>
                              )}
                              {c.decision_reason && (
                                <div className="text-body-sm" style={{ color: MUTED, marginTop: 4, fontStyle: "italic" }}>
                                  {c.decision_reason}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {isOpen && (
                        <pre
                          className="text-body-sm"
                          style={{
                            marginTop: 12,
                            whiteSpace: "pre-wrap",
                            color: "#EDE8E0",
                            background: "#0A0908",
                            border: "1px solid #1C1A18",
                            borderRadius: 6,
                            padding: 12,
                            fontFamily: "inherit",
                          }}
                        >
                          {p.final_prompt || p.working_prompt || p.initial_prompt || "Not written yet."}
                        </pre>
                      )}
                    </div>
                  );
                })}
              </div>

              {rejectedPrompts.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <div className="text-mono" style={{ color: RED, fontSize: 10, letterSpacing: "0.12em" }}>
                    REJECTED AT THE CD PASS
                  </div>
                  {rejectedPrompts.map((p) => (
                    <div key={p.id} className="text-body-sm" style={{ color: MUTED, marginTop: 6 }}>
                      {p.channel_name} · {p.lens_name} — {p.rejected_reason}
                    </div>
                  ))}
                </div>
              )}

              {orch.cd_output && (
                <div
                  style={{
                    marginTop: 20,
                    border: `1px solid ${orch.cd_status === "flagged" ? RED : AMBER}55`,
                    borderRadius: 8,
                    padding: 14,
                  }}
                >
                  <div className="text-mono" style={{ color: orch.cd_status === "flagged" ? RED : AMBER, fontSize: 10, letterSpacing: "0.12em" }}>
                    CREATIVE DIRECTOR JUDGMENT — {String(orch.cd_status).toUpperCase()}
                    {orch.cd_revision_count ? " (after one automatic revision)" : ""}
                  </div>
                  <div className="text-body-sm" style={{ color: "#EDE8E0", marginTop: 8, whiteSpace: "pre-wrap" }}>
                    {orch.cd_output}
                  </div>
                </div>
              )}

              {/* ---------------- Gate Two ---------------- */}
              {orch.status === "complete" && (
                <div
                  style={{
                    marginTop: 20,
                    border: `1px solid ${orch.gate_two_confirmed ? GREEN : AMBER}55`,
                    borderRadius: 8,
                    padding: 14,
                  }}
                >
                  <div
                    className="text-mono"
                    style={{
                      color: orch.gate_two_confirmed ? GREEN : AMBER,
                      fontSize: 10,
                      letterSpacing: "0.12em",
                    }}
                  >
                    GATE TWO — CD-LEVEL SIGN-OFF
                    {orch.gate_two_confirmed
                      ? ` · CONFIRMED ${new Date(orch.gate_two_confirmed_at).toLocaleString()}`
                      : ` · ${activePrompts.filter((p) => p.gate_two_approved).length}/${activePrompts.length} SIGNED OFF`}
                  </div>
                  <div className="text-body-sm" style={{ color: MUTED, marginTop: 6 }}>
                    Narrow by design: confirm the finished work is still on-brief and on-strategy. Execution
                    choices — music, casting, photography, editing — sit with the creative team and CD, not
                    reopened here.
                  </div>

                  <StimulusMandate
                    orchestrationId={orchId!}
                    promptCount={activePrompts.length}
                    onApplied={async () => {
                      await refresh(orchId!);
                    }}
                  />

                  {!orch.gate_two_confirmed && (
                    <>
                      <textarea
                        value={gateTwoNote}
                        onChange={(e) => setGateTwoNote(e.target.value)}
                        rows={2}
                        placeholder="Sign-off note for the decision record (optional)."
                        style={{
                          width: "100%",
                          marginTop: 10,
                          background: "#0A0908",
                          color: "#EDE8E0",
                          border: "1px solid #1C1A18",
                          borderRadius: 6,
                          padding: 8,
                          fontFamily: "inherit",
                          fontSize: 13,
                        }}
                      />
                      <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <Btn
                          active
                          tone={GREEN}
                          disabled={busy}
                          onClick={async () => {
                            if (!orchId) return;
                            setBusy(true);
                            setErr(null);
                            try {
                              const r = await confirmTwo({
                                data: { orchestrationId: orchId, notes: gateTwoNote.trim() || undefined },
                              });
                              setNote(`Gate Two confirmed — ${r.approved} finished prompt(s) signed off.`);
                              await refreshState(orchId);
                            } catch (e) {
                              setErr(e instanceof Error ? e.message : "Gate Two confirmation failed");
                            } finally {
                              setBusy(false);
                            }
                          }}
                        >
                          Confirm Gate Two
                        </Btn>
                        <Btn disabled={busy} onClick={() => setShowAmend((v) => !v)}>
                          Send whole set back with amendments
                        </Btn>
                      </div>
                    </>
                  )}

                  {showAmend && !orch.gate_two_confirmed && (
                    <div style={{ marginTop: 10 }}>
                      <textarea
                        value={amendNotes}
                        onChange={(e) => setAmendNotes(e.target.value)}
                        rows={2}
                        placeholder="What is wrong with the whole set. Every active prompt is regenerated against these notes."
                        style={{
                          width: "100%",
                          background: "#0A0908",
                          color: "#EDE8E0",
                          border: `1px solid ${RED}55`,
                          borderRadius: 6,
                          padding: 8,
                          fontFamily: "inherit",
                          fontSize: 13,
                        }}
                      />
                      <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                        <Btn
                          tone={RED}
                          active
                          disabled={busy || !amendNotes.trim()}
                          onClick={async () => {
                            if (!orchId) return;
                            setBusy(true);
                            setErr(null);
                            try {
                              const r = await retrySet({
                                data: { orchestrationId: orchId, notes: amendNotes.trim() },
                              });
                              setNote(`Whole set sent back — ${r.resent} prompt(s) regenerating.`);
                              setShowAmend(false);
                              setAmendNotes("");
                            } catch (e) {
                              setErr(e instanceof Error ? e.message : "Retry failed");
                              setBusy(false);
                              return;
                            }
                            setBusy(false);
                            await drive(orchId);
                          }}
                        >
                          Regenerate set
                        </Btn>
                        <Btn onClick={() => setShowAmend(false)}>Cancel</Btn>
                      </div>
                    </div>
                  )}

                  <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <Btn
                      active
                      disabled={busy}
                      onClick={async () => {
                        if (!orchId) return;
                        setBusy(true);
                        setErr(null);
                        try {
                          const data = await fullExport({ data: { orchestrationId: orchId } });
                          const { filename, html } = buildFullFinishedExport(data);
                          download(filename, html);
                        } catch (e) {
                          setErr(e instanceof Error ? e.message : "Export failed");
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      Full finished export
                    </Btn>
                  </div>
                </div>
              )}

            </>
          )}
        </div>
      )}
    </div>
  );
}
