// Phase 2 — Three Truth Canvas
// Full right-panel screen shown immediately after "Begin Brand Detonation".
// Confirms Product, Consumer, and Cultural truths and gathers Brand Intelligence
// before any Phase 2 stage is run.

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { TopNav } from "@/components/TopNav";
import { SMPAnchor } from "@/components/SMPAnchor";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import {
  prepareThreeTruths,
  saveCulturalTruth,
  saveBrandIntelligence,
  extractBrandGuidelinesFromPdf,
} from "@/lib/threeTruth.functions";

const AMBER = "#D4924A";

const searchSchema = z.object({ session: z.string().uuid().optional() });

export const Route = createFileRoute("/detonation_/canvas")({
  validateSearch: searchSchema,
  component: ThreeTruthCanvas,
  head: () => ({
    meta: [
      { title: "Three Truth Canvas — Brand Detonation" },
      {
        name: "description",
        content:
          "Confirm Product, Consumer, and Cultural truths before launching Brand Detonation.",
      },
    ],
  }),
});

type Strength = "strong" | "weak" | "convention";
type Asset = { name: string; strength: Strength };

type SessionRow = {
  id: string;
  brand_name: string | null;
  selected_smp: string | null;
  user_id: string | null;
  checkpoint_a_confirmed: boolean | null;
  checkpoint_b_confirmed: boolean | null;
  checkpoint_c_confirmed: boolean | null;
  truth_product: string | null;
  truth_consumer: string | null;
  truth_cultural: string | null;
  truth_cultural_confidence: string | null;
  truth_cultural_confirmed: boolean | null;
  brand_intel_type: string | null;
  brand_intel_values: string | null;
  brand_intel_tone: string | null;
  brand_intel_assets: unknown;
  brand_intel_confirmed: boolean | null;
};

function ThreeTruthCanvas() {
  const { session: sessionId } = Route.useSearch();
  const navigate = useNavigate();
  const { user } = useAuth();

  const prepareFn = useServerFn(prepareThreeTruths);
  const saveCulturalFn = useServerFn(saveCulturalTruth);
  const saveIntelFn = useServerFn(saveBrandIntelligence);
  const extractPdfFn = useServerFn(extractBrandGuidelinesFromPdf);

  const [session, setSession] = useState<SessionRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cultural truth editing
  const [culturalEditing, setCulturalEditing] = useState(false);
  const [culturalDraft, setCulturalDraft] = useState("");
  const [culturalSaving, setCulturalSaving] = useState(false);

  // Brand intelligence form
  const [intelType, setIntelType] = useState<"existing" | "new" | "">("");
  const [valuesField, setValuesField] = useState("");
  const [toneField, setToneField] = useState("");
  const [assets, setAssets] = useState<Asset[]>([
    { name: "", strength: "weak" },
  ]);
  const [newBrandAck, setNewBrandAck] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [intelSaving, setIntelSaving] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Load session and trigger truth preparation
  useEffect(() => {
    if (!sessionId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    const load = async () => {
      const { data, error: err } = await supabase
        .from("sessions")
        .select(
          "id, brand_name, selected_smp, user_id, checkpoint_a_confirmed, checkpoint_b_confirmed, checkpoint_c_confirmed, truth_product, truth_consumer, truth_cultural, truth_cultural_confidence, truth_cultural_confirmed, brand_intel_type, brand_intel_values, brand_intel_tone, brand_intel_assets, brand_intel_confirmed",
        )
        .eq("id", sessionId)
        .maybeSingle();
      if (cancelled) return;
      if (err) {
        setError(err.message);
        setLoading(false);
        return;
      }
      const row = data as SessionRow | null;
      setSession(row);
      setLoading(false);
      if (row) {
        hydrateIntel(row);
        // If truths are not yet prepared, fire prepare and reload.
        if (!row.truth_product || !row.truth_consumer || !row.truth_cultural) {
          try {
            await prepareFn({ data: { sessionId: row.id } });
            const { data: data2 } = await supabase
              .from("sessions")
              .select(
                "id, brand_name, selected_smp, user_id, checkpoint_a_confirmed, checkpoint_b_confirmed, checkpoint_c_confirmed, truth_product, truth_consumer, truth_cultural, truth_cultural_confidence, truth_cultural_confirmed, brand_intel_type, brand_intel_values, brand_intel_tone, brand_intel_assets, brand_intel_confirmed",
              )
              .eq("id", row.id)
              .maybeSingle();
            if (!cancelled && data2) {
              setSession(data2 as SessionRow);
              hydrateIntel(data2 as SessionRow);
            }
          } catch (e) {
            if (!cancelled)
              setError(e instanceof Error ? e.message : "Failed to prepare truths");
          }
        }
      }
    };
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  function hydrateIntel(row: SessionRow) {
    if (row.brand_intel_type === "existing" || row.brand_intel_type === "new") {
      setIntelType(row.brand_intel_type);
    }
    if (row.brand_intel_values) setValuesField(row.brand_intel_values);
    if (row.brand_intel_tone) setToneField(row.brand_intel_tone);
    if (Array.isArray(row.brand_intel_assets) && row.brand_intel_assets.length > 0) {
      setAssets(
        (row.brand_intel_assets as Array<{ name?: string; strength?: string }>).map(
          (a) => ({
            name: a.name ?? "",
            strength:
              a.strength === "strong" || a.strength === "convention"
                ? (a.strength as Strength)
                : "weak",
          }),
        ),
      );
    }
    if (row.brand_intel_type === "new") setNewBrandAck(true);
  }

  const brand = session?.brand_name ?? "Untitled Brand";
  const smp = session?.selected_smp ?? "";

  const productTruth = session?.truth_product ?? "";
  const consumerTruth = session?.truth_consumer ?? "";
  const culturalTruth = session?.truth_cultural ?? "";
  const culturalConfidence = (session?.truth_cultural_confidence ?? "MEDIUM").toUpperCase();
  const culturalConfirmed = Boolean(session?.truth_cultural_confirmed);

  const confirmedCount = useMemo(() => {
    const p = productTruth ? 1 : 0;
    const c = consumerTruth ? 1 : 0;
    const cu = culturalConfirmed && culturalTruth ? 1 : 0;
    return p + c + cu;
  }, [productTruth, consumerTruth, culturalConfirmed, culturalTruth]);

  const truthsForAnchor: [boolean, boolean, boolean] = [
    Boolean(productTruth),
    Boolean(consumerTruth),
    Boolean(culturalConfirmed && culturalTruth),
  ];

  const isOwner = Boolean(user && session?.user_id && user.id === session.user_id);

  // Cultural truth handlers
  const startEditCultural = () => {
    setCulturalDraft(culturalTruth);
    setCulturalEditing(true);
  };
  const confirmCultural = async () => {
    if (!sessionId) return;
    const text = (culturalDraft || culturalTruth).trim();
    if (!text) return;
    setCulturalSaving(true);
    try {
      await saveCulturalFn({ data: { sessionId, text, confirm: true } });
      setSession((prev) =>
        prev
          ? { ...prev, truth_cultural: text, truth_cultural_confirmed: true }
          : prev,
      );
      setCulturalEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save cultural truth");
    } finally {
      setCulturalSaving(false);
    }
  };

  // Brand intel handlers
  const updateAsset = (i: number, patch: Partial<Asset>) => {
    setAssets((prev) => prev.map((a, idx) => (idx === i ? { ...a, ...patch } : a)));
  };
  const addAsset = () =>
    setAssets((prev) => [...prev, { name: "", strength: "weak" }]);
  const removeAsset = (i: number) =>
    setAssets((prev) => prev.filter((_, idx) => idx !== i));

  const handlePdfUpload = async (file: File) => {
    if (!sessionId) return;
    setPdfBusy(true);
    setError(null);
    try {
      const base64 = await fileToBase64(file);
      const result = await extractPdfFn({
        data: { sessionId, pdfBase64: base64 },
      });
      if (result.values) setValuesField(result.values);
      if (result.tone) setToneField(result.tone);
      if (result.assets && result.assets.length > 0)
        setAssets(result.assets as Asset[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "PDF extraction failed");
    } finally {
      setPdfBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const intelComplete = useMemo(() => {
    if (intelType === "new") return newBrandAck;
    if (intelType === "existing") {
      // Minimum bar: brand values present. Tone + assets optional.
      return valuesField.trim().length > 0;
    }
    return false;
  }, [intelType, newBrandAck, valuesField]);

  const intelQualityNotes = useMemo(() => {
    if (intelType !== "existing") return [];
    const notes: string[] = [];
    if (valuesField.trim().split(/[,;]+/).filter(Boolean).length < 3)
      notes.push("Brand Values feels thin — list at least three.");
    if (toneField.trim().length < 20)
      notes.push("Tone of Voice could be sharper — add 2–3 descriptors.");
    const filled = assets.filter((a) => a.name.trim().length > 0);
    if (filled.length < 2)
      notes.push("Add at least two distinctive assets to give Stage 17 something to work with.");
    if (filled.every((a) => a.strength !== "strong"))
      notes.push("No assets marked as 'Strong and ownable' — flag honestly so we know where to build.");
    return notes;
  }, [intelType, valuesField, toneField, assets]);

  // TODO: reinstate owner check
  // before commercial deployment
  const canBegin = confirmedCount >= 1 && intelComplete;

  // Explain exactly why the button is disabled so a populated-looking form
  // doesn't silently block the user (the previous behaviour: click = no-op).
  const beginBlockers = useMemo(() => {
    const reasons: string[] = [];
    if (confirmedCount < 1) {
      reasons.push(
        "Confirm at least one of the three truths above (Product, Consumer, or Cultural).",
      );
    }
    if (intelType === "") {
      reasons.push(
        "Select Brand Intelligence type — 'Existing brand' or 'New brand'.",
      );
    } else if (intelType === "existing" && valuesField.trim().length === 0) {
      reasons.push("Enter Brand Values (at minimum) to continue.");
    } else if (intelType === "new" && !newBrandAck) {
      reasons.push(
        "Tick the acknowledgement that this brand has no existing guidelines.",
      );
    }
    return reasons;
  }, [confirmedCount, intelType, valuesField, newBrandAck]);

  const handleBeginStage17 = async () => {
    if (!sessionId) {
      setError("No session — reload from Sessions and try again.");
      return;
    }
    if (!canBegin) {
      // Surface blockers as a visible error so a misclick is never a silent no-op.
      setError(beginBlockers.join(" "));
      return;
    }
    setAdvancing(true);
    setError(null);
    try {
      await saveIntelFn({
        data: {
          sessionId,
          type: intelType as "existing" | "new",
          values: valuesField,
          tone: toneField,
          assets: assets.filter((a) => a.name.trim().length > 0),
          confirmed: true,
        },
      });
      // Route forward into the Phase 2 pipeline (stages render under /detonation).
      // Use the TanStack SPA transition; do not hard-reload from this route.
      await navigate({ to: "/detonation", search: { session: sessionId } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save brand intelligence");
    } finally {
      setAdvancing(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <TopNav session={{ brand, currentStage: 16, totalStages: 23, isRunning: false }} />
      <div className="flex items-center border-b border-border bg-background px-5 py-3 sm:px-8">
        <nav
          className="text-body-sm flex items-center gap-1.5 truncate"
          style={{ color: "var(--color-text-tertiary)" }}
        >
          <Link to="/dashboard" className="transition-colors hover:text-text-secondary">
            Sessions
          </Link>
          <span>→</span>
          <span className="text-text-secondary truncate">{brand}</span>
          <span>→</span>
          <span>Three Truth Canvas</span>
        </nav>
      </div>

      <div className="flex flex-1 min-h-0">
        <aside
          className="hidden md:flex w-[280px] shrink-0 flex-col border-r border-border bg-background"
          style={{ position: "sticky", top: 0, alignSelf: "flex-start", maxHeight: "100vh" }}
        >
          <div style={{ flexShrink: 0 }}>
            <SMPAnchor smp={smp} truths={truthsForAnchor} />
          </div>
          <div style={{ flex: 1, overflowY: "auto" }} />
        </aside>

        <main
          className="mx-auto w-full max-w-[1100px] px-5 sm:px-8"
          style={{ paddingTop: 48, paddingBottom: 96 }}
        >
          {!sessionId && <p className="text-body" style={{ color: "#5A5652" }}>No session specified.</p>}
          {sessionId && loading && (
            <p className="text-body" style={{ color: "#5A5652" }}>Loading canvas…</p>
          )}
          {error && (
            <p className="text-body" style={{ color: "#7C3A3A" }}>{error}</p>
          )}

          {sessionId && !loading && session && (
            <>
              <header style={{ textAlign: "center", marginBottom: 48 }}>
                <span
                  style={{
                    color: AMBER,
                    fontFamily: '"DM Mono", ui-monospace, monospace',
                    fontSize: 7,
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                  }}
                >
                  THREE TRUTH CANVAS
                </span>
                <h1
                  style={{
                    color: AMBER,
                    fontSize: 40,
                    lineHeight: 1.2,
                    fontWeight: 700,
                    margin: "20px auto 0",
                    maxWidth: 880,
                  }}
                >
                  {smp || "—"}
                </h1>
              </header>

              {/* Three panels */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: 16,
                  marginBottom: 40,
                }}
              >
                <TruthPanel
                  label="PRODUCT TRUTH"
                  text={productTruth || "—"}
                  confirmed={Boolean(productTruth)}
                />
                <TruthPanel
                  label="CONSUMER TRUTH"
                  text={consumerTruth || "—"}
                  confirmed={Boolean(consumerTruth)}
                />
                <TruthPanel
                  label="CULTURAL TRUTH"
                  text={culturalTruth || "Generating…"}
                  confirmed={culturalConfirmed}
                  proposed={!culturalConfirmed}
                  confidence={culturalConfidence as "HIGH" | "MEDIUM" | "LOW"}
                  editable
                  editing={culturalEditing}
                  draft={culturalDraft}
                  saving={culturalSaving}
                  onStartEdit={startEditCultural}
                  onChangeDraft={setCulturalDraft}
                  onConfirm={confirmCultural}
                  onCancelEdit={() => setCulturalEditing(false)}
                />
              </div>

              {/* Three Truth Status */}
              <ThreeTruthStatus count={confirmedCount} confirmedSet={truthsForAnchor} />

              {/* Brand Intelligence */}
              <section style={{ marginTop: 48 }}>
                <span
                  style={{
                    color: AMBER,
                    fontFamily: '"DM Mono", ui-monospace, monospace',
                    fontSize: 7,
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                  }}
                >
                  BRAND INTELLIGENCE
                </span>

                <div style={{ display: "flex", gap: 16, marginTop: 16, marginBottom: 24 }}>
                  <RadioCard
                    label="EXISTING BRAND"
                    selected={intelType === "existing"}
                    onSelect={() => setIntelType("existing")}
                  />
                  <RadioCard
                    label="NEW BRAND"
                    selected={intelType === "new"}
                    onSelect={() => setIntelType("new")}
                  />
                </div>

                {intelType === "existing" && (
                  <div style={{ display: "grid", gap: 16 }}>
                    <Field
                      label="Brand Values"
                      hint="What are the defined values of this brand?"
                      placeholder="Single words only — Transparency, Integrity, Courage"
                      helper="What does this brand believe? Not what it does."
                      value={valuesField}
                      onChange={setValuesField}
                      multiline
                    />
                    <Field
                      label="Tone of Voice"
                      hint="How does this brand speak? Key descriptors."
                      value={toneField}
                      onChange={setToneField}
                      multiline
                    />
                    <div>
                      <label
                        style={{
                          display: "block",
                          color: "var(--color-text-secondary)",
                          fontSize: 12,
                          fontWeight: 600,
                          marginBottom: 4,
                        }}
                      >
                        Existing Distinctive Assets
                      </label>
                      <p
                        style={{
                          color: "var(--color-text-tertiary)",
                          fontSize: 12,
                          margin: "0 0 12px",
                        }}
                      >
                        Specific visual, verbal, sonic and tonal elements currently associated with this brand.
                      </p>
                      <div style={{ display: "grid", gap: 8 }}>
                        {assets.map((a, i) => (
                          <div
                            key={i}
                            style={{ display: "flex", gap: 8, alignItems: "center" }}
                          >
                            <input
                              type="text"
                              value={a.name}
                              placeholder="Visual, verbal and tonal elements only — logo colour, specific words, tone of voice. Not products or features."
                              onChange={(e) => updateAsset(i, { name: e.target.value })}
                              style={inputStyle}
                            />
                            <select
                              value={a.strength}
                              onChange={(e) =>
                                updateAsset(i, { strength: e.target.value as Strength })
                              }
                              style={{ ...inputStyle, width: 220 }}
                            >
                              <option value="strong">Strong and ownable</option>
                              <option value="weak">Present but weak</option>
                              <option value="convention">Category convention</option>
                            </select>
                            <button
                              type="button"
                              onClick={() => removeAsset(i)}
                              aria-label="Remove asset"
                              style={{
                                background: "transparent",
                                border: "1px solid var(--color-border)",
                                color: "var(--color-text-tertiary)",
                                borderRadius: 6,
                                width: 32,
                                height: 32,
                                cursor: "pointer",
                              }}
                            >
                              ×
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={addAsset}
                          style={{
                            justifySelf: "start",
                            background: "transparent",
                            border: "1px dashed var(--color-border)",
                            color: "var(--color-text-secondary)",
                            padding: "8px 14px",
                            borderRadius: 6,
                            cursor: "pointer",
                            fontSize: 13,
                          }}
                        >
                          + Add asset
                        </button>
                      </div>
                      <p
                        style={{
                          color: "var(--color-text-tertiary)",
                          fontSize: 12,
                          margin: "6px 0 0",
                        }}
                      >
                        What makes it recognisable without its name?
                      </p>
                    </div>

                    <div
                      style={{
                        marginTop: 8,
                        padding: 16,
                        border: "1px dashed var(--color-border)",
                        borderRadius: 8,
                      }}
                    >
                      <p
                        style={{
                          color: "var(--color-text-secondary)",
                          fontSize: 13,
                          margin: "0 0 10px",
                        }}
                      >
                        Have a brand guidelines PDF? Upload it and we'll auto-fill the four fields above.
                      </p>
                      <input
                        ref={fileRef}
                        type="file"
                        accept="application/pdf"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) void handlePdfUpload(f);
                        }}
                        style={{ display: "none" }}
                      />
                      <button
                        type="button"
                        disabled={pdfBusy}
                        onClick={() => fileRef.current?.click()}
                        style={{
                          background: "transparent",
                          border: `1px solid ${AMBER}`,
                          color: AMBER,
                          padding: "8px 16px",
                          borderRadius: 6,
                          cursor: pdfBusy ? "wait" : "pointer",
                          fontSize: 13,
                          fontWeight: 600,
                        }}
                      >
                        {pdfBusy ? "Extracting…" : "Upload Brand Guidelines (PDF)"}
                      </button>
                    </div>

                    {intelQualityNotes.length > 0 && (
                      <div
                        style={{
                          marginTop: 8,
                          padding: 16,
                          background: "var(--color-surface-2)",
                          borderRadius: 8,
                        }}
                      >
                        <p
                          style={{
                            color: AMBER,
                            fontFamily: '"DM Mono", ui-monospace, monospace',
                            fontSize: 7,
                            letterSpacing: "0.18em",
                            textTransform: "uppercase",
                            margin: 0,
                          }}
                        >
                          QUALITY NUDGES
                        </p>
                        <ul
                          style={{
                            color: "var(--color-text-secondary)",
                            fontSize: 13,
                            margin: "10px 0 0",
                            paddingLeft: 18,
                          }}
                        >
                          {intelQualityNotes.map((n, i) => (
                            <li key={i} style={{ marginBottom: 4 }}>{n}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {intelType === "new" && (
                  <label
                    style={{
                      display: "flex",
                      gap: 12,
                      alignItems: "flex-start",
                      padding: 16,
                      border: "1px solid var(--color-border)",
                      borderRadius: 8,
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={newBrandAck}
                      onChange={(e) => setNewBrandAck(e.target.checked)}
                      style={{ marginTop: 3 }}
                    />
                    <span
                      style={{
                        color: "var(--color-text-secondary)",
                        fontSize: 14,
                        lineHeight: 1.5,
                      }}
                    >
                      This brand has no existing guidelines. Brand Detonation will develop
                      the distinctive asset architecture from the SMP and brand world.
                    </span>
                  </label>
                )}
              </section>

              {/* Confirm and begin */}
              <div style={{ marginTop: 48, textAlign: "center" }}>
                <button
                  type="button"
                  disabled={!canBegin || advancing}
                  onClick={handleBeginStage17}
                  style={{
                    display: "inline-flex",
                    height: 56,
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "0 32px",
                    borderRadius: 8,
                    border: "none",
                    backgroundColor: canBegin ? AMBER : "var(--color-surface-3)",
                    color: canBegin ? "var(--color-background)" : "var(--color-text-tertiary)",
                    fontWeight: 600,
                    fontSize: 16,
                    cursor: canBegin ? "pointer" : "not-allowed",
                  }}
                >
                  {advancing ? "Saving…" : "Confirm and Begin Stage 17 →"}
                </button>
                {/* TODO: reinstate owner check */}
                {/* before commercial deployment */}
                {false && !isOwner && (
                  <p
                    className="text-body-sm"
                    style={{ color: "var(--color-text-tertiary)", marginTop: 12 }}
                  >
                    Only the session owner can begin Stage 17.
                  </p>
                )}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

// --- subcomponents -------------------------------------------------------

function TruthPanel({
  label,
  text,
  confirmed,
  proposed,
  confidence,
  editable,
  editing,
  draft,
  saving,
  onStartEdit,
  onChangeDraft,
  onConfirm,
  onCancelEdit,
}: {
  label: string;
  text: string;
  confirmed: boolean;
  proposed?: boolean;
  confidence?: "HIGH" | "MEDIUM" | "LOW";
  editable?: boolean;
  editing?: boolean;
  draft?: string;
  saving?: boolean;
  onStartEdit?: () => void;
  onChangeDraft?: (v: string) => void;
  onConfirm?: () => void;
  onCancelEdit?: () => void;
}) {
  return (
    <div
      style={{
        background: "var(--color-surface-2)",
        border: `1px solid ${confirmed ? AMBER : "var(--color-border)"}`,
        borderRadius: 12,
        padding: 20,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        minHeight: 200,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span
          style={{
            color: AMBER,
            fontFamily: '"DM Mono", ui-monospace, monospace',
            fontSize: 7,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
          }}
        >
          {label}
        </span>
        {confidence && (
          <span
            style={{
              color: AMBER,
              fontFamily: '"DM Mono", ui-monospace, monospace',
              fontSize: 9,
              letterSpacing: "0.12em",
              opacity: 0.8,
            }}
          >
            {confidence}
          </span>
        )}
      </div>

      {editing ? (
        <textarea
          value={draft ?? ""}
          onChange={(e) => onChangeDraft?.(e.target.value)}
          rows={4}
          style={{ ...inputStyle, flex: 1, resize: "vertical", minHeight: 90 }}
        />
      ) : (
        <p
          style={{
            color: "#FFFFFF",
            fontSize: 14,
            lineHeight: 1.55,
            margin: 0,
            flex: 1,
            cursor: editable && !confirmed ? "text" : "default",
          }}
          onClick={() => editable && !confirmed && onStartEdit?.()}
        >
          {text}
        </p>
      )}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span
            aria-label={confirmed ? "Confirmed" : "Proposed"}
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              backgroundColor: confirmed ? AMBER : "transparent",
              border: `1px solid ${AMBER}`,
              display: "inline-block",
            }}
          />
          <span
            style={{
              color: "var(--color-text-tertiary)",
              fontFamily: '"DM Mono", ui-monospace, monospace',
              fontSize: 9,
              letterSpacing: "0.12em",
            }}
          >
            {confirmed ? "CONFIRMED" : proposed ? "PROPOSED" : "—"}
          </span>
        </div>
        {editable && !confirmed && !editing && (
          <button
            type="button"
            onClick={onStartEdit}
            style={pillBtnStyle}
          >
            Edit
          </button>
        )}
        {editable && editing && (
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={onCancelEdit}
              style={{ ...pillBtnStyle, borderColor: "var(--color-border)", color: "var(--color-text-tertiary)" }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={saving}
              style={{
                ...pillBtnStyle,
                background: AMBER,
                color: "var(--color-background)",
                borderColor: AMBER,
                cursor: saving ? "wait" : "pointer",
              }}
            >
              {saving ? "Saving…" : "Confirm"}
            </button>
          </div>
        )}
        {editable && !confirmed && !editing && (
          <button
            type="button"
            onClick={onConfirm}
            disabled={saving || !text || text === "Generating…"}
            style={{
              ...pillBtnStyle,
              background: AMBER,
              color: "var(--color-background)",
              borderColor: AMBER,
              cursor: saving ? "wait" : "pointer",
            }}
          >
            {saving ? "Saving…" : "Confirm"}
          </button>
        )}
      </div>
    </div>
  );
}

function ThreeTruthStatus({
  count,
  confirmedSet,
}: {
  count: number;
  confirmedSet: [boolean, boolean, boolean];
}) {
  let title = "";
  let subtitle = "";
  let titleColor = "var(--color-text-tertiary)";
  if (count === 3) {
    title = "BRAND DNA TERRITORY";
    titleColor = AMBER;
    subtitle =
      "All three truths are aligned — this is where the highest Creative Share of Voice multipliers live.";
  } else if (count === 2) {
    title = "STRONG BRAND TERRITORY";
    titleColor = "#FFFFFF";
    const missingNames: string[] = [];
    if (!confirmedSet[0]) missingNames.push("Product Truth");
    if (!confirmedSet[1]) missingNames.push("Consumer Truth");
    if (!confirmedSet[2]) missingNames.push("Cultural Truth");
    subtitle = `Two truths confirmed — adding the ${missingNames[0]} unlocks deeper cultural traction and longer creative legs.`;
  } else if (count === 1) {
    title = "SINGLE TRUTH TERRITORY";
    titleColor = "var(--color-text-tertiary)";
    subtitle =
      "One truth is a starting point — consider strengthening another before proceeding to compound the work that follows.";
  } else {
    title = "AWAITING TRUTHS";
    subtitle = "Confirm at least one truth to define the territory.";
  }
  return (
    <div
      style={{
        marginTop: 8,
        padding: "20px 24px",
        border: "1px solid var(--color-border)",
        borderRadius: 12,
        background: "var(--color-surface-3)",
        textAlign: "center",
      }}
    >
      <p
        style={{
          color: titleColor,
          fontFamily: '"DM Mono", ui-monospace, monospace',
          fontSize: 11,
          letterSpacing: "0.18em",
          margin: 0,
          fontWeight: 600,
        }}
      >
        {title}
      </p>
      <p
        style={{
          color: "var(--color-text-tertiary)",
          fontSize: 13,
          margin: "8px auto 0",
          maxWidth: 640,
          lineHeight: 1.5,
        }}
      >
        {subtitle}
      </p>
    </div>
  );
}

function RadioCard({
  label,
  selected,
  onSelect,
}: {
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      style={{
        flex: 1,
        padding: "16px 20px",
        background: selected ? "oklch(0.65 0.12 60 / 0.08)" : "transparent",
        border: `1px solid ${selected ? AMBER : "var(--color-border)"}`,
        borderRadius: 10,
        color: selected ? AMBER : "var(--color-text-primary)",
        fontFamily: '"DM Mono", ui-monospace, monospace',
        fontSize: 11,
        letterSpacing: "0.18em",
        cursor: "pointer",
        textAlign: "left",
        fontWeight: 600,
      }}
    >
      <span
        style={{
          display: "inline-block",
          width: 10,
          height: 10,
          borderRadius: "50%",
          background: selected ? AMBER : "transparent",
          border: `1px solid ${AMBER}`,
          marginRight: 10,
        }}
      />
      {label}
    </button>
  );
}

function Field({
  label,
  hint,
  helper,
  placeholder,
  value,
  onChange,
  multiline,
}: {
  label: string;
  hint?: string;
  helper?: string;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
}) {
  return (
    <div>
      <label
        style={{
          display: "block",
          color: "var(--color-text-secondary)",
          fontSize: 12,
          fontWeight: 600,
          marginBottom: 4,
        }}
      >
        {label}
      </label>
      {hint && (
        <p style={{ color: "var(--color-text-tertiary)", fontSize: 12, margin: "0 0 8px" }}>
          {hint}
        </p>
      )}
      {multiline ? (
        <textarea
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          style={{ ...inputStyle, resize: "vertical" }}
        />
      ) : (
        <input
          type="text"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          style={inputStyle}
        />
      )}
      {helper && (
        <p style={{ color: "var(--color-text-tertiary)", fontSize: 12, margin: "6px 0 0" }}>
          {helper}
        </p>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  background: "var(--color-background)",
  border: "1px solid var(--color-border)",
  borderRadius: 6,
  color: "var(--color-text-primary)",
  fontSize: 14,
  fontFamily: '"DM Sans", system-ui, sans-serif',
};

const pillBtnStyle: React.CSSProperties = {
  background: "transparent",
  border: `1px solid ${AMBER}`,
  color: AMBER,
  padding: "6px 14px",
  borderRadius: 999,
  cursor: "pointer",
  fontSize: 12,
  fontWeight: 600,
};

async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
