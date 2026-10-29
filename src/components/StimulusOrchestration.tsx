// CREATIVE STIMULUS ENGINE — PHASE 3 UI. The Orchestration Engine.
// Session-level: runs across every Gate One-confirmed channel at once.

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  startOrchestration,
  driveOrchestration,
  runOrchestrationStep,
  loadOrchestrationState,
  listOrchestrations,
  setCrossRefDecision,
  rejectPromptAtCd,
  getBrandAssetRules,
  saveBrandAssetRules,
  stressTestCopy,
} from "@/lib/stimulus-orchestration.functions";
import {
  setGateTwoApproval,
  sendPromptBackWithNotes,
  retrySetWithAmendment,
  confirmGateTwo,
  getFullFinishedExport,
  adaptPromptIssue,
  approveWithNotedIssue,
} from "@/lib/stimulus-gate-two.functions";
import { hasResolution, type IssueKind } from "@/lib/stimulus/platform-retry-rules";
import { buildFullFinishedExport, download } from "@/lib/stimulus-export";
import { SIGNATURE_CATEGORIES } from "@/lib/stimulus/orchestration-prompts";
import { StimulusMandate } from "@/components/stimulus/StimulusMandate";
import { Spinner, ProgressBar } from "@/components/ui/busy";


const AMBER = "#F2665F";
const MUTED = "#A8A29A";
const RED = "#E5484D";
const GREEN = "#F2665F";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

const PHASES: { id: string; label: string }[] = [
  { id: "initial_prompts", label: "Initial prompts" },
  { id: "extract", label: "1 · Signature Registry" },
  { id: "propagate", label: "2 · Propagation" },
  { id: "wad", label: "3 · Writer / AD" },
  { id: "cd", label: "4 · Creative Director" },
  { id: "repair", label: "Applying mandate / amendment" },
  { id: "fidelity", label: "Fidelity check" },
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

const TH: React.CSSProperties = { padding: "6px 8px", fontWeight: 400 };
const TD: React.CSSProperties = { padding: "10px 8px" };

function amendmentLabel(s: string) {
  return s === "applied"
    ? "Amendment applied"
    : s === "partly"
      ? "Amendment partly applied — retrying"
      : s === "not_applied"
        ? "Amendment not applied — retrying"
        : "Platform could not apply the amendment";
}

function channelIssues(p: Row): IssueKind[] {
  const out: IssueKind[] = [];
  if (p.mandate_compliance === "absent" && !hasResolution(p.issue_resolutions, "mandate")) out.push("mandate");
  if (p.amendment_status === "platform_failed" && !hasResolution(p.issue_resolutions, "amendment")) out.push("amendment");
  if (p.fidelity_status === "below" && !hasResolution(p.issue_resolutions, "fidelity")) out.push("fidelity");
  return out;
}

const STATE_TONE: Record<string, string> = { queued: MUTED, running: AMBER, done: "#7FB77E", failed: RED };

/** Fixed at the top of Step 4 while a job runs; reads saved per-channel state. */
function ChannelProgress({ prompts }: { prompts: Row[] }) {
  const done = prompts.filter((p) => p.run_state === "done" || p.run_state === "failed").length;
  return (
    <div style={{ position: "sticky", top: 0, zIndex: 5, background: "#0A0908", paddingTop: 10, paddingBottom: 10, marginTop: 10, borderBottom: "1px solid #1C1A18" }}>
      <ProgressBar value={done} total={Math.max(1, prompts.length)} label={`${done} of ${prompts.length} channels done`} />
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
        {prompts.map((p) => {
          const st = (p.run_state as string) ?? "queued";
          return (
            <Label key={p.id} tone={STATE_TONE[st] ?? MUTED}>
              {st === "running" ? <Spinner size={9} style={{ marginRight: 6 }} /> : null}
              {`${p.channel_name} · ${st}`}
            </Label>
          );
        })}
      </div>
    </div>
  );
}

function ChannelNotes(props: {
  channel: string;
  label: string;
  tone: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  confirm: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <label style={{ display: "block" }}>
      <span className="text-mono" style={{ color: props.tone, fontSize: 10, letterSpacing: "0.1em" }}>
        {`${props.label} — ${props.channel}`.toUpperCase()}
      </span>
      <textarea
        aria-label={`${props.label} — ${props.channel}`}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        rows={2}
        placeholder={props.placeholder}
        style={{ width: "100%", marginTop: 4, background: "#0A0908", color: "#EDE8E0", border: `1px solid ${props.tone}55`, borderRadius: 6, padding: 8, fontFamily: "inherit", fontSize: 13 }}
      />
      <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
        <Btn active tone={props.tone} disabled={props.busy || !props.value.trim()} onClick={props.onConfirm}>{props.confirm}</Btn>
        <Btn onClick={props.onCancel}>Cancel</Btn>
      </div>
    </label>
  );
}

function IssueDecision(props: {
  channel: string;
  kind: IssueKind;
  reason?: string | null;
  busy: boolean;
  onAdapt?: () => void;
  onApprove: (note: string) => Promise<void>;
}) {
  const [noting, setNoting] = useState(false);
  const [noteText, setNoteText] = useState("");
  const title =
    props.kind === "mandate"
      ? "Mandate absent after 2 platform retries"
      : props.kind === "amendment"
        ? "Platform could not apply the amendment"
        : "Below fidelity after 2 platform retries";
  return (
    <div style={{ border: `1px solid ${RED}55`, borderRadius: 6, padding: 10, marginTop: 6 }}>
      <div className="text-body-sm" style={{ color: RED }}>{title}{props.reason ? ` — ${props.reason}` : ""}</div>
      <div className="text-body-sm" style={{ color: MUTED, marginTop: 4 }}>This is a platform result, not your decision. Choose how to proceed:</div>
      <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
        {props.onAdapt && (
          <Btn active disabled={props.busy} onClick={props.onAdapt}>
            {props.kind === "mandate" ? "Adapt the mandate for this channel type" : "Adapt the amendment for this channel type"}
          </Btn>
        )}
        <Btn disabled={props.busy} onClick={() => setNoting((v) => !v)}>Approve with a noted issue</Btn>
      </div>
      {noting && (
        <div style={{ marginTop: 8 }}>
          <ChannelNotes
            channel={props.channel}
            label="Noted issue"
            tone={AMBER}
            placeholder="Why this is approved as it stands. Recorded with your name and the time."
            value={noteText}
            onChange={setNoteText}
            confirm="Approve with this note"
            busy={props.busy}
            onCancel={() => setNoting(false)}
            onConfirm={() => void props.onApprove(noteText.trim()).then(() => { setNoting(false); setNoteText(""); })}
          />
        </div>
      )}
    </div>
  );
}

export function StimulusOrchestration({
  sessionId,
  brandName,
  defaultOpen = false,
}: {
  sessionId: string;
  brandName: string;
  defaultOpen?: boolean;
}) {
  const start = useServerFn(startOrchestration);
  const drive_ = useServerFn(driveOrchestration);
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
  const adapt = useServerFn(adaptPromptIssue);
  const approveIssue = useServerFn(approveWithNotedIssue);
  const stress = useServerFn(stressTestCopy);

  const [open, setOpen] = useState(defaultOpen);
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

  // VIEW-ONLY ON ARRIVAL. Landing on Step 4 never starts, resumes or restarts
  // generation. It selects the most useful existing run — the latest COMPLETE
  // one if there is one, otherwise the most recent — and displays it read only.
  // A run the server is already driving is watched passively (no drive call).
  // Generation only ever happens from an explicit button: "Run orchestration"
  // or "Resume this run".
  const attached = useRef(false);
  useEffect(() => {
    if (!open || attached.current || orchId || runs.length === 0) return;
    attached.current = true;
    const signedOff = runs.find(
      (r) => r.status === "complete" && (r as { gate_two_confirmed?: boolean }).gate_two_confirmed,
    );
    const complete = signedOff ?? runs.find((r) => r.status === "complete");
    const target = complete ?? runs[0];

    void viewRunRef.current?.(target.id as string);
  }, [open, orchId, runs]);


  const refreshState = useCallback(
    async (id: string) => {
      const s = await load({ data: { orchestrationId: id } });
      setState(s as any);
    },
    [load],
  );

  const act = async (fn: () => Promise<unknown>, failMsg: string) => {
    setBusy(true);
    setErr(null);
    try {
      await fn();
      if (orchId) await refreshState(orchId);
    } catch (e) {
      setErr(e instanceof Error ? e.message : failMsg);
    } finally {
      setBusy(false);
    }
  };

  /**
   * Hand the run to the server and watch the row. The work itself is detached
   * from this browser via ctx.waitUntil() — closing the tab, switching away or
   * losing connection does not pause or kill it. This loop is pure observation.
   */
  /**
   * Observe the row and, whenever the detached Worker driver stops heartbeating
   * (Cloudflare can kill a waitUntil invocation mid-phase), take over by calling
   * the awaited, resumable step RPC from here. Phases already completed are
   * never redone — the step machine resumes from the persisted phase.
   */
  const pump = useCallback(
    async (id: string, startDriver: boolean) => {
      setBusy(true);
      if (startDriver) {
        setErr(null);
        try {
          await drive_({ data: { orchestrationId: id } });
        } catch {
          /* fall through — the client-side pump below can carry the run */
        }
      }
      let guard = 0;
      while (guard < 2000) {
        guard += 1;
        await new Promise((r) => setTimeout(r, 4000));
        let s: { orchestration: Row } | null = null;
        try {
          s = (await load({ data: { orchestrationId: id } })) as any;
        } catch {
          continue; // transient — keep watching
        }
        setState(s as any);
        const o = s!.orchestration;
        setNote(`${o.status} — ${o.phase_note ?? ""}`);
        if (o.status === "complete") break;

        const hb = o.driver_heartbeat_at ? Date.parse(o.driver_heartbeat_at as string) : 0;
        const stale = Date.now() - hb > 90_000;
        const dead = o.driver_status === "failed" || o.driver_status === "idle" || stale;
        if (o.driver_status === "cancelled") break;
        if (!dead) continue;

        // Server driver is gone. Advance one slice ourselves and keep going.
        try {
          const r = (await step({ data: { orchestrationId: id } })) as { done?: boolean };
          setErr(null);
          if (r?.done) {
            try {
              setState((await load({ data: { orchestrationId: id } })) as any);
            } catch {
              /* ignore */
            }
            break;
          }
        } catch (e) {
          setErr(e instanceof Error ? e.message : "Orchestration step failed — retrying");
        }
      }
      setBusy(false);
    },
    [drive_, load, step],
  );

  const drive = useCallback(async (id: string) => pump(id, true), [pump]);

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

  const viewRunRef = useRef<((id: string) => Promise<void>) | null>(null);

  /**
   * Observation of a run the SERVER is already driving. Never starts a new
   * orchestration; if the server driver dies mid-run, the pump resumes the
   * existing run from its persisted phase.
   */
  const watch = useCallback(async (id: string) => pump(id, false), [pump]);

  /**
   * READ ONLY. Opens a stored run for viewing. If — and only if — the server
   * already has a live driver on it, we watch its progress. Nothing here can
   * trigger generation.
   */
  const openRun = async (id: string) => {
    setOrchId(id);
    setErr(null);
    const s = (await load({ data: { orchestrationId: id } })) as any;
    setState(s);
    const o = s?.orchestration;
    if (o) setNote(`${o.status} — ${o.phase_note ?? ""}`);
    const hb = o?.driver_heartbeat_at ? Date.parse(o.driver_heartbeat_at as string) : 0;
    // A run the server claimed but whose Worker was killed shows driver_status
    // 'running' with a stale heartbeat — still resumable, so watch it too.
    const liveDriver = o && o.status !== "complete" && o.driver_status === "running";
    void hb;
    if (liveDriver) void watch(id);
  };

  viewRunRef.current = openRun;


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
            {/* GENERATION IS ALWAYS AN EXPLICIT, SEPARATE CLICK — never navigation. */}
            <Btn
              active
              disabled={busy}
              onClick={() => {
                if (runs.some((r) => r.status === "complete")) {
                  const ok = window.confirm(
                    "Regenerate? This starts a NEW orchestration run and generates fresh output. Your existing completed run is kept and stays viewable.",
                  );
                  if (!ok) return;
                }
                void handleStart();
              }}
            >
              {busy ? (
                <><Spinner /> Running…</>
              ) : runs.some((r) => r.status === "complete") ? (
                "Regenerate — new orchestration run"
              ) : (
                "Run orchestration on approved set"
              )}
            </Btn>
            {runs.map((r) => (
              <Btn key={r.id} active={r.id === orchId} disabled={busy} onClick={() => void openRun(r.id)}>
                {`${r.status === "complete" ? "view" : r.status} · v${r.registry_version} · ${new Date(r.created_at).toLocaleDateString()} · ${String(r.id).slice(0, 6)}`}
              </Btn>
            ))}
            {/* Resume is the ONLY way an existing unfinished run restarts. */}
            {import.meta.env.DEV && sessionId === "cb7ac9d6-f70b-4902-beb6-7bd0ff5da85f" && orchId && orch?.test_faults?.unreadable_output && orch?.test_faults?.concurrent_claim && orch?.status === "complete" && (
              <Btn disabled={busy} onClick={() => void act(async () => { const result = await stress({ data: { orchestrationId: orchId } }); setNote(JSON.stringify(result)); }, "Copy stress test failed")}>Run copy stress tests</Btn>
            )}
            {orchId && !busy && orch && orch.status !== "complete" && (
              <Btn onClick={() => void drive(orchId)}>Resume this run (generates)</Btn>
            )}
          </div>



          {note && (
            <div className="text-mono" style={{ color: MUTED, fontSize: 10, marginTop: 10, letterSpacing: "0.1em" }}>
              {note.toUpperCase()}
            </div>
          )}

          {orch && (
            <>
              {busy && (
                <div style={{ marginTop: 14 }}>
                  <ProgressBar
                    value={Math.max(0, PHASES.findIndex((p) => p.id === orch.status)) + 1}
                    total={PHASES.length}
                    label={`Step ${Math.max(0, PHASES.findIndex((p) => p.id === orch.status)) + 1} of ${PHASES.length} — running`}
                  />
                </div>
              )}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 14 }}>
                {PHASES.map((p, i) => {
                  const current = orch.status === p.id;
                  const idx = PHASES.findIndex((x) => x.id === orch.status);
                  const done = idx > -1 && i < idx;
                  return (
                    <Label key={p.id} tone={current ? AMBER : done ? GREEN : undefined}>
                      {current && busy ? <Spinner size={9} style={{ marginRight: 6 }} /> : done ? "✓ " : null}
                      {p.label}
                    </Label>
                  );
                })}
                <Label tone={MUTED}>{`registry v${orch.registry_version}`}</Label>
              </div>
              {orch.phase_note && (
                <div className="text-body-sm" style={{ color: MUTED, marginTop: 8 }}>
                  {orch.phase_note}
                </div>
              )}

              {/* ---------------- Per-channel progress (from saved rows) ---------------- */}
              {orch.status !== "complete" && (
                <ChannelProgress prompts={activePrompts} />
              )}

              {/* ---------------- Summary table ---------------- */}
              <div style={{ marginTop: 18, overflowX: "auto", opacity: orch.status !== "complete" ? 0.5 : 1 }}>
                <table className="text-body-sm" style={{ width: "100%", borderCollapse: "collapse", color: "#EDE8E0" }}>
                  <thead>
                    <tr className="text-mono" style={{ color: MUTED, fontSize: 10, letterSpacing: "0.1em", textAlign: "left" }}>
                      <th style={TH}>CHANNEL</th>
                      <th style={TH}>STATUS</th>
                      <th style={TH}>FIDELITY</th>
                      <th style={TH}>MANDATE</th>
                      <th style={TH}>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activePrompts.map((p) => {
                      const isOpen = expanded === p.id;
                      const issues = channelIssues(p);
                      return (
                        <Fragment key={p.id}>
                          <tr style={{ borderTop: "1px solid #1C1A18", verticalAlign: "top" }}>
                            <td style={TD}>
                              <div style={{ color: AMBER }}>{p.channel_name}</div>
                              <div style={{ color: MUTED, fontSize: 12 }}>{p.lens_name}</div>
                            </td>
                            <td style={TD}>
                              <div>{p.gate_two_approved ? "Signed off" : `Craft: ${p.wad_status}`}</div>
                              {p.amendment_status && <div style={{ color: p.amendment_status === "applied" ? MUTED : RED, fontSize: 12 }}>{amendmentLabel(p.amendment_status)}</div>}
                              {p.error && <div style={{ color: RED, fontSize: 12 }}>{p.error}</div>}
                            </td>
                            <td style={TD}>
                              {typeof p.fidelity_score === "number" ? `${p.fidelity_score}/10` : "—"}
                              {p.fidelity_status === "below" && <div style={{ color: RED, fontSize: 12 }}>Below fidelity after 2 platform retries</div>}
                            </td>
                            <td style={TD}>
                              {!orch.mandate_text ? "No mandate" : p.mandate_compliance === "absent" ? <span style={{ color: RED }}>Absent after 2 platform retries</span> : p.mandate_compliance ?? "Pending"}
                            </td>
                            <td style={TD}>
                              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                <Btn onClick={() => setExpanded(isOpen ? null : p.id)}>{isOpen ? "Collapse" : "Open"}</Btn>
                                <Btn disabled={busy || Boolean(orch.gate_two_confirmed)} onClick={() => { setSendBackFor(sendBackFor === p.id ? null : p.id); setRejectFor(null); }}>
                                  Regenerate with this reason
                                </Btn>
                                <Btn tone={RED} disabled={busy || Boolean(orch.gate_two_confirmed)} onClick={() => { setRejectFor(rejectFor === p.id ? null : p.id); setSendBackFor(null); }}>
                                  Drop this channel
                                </Btn>
                                {orch.status === "complete" && (
                                  <Btn
                                    tone={GREEN}
                                    active={Boolean(p.gate_two_approved)}
                                    disabled={busy || Boolean(orch.gate_two_confirmed)}
                                    onClick={() => void act(() => approveTwo({ data: { promptId: p.id, approved: !p.gate_two_approved } }), "Gate Two sign-off failed")}
                                  >
                                    {p.gate_two_approved ? "Signed off — undo" : "Sign off (on-brief)"}
                                  </Btn>
                                )}
                              </div>
                            </td>
                          </tr>

                          {issues.length > 0 && orch.status === "complete" && !orch.gate_two_confirmed && (
                            <tr><td colSpan={5} style={{ ...TD, paddingTop: 0 }}>
                              {issues.map((kind) => (
                                <IssueDecision
                                  key={kind}
                                  channel={p.channel_name}
                                  kind={kind}
                                  reason={kind === "mandate" ? p.mandate_carrier : kind === "amendment" ? p.amendment_reason : p.fidelity_reason}
                                  busy={busy}
                                  onAdapt={kind === "fidelity" ? undefined : () => void act(async () => { await adapt({ data: { promptId: p.id, kind } }); if (orchId) await drive(orchId); }, "Adaptation failed")}
                                  onApprove={(note) => act(() => approveIssue({ data: { promptId: p.id, kind, note } }), "Could not record the noted issue")}
                                />
                              ))}
                            </td></tr>
                          )}

                          {sendBackFor === p.id && (
                            <tr><td colSpan={5} style={TD}>
                              <ChannelNotes
                                channel={p.channel_name}
                                label="Reason to regenerate"
                                tone={AMBER}
                                placeholder="What this channel needs. The prompt is regenerated against this reason, then the set is re-checked."
                                value={sendBackNotes}
                                onChange={setSendBackNotes}
                                confirm="Regenerate with this reason"
                                busy={busy}
                                onCancel={() => setSendBackFor(null)}
                                onConfirm={() => void act(async () => {
                                  await sendBack({ data: { promptId: p.id, notes: sendBackNotes.trim() } });
                                  setSendBackFor(null);
                                  setSendBackNotes("");
                                  if (orchId) await drive(orchId);
                                }, "Regenerate failed")}
                              />
                            </td></tr>
                          )}

                          {rejectFor === p.id && (
                            <tr><td colSpan={5} style={TD}>
                              <ChannelNotes
                                channel={p.channel_name}
                                label="Why drop this channel"
                                tone={RED}
                                placeholder="This removes the channel from the set. Its signatures retire and dependent prompts re-propagate. Its history is kept."
                                value={rejectReason}
                                onChange={setRejectReason}
                                confirm="Drop this channel"
                                busy={busy}
                                onCancel={() => setRejectFor(null)}
                                onConfirm={() => void act(async () => {
                                  const r = await reject({ data: { promptId: p.id, reason: rejectReason.trim() } });
                                  setNote(`Channel dropped: ${r.retiredSignatures} signature(s) retired, ${r.repropagatedPrompts} prompt(s) re-propagating at registry v${r.registryVersion}.`);
                                  setRejectFor(null);
                                  setRejectReason("");
                                  if (orchId) await drive(orchId);
                                }, "Drop failed")}
                              />
                            </td></tr>
                          )}

                          {isOpen && (
                            <tr><td colSpan={5} style={TD}>
                              {p.field2_placement && <div style={{ color: MUTED, marginBottom: 6 }}>Field 2 placement: {p.field2_placement}</div>}
                              <pre className="text-body-sm" style={{ whiteSpace: "pre-wrap", color: "#EDE8E0", background: "#0A0908", border: "1px solid #1C1A18", borderRadius: 6, padding: 12, fontFamily: "inherit" }}>
                                {p.final_prompt || p.working_prompt || p.initial_prompt || "Not written yet."}
                              </pre>
                              {(p.wad_reasoning || p.wad_notes || p.cd_note || p.fidelity_reason) && (
                                <details style={{ marginTop: 8 }}>
                                  <summary className="text-mono" style={{ color: MUTED, fontSize: 10, cursor: "pointer" }}>CD AND CRAFT NOTES — {p.channel_name.toUpperCase()}</summary>
                                  {p.wad_reasoning && <div style={{ color: MUTED, marginTop: 6, whiteSpace: "pre-wrap" }}>{p.wad_reasoning}</div>}
                                  {p.wad_notes && <div style={{ color: MUTED, marginTop: 6, whiteSpace: "pre-wrap" }}>{p.wad_notes}</div>}
                                  {p.cd_note && <div style={{ color: AMBER, marginTop: 6 }}>CD note: {p.cd_note}</div>}
                                  {p.fidelity_reason && <div style={{ color: MUTED, marginTop: 6 }}>Fidelity: {p.fidelity_reason}</div>}
                                  {p.mandate_carrier && <div style={{ color: MUTED, marginTop: 6 }}>Mandate: {p.mandate_carrier}</div>}
                                </details>
                              )}
                              {refsFor(p.id).length > 0 && (
                                <details style={{ marginTop: 8 }}>
                                  <summary className="text-mono" style={{ color: MUTED, fontSize: 10, cursor: "pointer" }}>CROSS-REFERENCES — {refsFor(p.id).length}</summary>
                                  {refsFor(p.id).map((c) => (
                                    <div key={c.id} style={{ border: "1px solid #1C1A18", borderRadius: 6, padding: 10, marginTop: 6 }}>
                                      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                                        <Label tone={c.status === "accepted" ? GREEN : c.status === "suggested" ? MUTED : RED}>{c.status === "suggested" ? "suggestion" : c.status}</Label>
                                        {c.status !== "voided" && (
                                          <>
                                            <Btn tone={GREEN} disabled={busy} onClick={async () => { await decide({ data: { crossRefId: c.id, decision: "accepted" } }); if (orchId) await refreshState(orchId); }}>Accept</Btn>
                                            <Btn tone={RED} disabled={busy} onClick={async () => { await decide({ data: { crossRefId: c.id, decision: "rejected" } }); if (orchId) await refreshState(orchId); }}>Reject suggestion</Btn>
                                          </>
                                        )}
                                      </div>
                                      <div style={{ marginTop: 6 }}>{c.suggestion}</div>
                                      {c.rationale && <div style={{ color: MUTED, marginTop: 4 }}>{c.rationale}</div>}
                                      {c.decision_reason && <div style={{ color: MUTED, marginTop: 4, fontStyle: "italic" }}>{c.decision_reason}</div>}
                                    </div>
                                  ))}
                                </details>
                              )}
                            </td></tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* ---------------- Campaign Signature Registry (collapsed) ---------------- */}
              <details style={{ marginTop: 18 }}>
                <summary className="text-mono" style={{ color: AMBER, fontSize: 10, letterSpacing: "0.12em", cursor: "pointer" }}>
                  CAMPAIGN SIGNATURE REGISTRY — {activeSignatures.length} ACTIVE
                  {retiredSignatures.length ? ` · ${retiredSignatures.length} REMOVED` : ""}
                </summary>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10, marginTop: 10 }}>
                  {activeSignatures.map((s) => (
                    <div key={s.id} style={{ border: "1px solid #1C1A18", borderRadius: 6, padding: 10 }}>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
                        <Label tone={AMBER}>{SIGNATURE_CATEGORIES.find((c) => c.id === s.category)?.label ?? s.category}</Label>
                        {s.origin === "instinct_brief" && <Label tone={GREEN}>human instinct</Label>}
                        <Label>{s.source_channel}</Label>
                      </div>
                      <div className="text-body-sm" style={{ color: "#EDE8E0" }}>{s.name}</div>
                      <div className="text-body-sm" style={{ color: MUTED, marginTop: 4 }}>{s.description}</div>
                    </div>
                  ))}
                </div>
                {retiredSignatures.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <div className="text-mono" style={{ color: RED, fontSize: 10, letterSpacing: "0.12em" }}>REMOVED DEVICES</div>
                    {retiredSignatures.map((s) => (
                      <div key={s.id} className="text-body-sm" style={{ color: MUTED, marginTop: 4 }}>
                        {s.name} ({s.source_channel}) — {s.retired_reason}
                      </div>
                    ))}
                  </div>
                )}
              </details>

              {rejectedPrompts.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <div className="text-mono" style={{ color: RED, fontSize: 10, letterSpacing: "0.12em" }}>
                    DROPPED CHANNELS
                  </div>
                  {rejectedPrompts.map((p) => (
                    <div key={p.id} className="text-body-sm" style={{ color: MUTED, marginTop: 6 }}>
                      {p.channel_name} · {p.lens_name} — {p.rejected_reason}
                    </div>
                  ))}
                </div>
              )}

              {orch.cd_output && (
                <details
                  style={{
                    marginTop: 20,
                    border: `1px solid ${orch.cd_status === "flagged" ? RED : AMBER}55`,
                    borderRadius: 8,
                    padding: 14,
                  }}
                >
                  <summary className="text-mono" style={{ color: orch.cd_status === "flagged" ? RED : AMBER, fontSize: 10, letterSpacing: "0.12em", cursor: "pointer" }}>
                    CREATIVE DIRECTOR JUDGMENT — {String(orch.cd_status).toUpperCase()}
                    {orch.cd_revision_count ? " (after one automatic revision)" : ""}
                  </summary>
                  <div className="text-body-sm" style={{ color: "#EDE8E0", marginTop: 8, whiteSpace: "pre-wrap" }}>
                    {orch.cd_output}
                  </div>
                </details>
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
                      await refreshState(orchId!);
                      await drive(orchId!);
                    }}
                  />

                  {!orch.gate_two_confirmed && (
                    <>
                      <textarea
                        value={gateTwoNote}
                        onChange={(e) => setGateTwoNote(e.target.value)}
                        rows={2}
                        aria-label="Gate Two sign-off note — whole set"
                        placeholder="Sign-off note for the whole set, for the decision record (optional)."
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
                        <Btn
                          tone={GREEN}
                          disabled={busy}
                          onClick={async () => {
                            if (!orchId) return;
                            setBusy(true);
                            setErr(null);
                            try {
                              // Sign off every finished prompt still pending, then confirm the set.
                              for (const p of activePrompts.filter((x) => !x.gate_two_approved)) {
                                await approveTwo({ data: { promptId: p.id, approved: true } });
                              }
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
                          Sign off all &amp; confirm Gate Two
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
                        aria-label="Amendment — all channels"
                        placeholder="Amendment for all channels. Binding: every channel is rewritten, checked (applied / partly / not) and retried up to twice."
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
