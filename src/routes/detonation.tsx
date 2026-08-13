import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { z } from "zod";
import { useServerFn } from "@tanstack/react-start";
import { TopNav } from "@/components/TopNav";
import { BrandGrenadeIcon } from "@/components/BrandGrenadeIcon";
import { SMPAnchor } from "@/components/SMPAnchor";
import { DetonationOutputCard } from "@/components/DetonationOutputCard";
import { DetonationBriefSection } from "@/components/DetonationBriefSection";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { PHASE_2_STAGES, PHASE_2_AMBER } from "@/lib/phase2-stages";
import { sanitiseOutput } from "@/lib/sanitise-output";
import { tokens } from "@/styles/tokens";

// ── Server fn imports ─────────────────────────────────────────────────────
import {
  runStage17, loadStage17, retryStage17, selectStage17Territory,
} from "@/lib/stage17.functions";
import {
  runStage17b, loadStage17b, retryStage17b,
} from "@/lib/stage17b.functions";
import {
  runStage18, loadStage18, retryStage18, selectStage18Detonation,
} from "@/lib/stage18.functions";
import { runStage19, loadStage19, retryStage19 } from "@/lib/stage19.functions";
import {
  runStage20, loadStage20, retryStage20,
  regenerateStage20Section, approveStage20,
} from "@/lib/stage20.functions";
import { startStage20b, loadStage20b } from "@/lib/stage20b.functions";
import {
  runStage21,
  loadStage21,
  clearStage21,
  recheckStage21Fidelity,
} from "@/lib/stage21.functions";
import type { FidelityReport as Stage21FidelityReport } from "@/lib/stage21-fidelity-types";
import { runStage22, loadStage22, regenerateStage22 } from "@/lib/stage22.functions";


const AMBER = PHASE_2_AMBER;

const detonationSearchSchema = z.object({
  session: z.string().uuid().optional(),
  // Deep-link target inside the page. "creative" opens Stage 21 and scrolls
  // straight to the Creative Stimulus panel.
  panel: z.enum(["creative"]).optional(),
});

export const Route = createFileRoute("/detonation")({
  validateSearch: detonationSearchSchema,
  component: DetonationRoute,
  head: () => ({
    meta: [
      { title: "Brand Detonation — Brand Grenade" },
      {
        name: "description",
        content:
          "Phase 2 of the Brand Grenade pipeline. Turn your validated brand strategy into a Master Detonation Brief.",
      },
    ],
  }),
});

// P7 cross-session guard: re-key on sessionId so every session change forces
// a fresh mount and prevents stale Phase 2 stage state from the previous
// session leaking into the current view. Keep this below Route so Route is
// initialised before the component reads Route.useSearch().
function DetonationRoute() {
  const { session: sessionId } = Route.useSearch();
  return <DetonationPage key={sessionId ?? "__no_session__"} />;
}

type SessionRow = {
  id: string;
  brand_name: string | null;
  selected_smp: string | null;
  user_id: string | null;
  phase_2_status: string | null;
  phase_2_current_stage: string | null;
  doc_consulting_url: string | null;
  doc_agency_url: string | null;
  doc_workshop_url: string | null;
  checkpoint_a_confirmed: boolean | null;
  checkpoint_b_confirmed: boolean | null;
  checkpoint_c_confirmed: boolean | null;
  stage_16_format: string | null;
  stage_16_consulting_output: string | null;
  stage_16_agency_output: string | null;
  stage_16_workshop_output: string | null;
  stage_16_vision_output: string | null;
  stage_17_output: string | null;
  stage_17_selected_territory: string | null;
  stage_17b_output: string | null;
  stage_18_output: string | null;
  stage_18_selected_detonation: string | null;
  stage_18_detonation_line: string | null;
  stage_19_output: string | null;
  stage_20_output: string | null;
  stage_20_approved: boolean | null;
  stage_20b_output: string | null;
  stage_20b_audience_input: Record<string, string> | null;
  stage_21_outputs: Record<string, string> | null;
  stage_21_fidelity: Stage21FidelityReport | null;
  stage_22_output: string | null;
  stage_22_brand_architecture: string | null;
  stage_22_distinctive_assets: string | null;
};

const SESSION_COLS =
  "id, brand_name, selected_smp, user_id, phase_2_status, phase_2_current_stage, doc_consulting_url, doc_agency_url, doc_workshop_url, checkpoint_a_confirmed, checkpoint_b_confirmed, checkpoint_c_confirmed, stage_16_format, stage_16_consulting_output, stage_16_agency_output, stage_16_workshop_output, stage_16_vision_output, stage_17_output, stage_17_selected_territory, stage_17b_output, stage_18_output, stage_18_selected_detonation, stage_18_detonation_line, stage_19_output, stage_20_output, stage_20_approved, stage_20b_output, stage_20b_audience_input, stage_21_outputs, stage_21_fidelity, stage_22_output, stage_22_brand_architecture, stage_22_distinctive_assets, locked_big_idea, locked_campaign_line, locked_big_idea_lens, locked_big_idea_at";



// ── Tiny shared UI primitives ─────────────────────────────────────────────
function AmberButton({
  children,
  onClick,
  disabled,
  variant = "solid",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "solid" | "ghost";
}) {
  const solid = variant === "solid";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="text-mono"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        backgroundColor: solid ? AMBER : "transparent",
        color: solid ? "#0A0908" : AMBER,
        border: `1px solid ${AMBER}`,
        borderRadius: 6,
        padding: "10px 16px",
        textTransform: "uppercase",
        fontSize: 11,
        letterSpacing: "0.12em",
        cursor: disabled ? "wait" : "pointer",
        opacity: 1,
        fontWeight: 600,
      }}
    >
      {children}
    </button>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="bg-spinner"
      style={{
        width: 12, height: 12, borderRadius: "50%",
        border: "2px solid currentColor", borderTopColor: "transparent",
        display: "inline-block", verticalAlign: "-0.1em",
        flex: "0 0 auto",
      }}
    />
  );
}

function SectionTitle({ kicker, title, subtitle }: { kicker: string; title: string; subtitle?: string }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <span style={{ color: AMBER, fontFamily: "Inter, system-ui, sans-serif", fontSize: "7pt", textTransform: "uppercase", letterSpacing: "0.18em", fontWeight: 500, display: "block" }}>{kicker}</span>
      <h2 className="text-h2 text-text-primary" style={{ margin: "12px 0 8px", fontWeight: 700 }}>{title}</h2>
      {subtitle && <p className="text-body" style={{ color: "var(--color-text-secondary)" }}>{subtitle}</p>}
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div style={{
      backgroundColor: "#C81E1E12", border: "1px solid #C81E1E",
      borderRadius: 8, padding: 16, marginTop: 16,
    }}>
      <p className="text-body" style={{ color: "#E5484D", margin: 0 }}>{message}</p>
    </div>
  );
}

// Global Creative Direction input for multi-card stages (Stage 17, Stage 18).
// Rendered directly above the "Retry This Stage" button. The text entered
// here is merged into every regenerated card's redirect on retry. Persists
// across retries so the user can iterate on the same direction.
function GlobalRetryDirection({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div style={{ marginTop: 24 }}>
      <label
        className="text-mono"
        htmlFor="global-creative-direction"
        style={{
          display: "block",
          color: AMBER,
          textTransform: "uppercase",
          fontSize: 10,
          letterSpacing: "0.16em",
          marginBottom: 8,
          fontWeight: 500,
        }}
      >
        Creative Direction — applied to all cards on retry
      </label>
      <textarea
        id="global-creative-direction"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        rows={3}
        placeholder="Optional. e.g. push harder on cultural tension; ground every candidate in a specific Australian ritual."
        style={{
          width: "100%",
          backgroundColor: "#0A0908",
          color: "#EDE8E0",
          border: "1px solid #1C1A18",
          borderRadius: 8,
          padding: "12px 14px",
          fontFamily: "inherit",
          fontSize: 14,
          lineHeight: 1.5,
          resize: "vertical",
          outline: "none",
        }}
      />
    </div>
  );
}



// Render Phase 2 prose with markdown punctuation stripped. Heading-style
// lines (originally ##/###/**…**/all-caps short titles) are rendered with
// the .detonation-heading class (amber DM Mono uppercase). All other raw
// markdown markers are removed via sanitiseOutput before rendering.
function RichOutput({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="text-body" style={{ color: "#EDE8E0", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
      {lines.map((line, i) => {
        // Drop markdown horizontal rules entirely.
        if (/^\s*-{3,}\s*$/.test(line) || /^\s*\*{3,}\s*$/.test(line)) {
          return null;
        }
        const trimmed = line.trim();
        // Channel heading: long all-caps line (>20 chars, no trailing colon).
        // Used for Stage 19 channel role labels — rendered larger with an
        // amber underline as the primary navigation hierarchy.
        const isChannelHeading =
          /^[A-Z][A-Z0-9 \-&/]{19,}$/.test(trimmed) && !trimmed.endsWith(":");
        // Standard section label: markdown headings, bold-wrapped lines,
        // short all-caps titles, OR all-caps labels ending in a colon.
        const isHeading =
          /^#{1,4}\s+/.test(line) ||
          /^\*\*[^*]+\*\*\s*$/.test(line) ||
          (/^[A-Z][A-Z0-9 \-&/]{4,}$/.test(trimmed) && trimmed.length < 60) ||
          /^[A-Z][A-Z0-9 \-&/]{2,}:$/.test(trimmed);
        if (isChannelHeading) {
          const clean = sanitiseOutput(line).replace(/:$/, "");
          if (!clean) return null;
          return <span key={i} className="phase2-channel-heading">{clean}</span>;
        }
        if (isHeading) {
          const clean = sanitiseOutput(line).replace(/:$/, "");
          if (!clean) return null;
          return (
            <span key={i} className="phase2-label detonation-heading section-label">{clean}</span>
          );
        }
        const clean = sanitiseOutput(line);
        return <div key={i}>{clean || "\u00A0"}</div>;
      })}
    </div>
  );
}

function OptionCheck({ checked, onChange, label }: { checked: boolean; onChange: (checked: boolean) => void; label: string }) {
  return (
    <label style={{ display: "inline-flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ width: 18, height: 18, accentColor: AMBER, cursor: "pointer" }}
        aria-label={`Select ${label}`}
      />
    </label>
  );
}

// ── Card split helper (mirrors splitCards on the server) ──────────────────
// Phase 2 outputs are plain text (no markdown). Card titles are short
// all-caps lines (no trailing colon) that introduce each candidate block.
// Stage 17 names are followed by a blank line then "WHY THIS TERRITORY
// SERVES THE SMP:" — that's the strongest signal. If absent (Stage 18 etc.)
// we fall back to detecting any all-caps title line that isn't a section
// label (i.e. doesn't end in a colon).
type LocalCard = { id: string; name: string; markdown: string };
function splitCardsLocal(text: string): LocalCard[] {
  if (!text?.trim()) return [];
  const t = text.trim();

  const NAME = "[A-Z][A-Z0-9 '\\-&/.,]{3,79}";
  const cleanName = (s: string) =>
    s.replace(/^#+\s*/, "").replace(/^\*+|\*+$/g, "").replace(/[.,;:\s]+$/g, "").trim();

  // AUTHORITATIVE BOUNDARY: count "WHY THIS (DETONATION|TERRITORY)" anchors.
  // Stage 17/18 emit exactly one per candidate. Use this count as ground
  // truth and prefer it over any other structural cue.
  const anchorRe = /WHY THIS (?:TERRITORY|DETONATION)/g;
  const anchorPositions: number[] = [];
  let am: RegExpExecArray | null;
  while ((am = anchorRe.exec(t)) !== null) anchorPositions.push(am.index);
  const anchorCount = anchorPositions.length;

  const byAnchors = (): LocalCard[] => {
    // Walk back from each anchor through ALL preamble lines that belong to
    // the next card: candidate header ("DETONATION CANDIDATE TWO"), a
    // "THE DETONATION LINE: <value>" pair, stray "---" or "##" markdown,
    // short ALL-CAPS title lines, and blanks. Tested against real broken
    // session output where the model inserts THE DETONATION LINE between
    // the candidate header and the WHY THIS DETONATION anchor.
    const cardStartFor = (anchorIdx: number): number => {
      const before = t.slice(0, anchorIdx);
      const lines = before.split("\n");
      const lineStarts: number[] = [];
      let pos = 0;
      for (const ln of lines) {
        lineStarts.push(pos);
        pos += ln.length + 1;
      }
      const isPreambleLine = (raw: string): boolean => {
        const l = raw.trim();
        if (l === "") return true;
        if (/^-{3,}$/.test(l)) return true;
        if (/^#{1,6}(\s|$)/.test(l)) return true;
        if (/^DETONATION\s+(CANDIDATE\s+)?[A-Z0-9]+\s*:?\s*$/i.test(l)) return true;
        if (/^THE\s+DETONATION\s+LINE\s*:\s*$/i.test(l)) return true;
        if (/^[A-Z][A-Z0-9 '\-&/.,]{2,79}$/.test(l) && !l.endsWith(":")) return true;
        return false;
      };
      let boundary = lineStarts[lines.length - 1] ?? 0;
      for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i];
        const trimmed = line.trim();
        const above = i > 0 ? lines[i - 1].trim() : "";
        if (
          trimmed.length > 0 &&
          trimmed.length < 200 &&
          /^THE\s+DETONATION\s+LINE\s*:\s*$/i.test(above)
        ) {
          boundary = lineStarts[i];
          continue;
        }
        if (isPreambleLine(line)) {
          boundary = lineStarts[i];
          continue;
        }
        break;
      }
      return boundary;
    };
    const stripHead = (s: string): string => {
      const ls = s.split("\n");
      while (ls.length > 0) {
        const first = ls[0].trim();
        if (first === "" || /^-{3,}$/.test(first) || /^#{1,6}(\s|$)/.test(first)) ls.shift();
        else break;
      }
      return ls.join("\n").trimStart();
    };
    const stripTail = (s: string): string => {
      const ls = s.split("\n");
      while (ls.length > 0) {
        const last = ls[ls.length - 1].trim();
        if (last === "" || /^-{3,}$/.test(last) || /^#{1,6}(\s|$)/.test(last)) ls.pop();
        else break;
      }
      return ls.join("\n").trimEnd();
    };
    const starts = anchorPositions.map((idx, i) => (i === 0 ? 0 : cardStartFor(idx)));
    return starts.map((start, i) => {
      const end = i + 1 < starts.length ? starts[i + 1] : t.length;
      const seg = stripTail(stripHead(t.slice(start, end).trim()));
      const isDet = /WHY THIS DETONATION/i.test(seg);
      const titleLine = seg.split("\n").map((l) => l.trim()).filter(Boolean)
        .find((l) => /^[A-Z][A-Z0-9 '\-&/.,]{2,79}$/.test(l) && !l.endsWith(":"));
      const fallback = isDet ? `Detonation ${i + 1}` : `Territory ${i + 1}`;
      return {
        id: `card-${i + 1}`,
        name: cleanName(titleLine ?? fallback) || fallback,
        markdown: seg,
      };
    });
  };

  // Strategy 1 — top-level `---` separator lines. Only trust this when the
  // segment count matches the authoritative anchor count; otherwise the
  // model has dropped a divider and we'd collapse candidates.
  const dashSegments = t.split(/\n\s*---+\s*\n/g).map((s) => s.trim()).filter(Boolean);
  if (dashSegments.length >= 2 && (anchorCount === 0 || dashSegments.length === anchorCount)) {
    return dashSegments.map((seg, i) => {
      const lines = seg.split("\n").map((l) => l.trim()).filter(Boolean);
      const titleLine = lines.find(
        (l) => /^[A-Z][A-Z0-9 '\-&/.,]{2,79}$/.test(l) && !l.endsWith(":"),
      );
      const fallback = /WHY THIS DETONATION/i.test(seg)
        ? `Detonation ${i + 1}`
        : /WHY THIS TERRITORY/i.test(seg)
          ? `Territory ${i + 1}`
          : `Option ${i + 1}`;
      return {
        id: `card-${i + 1}`,
        name: cleanName(titleLine ?? fallback) || fallback,
        markdown: seg,
      };
    });
  }

  // Strategy 2 — segment by WHY THIS anchors when count is reliable.
  if (anchorCount >= 2) return byAnchors();

  const collect = (re: RegExp): Array<{ name: string; start: number }> => {
    const hits: Array<{ name: string; start: number }> = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(t)) !== null) {
      const name = cleanName(m[1]);
      const start = m.index + m[0].indexOf(m[1]);
      hits.push({ name, start });
    }
    return hits;
  };

  let matches: Array<{ name: string; start: number }> = [];
  matches = collect(new RegExp(`(?:^|\\n)\\s*(${NAME})\\s*\\n\\s*\\n\\s*WHY THIS TERRITORY`, "gm"));
  if (matches.length === 0) {
    matches = collect(/(?:^|\n)\s*(DETONATION\s+[A-Z]+\s*:\s*[^\n]+?)\s*\n\s*\n\s*WHY THIS DETONATION/g);
  }
  if (matches.length === 0) {
    matches = collect(new RegExp(`(?:^|\\n)\\s*(${NAME})\\s*\\n\\s*\\n\\s*WHY THIS DETONATION`, "gm"));
  }
  if (matches.length === 0) {
    matches = collect(/(?:^|\n)##\s+(.+?)\s*\n/g);
  }
  if (matches.length === 0) {
    matches = collect(new RegExp(`(?:^|\\n\\s*\\n)\\s*(${NAME})(?!:)\\s*\\n`, "g"));
  }

  if (matches.length === 0 && anchorCount >= 1) return byAnchors();
  if (matches.length === 0) {
    return [{ id: "card-1", name: "Territory", markdown: t }];
  }

  return matches.map((mat, i) => {
    const end = i + 1 < matches.length ? matches[i + 1].start : t.length;
    return {
      id: `card-${i + 1}`,
      name: cleanName(mat.name),
      markdown: t.slice(mat.start, end).trim(),
    };
  });
}

type Stage19Block = { id: string; label: string; content: string; selectable: boolean };
const STAGE_19_OPTION_LABELS = new Set([
  "PRIMARY CHANNEL",
  "PRIMARY CHANNELS",
  "AMPLIFICATION CHANNEL",
  "AMPLIFICATION CHANNELS",
  "CONVERSION CHANNEL",
  "CONVERSION CHANNELS",
  "ACTIVATION CHANNEL",
  "ACTIVATION CHANNELS",
  "SUSTAINING CHANNEL",
  "SUSTAINING CHANNELS",
]);
const STAGE_19_LABELS = [
  "EMOTIONAL TO RATIONAL CALIBRATION",
  "CHANNEL HIERARCHY",
  ...Array.from(STAGE_19_OPTION_LABELS),
  "CHANNEL ECOSYSTEM VIEW",
  "CREATIVE CONSISTENCY BRIEF",
  "COMPOUNDING MEDIA STRATEGY",
  "THE COMPOUNDING MEDIA STRATEGY",
  "DISTINCTIVE ASSET ACTIVATION MAP",
];

function parseStage19BlocksLocal(output: string): Stage19Block[] {
  if (!output.trim()) return [];
  const escaped = STAGE_19_LABELS.map((l) => l.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const pattern = new RegExp(`(^|\\n)\\s*(${escaped.join("|")})\\s*:?\\s*(?:\\n|$)`, "gi");
  const hits: Array<{ label: string; start: number; bodyStart: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(output)) !== null) {
    hits.push({ label: m[2].toUpperCase(), start: m.index + (m[1]?.length ?? 0), bodyStart: pattern.lastIndex });
  }
  if (hits.length === 0) return [{ id: "stage19-output", label: "Activation Architecture", content: output.trim(), selectable: true }];
  return hits.flatMap((hit, i) => {
    const end = hits[i + 1]?.start ?? output.length;
    const body = output.slice(hit.bodyStart, end).trim();
    if (STAGE_19_OPTION_LABELS.has(hit.label)) {
      return body.split(/^\s*---\s*$/gm).map((segment, segmentIndex) => {
        const cleanSegment = segment.trim();
        const [firstLine = hit.label, ...rest] = cleanSegment.split("\n");
        const optionName = firstLine.trim() || hit.label;
        return {
          id: `${hit.label}-${segmentIndex + 1}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
          label: optionName,
          content: rest.join("\n").trim(),
          selectable: true,
        };
      }).filter((block) => block.content || block.label !== hit.label);
    }
    return {
      id: hit.label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
      label: hit.label,
      content: body.replace(/^\s*---\s*/gm, "").trim(),
      selectable: STAGE_19_OPTION_LABELS.has(hit.label),
    };
  });
}

// Strip the leading title line from a card's markdown so the body content
// renders without duplicating the title that's shown in the card header.
function stripCardTitle(markdown: string, name: string): string {
  if (!name) return markdown;
  const cleaned = markdown
    .replace(/^#+\s*/, "")
    .replace(/^\*+/, "");
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`^${escaped}\\.?\\s*\\n?`, "i");
  const stripped = cleaned.replace(pattern, "").trim();
  // Also strip a leading markdown heading line if the title was wrapped.
  return stripped.replace(/^##\s+.+\n?/, "").trim();
}

// Generic: strip any of the given leading label lines from content so a
// component-rendered header is not duplicated by the raw text below it.
// Applied at render sites where a header chip/title is shown above raw
// model output that may also emit the same label.
function stripLeadingLabels(content: string, labels: string[]): string {
  if (!content) return content;
  let out = content.replace(/^\uFEFF/, "").trimStart();
  const escaped = labels
    .filter(Boolean)
    .map((l) => l.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (escaped.length === 0) return out;
  const re = new RegExp(
    `^(?:#{1,4}\\s*|\\*+\\s*)?(?:${escaped.join("|")})\\s*:?\\s*\\n+`,
    "i",
  );
  for (let i = 0; i < 3; i++) {
    const next = out.replace(re, "");
    if (next === out) break;
    out = next.trimStart();
  }
  return out;
}

// Brief Quality Score parsing (mirrors server helper)
type LocalScore = {
  emotional_clarity: number | null;
  fame_invitation: number | null;
  distinctive_asset_integration: number | null;
  psychological_leverage: number | null;
  creative_sov_ambition: number | null;
  composite: number | null;
  status: "PASS" | "REVIEW" | null;
};
// Separator between label and value: ASCII colon/hyphen, en-dash, em-dash.
// Stage 20 prompt template renders dimensions as "Label — n/10" (em-dash),
// so the parser must accept all three or every score reads as null.
const SCORE_SEP = "[:\\-\\u2013\\u2014]?";
function pickScore(block: string, label: string): number | null {
  const re = new RegExp(`${label}\\s*${SCORE_SEP}\\s*(\\d{1,2})\\s*/\\s*10`, "i");
  const m = block.match(re);
  return m ? parseInt(m[1], 10) : null;
}
function parseScoreLocal(output: string): { scoreBlock: string; score: LocalScore } {
  const idx = output.search(/BRIEF\s+QUALITY\s+SCORE/i);
  const scoreBlock = idx >= 0 ? output.slice(idx) : "";
  const compositeMatch = scoreBlock.match(
    new RegExp(`COMPOSITE\\s*${SCORE_SEP}\\s*(\\d{1,2})\\s*/\\s*50`, "i"),
  );
  const statusMatch = scoreBlock.match(
    new RegExp(`STATUS\\s*${SCORE_SEP}\\s*(PASS|REVIEW)`, "i"),
  );
  const parts = [
    pickScore(scoreBlock, "Emotional Clarity"),
    pickScore(scoreBlock, "Fame Invitation"),
    // Prompt uses "Distinctive Assets"; older variants use the longer
    // "Distinctive Asset Integration". Accept both.
    pickScore(scoreBlock, "Distinctive Assets?(?:\\s+Integration)?"),
    pickScore(scoreBlock, "Psychological Leverage"),
    pickScore(scoreBlock, "Creative SoV Ambition"),
  ];
  let composite = compositeMatch ? parseInt(compositeMatch[1], 10) : null;
  if (composite == null && parts.every((p) => typeof p === "number")) {
    composite = parts.reduce<number>((a, b) => a + (b as number), 0);
  }
  const status: "PASS" | "REVIEW" | null = statusMatch
    ? (statusMatch[1].toUpperCase() as "PASS" | "REVIEW")
    : composite != null ? (composite >= 40 ? "PASS" : "REVIEW") : null;
  return {
    scoreBlock,
    score: {
      emotional_clarity: parts[0],
      fame_invitation: parts[1],
      distinctive_asset_integration: parts[2],
      psychological_leverage: parts[3],
      creative_sov_ambition: parts[4],
      composite,
      status,
    },
  };
}

// Stage 20 sections — match server STAGE_20_SECTION_DEFS (deduped).
const STAGE_20_SECTIONS = [
  { id: "smp", label: "THE SMP" },
  { id: "detonation", label: "THE DETONATION" },
  { id: "three_truths", label: "THE THREE TRUTHS" },
  { id: "audience", label: "THE AUDIENCE" },
  { id: "response", label: "THE SINGLE MOST IMPORTANT RESPONSE" },
  { id: "cultural_context", label: "THE CULTURAL CONTEXT" },
  { id: "system_principles", label: "THE DETONATION SYSTEM PRINCIPLES" },
  { id: "courage_requirement", label: "THE COURAGE REQUIREMENT" },
  { id: "compounding_mechanism", label: "THE COMPOUNDING MECHANISM" },
  { id: "ambition", label: "THE CREATIVE SHARE OF VOICE TARGET" },
  { id: "never_do", label: "WHAT THE WORK MUST NEVER DO" },
] as const;

function parseStage20Local(output: string): Array<{ id: string; label: string; content: string }> {
  if (!output) return [];
  const idx = output.search(/BRIEF\s+QUALITY\s+SCORE/i);
  const body = idx >= 0 ? output.slice(0, idx) : output;
  const labels = STAGE_20_SECTIONS.map((s) => s.label);
  const pattern = new RegExp(
    `(^|\\n)\\s*(?:#{1,4}\\s*|\\*+\\s*)?(${labels
      .map((l) => l.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("|")})\\b[^\\n]*`,
    "gi",
  );
  const hits: Array<{ id: string; label: string; start: number; bodyStart: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(body)) !== null) {
    const def = STAGE_20_SECTIONS.find((s) => s.label.toUpperCase() === m![2].toUpperCase());
    if (!def) continue;
    hits.push({
      id: def.id,
      label: def.label,
      start: m.index + (m[1]?.length ?? 0),
      bodyStart: m.index + m[0].length,
    });
  }
  const out: Array<{ id: string; label: string; content: string }> = [];
  for (let i = 0; i < hits.length; i++) {
    const cur = hits[i];
    if (out.find((s) => s.id === cur.id)) continue;
    const next = hits.slice(i + 1).find((hit) => hit.id !== cur.id);
    const end = next ? next.start : body.length;
    out.push({
      id: cur.id,
      label: cur.label,
      content: stripLeadingLabels(body.slice(cur.bodyStart, end).trim(), [cur.label]),
    });
  }
  return out;
}

// ── Stage status calculation ──────────────────────────────────────────────
type StageStatus = "pending" | "complete" | "approved";
function stageStatus(num: string, s: SessionRow | null): StageStatus {
  if (!s) return "pending";
  switch (num) {
    case "17": return s.stage_17_output ? "complete" : "pending";
    case "17B": return s.stage_17b_output ? "complete" : "pending";
    case "18": return s.stage_18_output ? "complete" : "pending";
    case "19": return s.stage_19_output ? "complete" : "pending";
    case "20": return s.stage_20_approved ? "approved" : s.stage_20_output ? "complete" : "pending";
    case "20B": return s.stage_20b_output ? "complete" : "pending";

    case "21": return s.stage_21_outputs && Object.keys(s.stage_21_outputs).length > 0 ? "complete" : "pending";
    case "22": return s.stage_22_output ? "complete" : "pending";
  }
  return "pending";
}

// ── Main page ────────────────────────────────────────────────────────────
function DetonationPage() {
  const { session: sessionId, panel } = Route.useSearch();
  const { user, isAuthReady } = useAuth();
  const [session, setSession] = useState<SessionRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // ?panel=creative deep-links straight into Stage 21, where the Creative
  // Stimulus Engine lives.
  const [activeStage, setActiveStage] = useState<string>(
    panel === "creative" ? "21" : "17",
  );

  useEffect(() => {
    if (panel === "creative" && activeStage === "21") return;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [activeStage, panel]);

  // Once Stage 21 has rendered its content, bring the Creative Stimulus panel
  // into view. Stage 21 loads asynchronously, so poll briefly for the anchor.
  useEffect(() => {
    if (panel !== "creative" || activeStage !== "21") return;
    let tries = 0;
    let found = 0;
    const timer = window.setInterval(() => {
      const el = document.getElementById("creative-stimulus");
      if (el) {
        // Keep re-aligning for a couple of seconds: the panel expands and the
        // briefs above it finish loading, both of which shift the offset.
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        if (++found > 8) window.clearInterval(timer);
      } else if (++tries > 40) {
        window.clearInterval(timer);
      }
    }, 250);
    return () => window.clearInterval(timer);
  }, [panel, activeStage, session]);



  const refresh = useCallback(async () => {
    if (!sessionId) return;
    const { data, error: e } = await supabase
      .from("sessions")
      .select(SESSION_COLS)
      .eq("id", sessionId)
      .maybeSingle();
    if (e) setError(e.message);
    else setSession((data as unknown as SessionRow) ?? null);
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      const { data, error: e } = await supabase
        .from("sessions").select(SESSION_COLS).eq("id", sessionId).maybeSingle();
      if (cancelled) return;
      if (e) setError(e.message);
      setSession((data as unknown as SessionRow) ?? null);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [sessionId]);

  // Realtime: Supabase is the source of truth. Any server-side write to this
  // session row (stage saves, retries, selections) propagates here so all
  // child display state re-syncs via the session prop.
  useEffect(() => {
    if (!sessionId) return;
    const channel = supabase
      .channel(`detonation-session:${sessionId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "sessions", filter: `id=eq.${sessionId}` },
        () => { void refresh(); },
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [sessionId, refresh]);

  useEffect(() => {
    if (!isAuthReady || !user || !session) return;
    if (session.user_id !== user.id) return;
    const phase1Complete = Boolean(session.selected_smp && session.selected_smp.length > 0);
    if (!phase1Complete) return;
    if (session.phase_2_status === "not_started" || session.phase_2_status == null) {
      supabase.from("sessions").update({ phase_2_status: "in_progress" }).eq("id", session.id)
        .then(({ error: upErr }) => {
          if (upErr) console.error("Failed to start Phase 2", upErr);
          else setSession((prev) => prev ? { ...prev, phase_2_status: "in_progress" } : prev);
        });
    }
  }, [isAuthReady, user, session]);

  const brand = session?.brand_name ?? "Untitled Brand";
  const isOwner = Boolean(user && session?.user_id && user.id === session.user_id);
  const phase1Complete = Boolean(
    session?.selected_smp && session.selected_smp.length > 0,
  );

  const phase2Index = PHASE_2_STAGES.findIndex((s) => s.number === activeStage);
  const unifiedStage = phase2Index >= 0 ? 16 + phase2Index + 1 : 17;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <TopNav session={{ brand, currentStage: unifiedStage, totalStages: 27, isRunning: false }} />
      <div className="flex items-center border-b border-border bg-background px-5 py-3 sm:px-8">
        <nav className="text-body-sm flex items-center gap-1.5 truncate" style={{ color: "var(--color-text-tertiary)" }}>
          <Link to="/dashboard" className="transition-colors hover:text-text-secondary">Sessions</Link>
          <span>→</span>
          <span className="text-text-secondary truncate">{brand}</span>
          <span>→</span>
          <span>Brand Detonation</span>
        </nav>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* LEFT PANEL */}
        <aside
          className="hidden md:flex w-[280px] shrink-0 flex-col border-r border-border bg-background"
          style={{ position: "sticky", top: 0, alignSelf: "flex-start", maxHeight: "100vh" }}
        >
          <div style={{ flexShrink: 0 }}>
            <SMPAnchor
              smp={session?.selected_smp ?? ""}
              truths={[
                Boolean(session?.checkpoint_a_confirmed),
                Boolean(session?.checkpoint_b_confirmed),
                Boolean(session?.checkpoint_c_confirmed),
              ]}
            />
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "16px 12px" }}>
            <div style={{
              color: AMBER, letterSpacing: "0.18em", fontFamily: "Inter, system-ui, sans-serif",
              fontSize: "7pt", textTransform: "uppercase", padding: "0 8px 12px", fontWeight: 500,
            }}>STAGES</div>
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 2 }}>
              {PHASE_2_STAGES.map((stage) => {
                const status = stageStatus(stage.number, session);
                const isActive = activeStage === stage.number;
                return (
                  <li key={stage.id}>
                    <button
                      type="button"
                      onClick={() => setActiveStage(stage.number)}
                      onMouseEnter={(e) => {
                        if (!isActive) e.currentTarget.style.backgroundColor = tokens.bgSecondary;
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) e.currentTarget.style.backgroundColor = "transparent";
                      }}
                      style={{
                        width: "100%", textAlign: "left", background: "none", cursor: "pointer",
                        display: "flex", alignItems: "center", gap: 10, padding: "8px 10px",
                        borderRadius: 6, border: "none",
                        backgroundColor: isActive ? tokens.bgTertiary : "transparent",
                        borderLeft: `2px solid ${isActive ? tokens.amber : "transparent"}`,
                      }}
                    >
                      <span style={{
                        fontFamily: `'${tokens.fontMono}', monospace`, fontSize: 13,
                        color: tokens.muted, minWidth: 28, letterSpacing: "0.06em",
                      }}>{stage.number}</span>
                      <span style={{
                        fontFamily: `'${tokens.fontBody}', sans-serif`, fontSize: 13,
                        color: tokens.white, flex: 1, fontWeight: 400,
                      }}>{stage.label}</span>
                      <span style={{
                        fontFamily: `'${tokens.fontMono}', monospace`, fontSize: 8,
                        textTransform: "uppercase", letterSpacing: "0.1em",
                        color: status === "approved" ? tokens.amber
                          : status === "complete" ? "#C81E1E" : tokens.muted,
                      }}>
                        {status === "approved" ? "Approved"
                          : status === "complete" ? "Complete" : "Pending"}
                      </span>
                    </button>

                  </li>
                );
              })}
            </ul>
          </div>
        </aside>

        {/* RIGHT PANEL */}
        <main className="flex-1 min-w-0 overflow-y-auto" style={{ padding: "32px clamp(20px, 4vw, 48px) 96px" }}>
          {!sessionId && <p className="text-body" style={{ color: "#8B8680", textAlign: "center" }}>No session specified.</p>}
          {sessionId && loading && <p className="text-body" style={{ color: "#8B8680", textAlign: "center" }}>Loading session…</p>}
          {error && <ErrorBanner message={error} />}
          {sessionId && !loading && session && (
            <>
              <header style={{ textAlign: "center", paddingBottom: 32 }}>
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
                  <BrandGrenadeIcon size={32} />
                </div>
                <span style={{ color: AMBER, fontFamily: "Inter, system-ui, sans-serif", fontSize: "7pt", textTransform: "uppercase", letterSpacing: "0.18em", fontWeight: 500, display: "block" }}>PHASE 2 — BRAND DETONATION</span>
                <h1 className="text-h2 text-text-primary" style={{ margin: "12px 0 0", fontWeight: 700 }}>{brand}</h1>
              </header>

              {!phase1Complete && <ErrorBanner message="Phase 1 must be complete (a selected SMP is required) before Brand Detonation can begin." />}
              {/* TODO: reinstate owner check */}
              {/* before commercial deployment */}

              {phase1Complete && (
                <div style={{ maxWidth: 880, margin: "0 auto" }}>
                  {activeStage === "17" && <Stage17 session={session} onChange={refresh} goNext={() => setActiveStage("17B")} />}
                  {activeStage === "17B" && <Stage17b session={session} onChange={refresh} goNext={() => setActiveStage("18")} />}
                  {activeStage === "18" && <Stage18 session={session} onChange={refresh} goNext={() => setActiveStage("19")} />}
                  {activeStage === "19" && <Stage19 session={session} onChange={refresh} goNext={() => setActiveStage("20")} />}
                  {activeStage === "20" && <Stage20 session={session} onChange={refresh} goNext={() => setActiveStage("20B")} />}
                  {activeStage === "20B" && <Stage20b session={session} onChange={refresh} goNext={() => setActiveStage("21")} />}

                  {activeStage === "21" && <Stage21 session={session} onChange={refresh} goNext={() => setActiveStage("22")} />}
                  {activeStage === "22" && <Stage22 session={session} onChange={refresh} />}
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// STAGE 17 — Detonation Territory
// ═════════════════════════════════════════════════════════════════════════
function Stage17({ session, onChange, goNext }: { session: SessionRow; onChange: () => void | Promise<void>; goNext: () => void }) {
  const run = useServerFn(runStage17);
  const load = useServerFn(loadStage17);
  const retry = useServerFn(retryStage17);
  const select = useServerFn(selectStage17Territory);

  const [output, setOutput] = useState<string | null>(session.stage_17_output);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [redirects, setRedirects] = useState<Record<string, string>>({});
  const [globalRedirect, setGlobalRedirect] = useState<string>("");
  const [autoTriggered, setAutoTriggered] = useState(false);

  // Source of truth: Supabase. Re-sync display whenever the session row updates.
  useEffect(() => { setOutput(session.stage_17_output); }, [session.stage_17_output]);

  useEffect(() => {
    if (output === null && !session.stage_17_output) {
      load({ data: { sessionId: session.id } }).then((r) => r.output && setOutput(r.output)).catch(() => {});
    }
  }, [output, load, session.id, session.stage_17_output]);

  const cards = useMemo(() => splitCardsLocal(output ?? ""), [output]);
  useEffect(() => {
    setChecked((prev) => {
      const next: Record<string, boolean> = {};
      cards.forEach((c) => { next[c.id] = prev[c.id] ?? false; });
      return next;
    });
  }, [cards.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRun = async () => {
    setBusy(true); setErr(null);
    try {
      const r = await run({ data: { sessionId: session.id } });
      setOutput(r.output); onChange();
    } catch (e) { setErr(e instanceof Error ? e.message : "Stage 17 failed"); }
    finally { setBusy(false); }
  };

  // Auto-run Stage 17 on first arrival if SMP exists and no output yet.
  // NOTE: Stage 16 (document assembly) intentionally runs AFTER Phase 2,
  // not before — Stage 17 depends on Stage 15, not Stage 16.
  useEffect(() => {
    if (
      session.selected_smp &&
      !session.stage_17_output &&
      !output &&
      !busy &&
      !autoTriggered
    ) {
      setAutoTriggered(true);
      void handleRun();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.selected_smp, session.stage_17_output, output]);


  const handleRetry = async () => {
    setBusy(true); setErr(null);
    try {
      const toRegen = cards.filter((c) => !checked[c.id]).map((c) => c.id);
      const g = globalRedirect.trim();
      const mergedRedirects: Record<string, string> = {};
      toRegen.forEach((id) => {
        const perCard = (redirects[id] ?? "").trim();
        const combined = [g, perCard].filter(Boolean).join("\n\n");
        if (combined) mergedRedirects[id] = combined;
      });
      const r = await retry({ data: { sessionId: session.id, cardIds: toRegen, redirectInstructions: mergedRedirects } });
      setOutput(r.output); setRedirects({}); onChange();
      // Persist globalRedirect intentionally — user may iterate on the same direction.
    } catch (e) { setErr(e instanceof Error ? e.message : "Retry failed"); }
    finally { setBusy(false); }
  };

  const handleSelect = async (markdown: string) => {
    setBusy(true); setErr(null);
    try {
      await select({ data: { sessionId: session.id, territoryMarkdown: markdown } });
      await onChange();
      goNext();
    } catch (e) { setErr(e instanceof Error ? e.message : "Selection failed"); }
    finally { setBusy(false); }
  };


  return (
    <section>
      <SectionTitle kicker="STAGE 17" title="Detonation Territory" subtitle="Three candidate territories to explore. Uncheck any to regenerate; add a redirect to steer the rewrite." />
      {err && <ErrorBanner message={err} />}

      {!output ? (
        <AmberButton onClick={handleRun} disabled={busy}>
          {busy && <Spinner />} {busy ? "Generating…" : "Run Stage 17"}
        </AmberButton>
      ) : (
        <>
          {cards.map((c) => (
            <DetonationOutputCard
              key={c.id}
              cardId={c.id}
              title={c.name}
              content={<RichOutput text={stripCardTitle(c.markdown, c.name)} />}
              isChecked={checked[c.id] ?? false}
              onCheckChange={(id, v) => setChecked((p) => ({ ...p, [id]: v }))}
              redirectText={redirects[c.id] ?? ""}
              onRedirectChange={(id, v) => setRedirects((p) => ({ ...p, [id]: v }))}
              smp={session.selected_smp}
              showCheckbox={true}
            >
              <AmberButton onClick={() => handleSelect(c.markdown)} disabled={busy}>
                {busy && <Spinner />} {busy ? "Loading..." : "Select This Territory"}
              </AmberButton>
            </DetonationOutputCard>
          ))}
          <GlobalRetryDirection value={globalRedirect} onChange={setGlobalRedirect} disabled={busy} />
          <div style={{ marginTop: 12, display: "flex", gap: 12, justifyContent: "flex-end" }}>
            <AmberButton variant="ghost" onClick={handleRetry} disabled={busy}>
              {busy && <Spinner />} Retry This Stage
            </AmberButton>
          </div>
        </>
      )}
    </section>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// STAGE 17B — Detonation Intelligence
// ═════════════════════════════════════════════════════════════════════════
function Stage17b({ session, onChange, goNext }: { session: SessionRow; onChange: () => void | Promise<void>; goNext: () => void }) {
  const run = useServerFn(runStage17b);
  const load = useServerFn(loadStage17b);
  const retry = useServerFn(retryStage17b);
  const [output, setOutput] = useState<string | null>(session.stage_17b_output);
  const [busy, setBusy] = useState(false);
  const [proceeding, setProceeding] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const autoTriggeredRef = useRef(false);

  useEffect(() => { setOutput(session.stage_17b_output); }, [session.stage_17b_output]);

  useEffect(() => {
    if (output === null && !session.stage_17b_output) load({ data: { sessionId: session.id } }).then((r) => r.output && setOutput(r.output)).catch(() => {});
  }, [output, load, session.id, session.stage_17b_output]);

  const handleRun = async () => {
    setBusy(true); setErr(null);
    try {
      const r = await run({ data: { sessionId: session.id } });
      setOutput(r.output); await onChange();
    } catch (e) { setErr(e instanceof Error ? e.message : "Stage 17B failed"); }
    finally { setBusy(false); }
  };
  const handleRetry = async () => {
    setBusy(true); setErr(null);
    try {
      const r = await retry({ data: { sessionId: session.id, cardIds: [], redirectInstructions: {} } });
      setOutput(r.output); await onChange();
    } catch (e) { setErr(e instanceof Error ? e.message : "Retry failed"); }
    finally { setBusy(false); }
  };

  // Auto-run once on mount when the prerequisite is in place and we have no output yet.
  useEffect(() => {
    if (autoTriggeredRef.current) return;
    if (!session.stage_17_selected_territory) return;
    if (session.stage_17b_output) return;
    if (output !== null && output !== "") return;
    if (busy) return;
    autoTriggeredRef.current = true;
    void handleRun();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.stage_17_selected_territory, session.stage_17b_output, output]);

  const handleProceed = async () => {
    setProceeding(true);
    try { await onChange(); goNext(); }
    catch (e) { console.error("Stage advance error:", e); }
    finally { setProceeding(false); }
  };

  return (
    <section>
      <SectionTitle kicker="STAGE 17B" title="Detonation Intelligence"
        subtitle="Benchmark + differentiation guidance for the selected territory." />
      {err && <ErrorBanner message={err} />}
      {!output ? (
        <AmberButton onClick={handleRun} disabled={busy}>
          {busy && <Spinner />} {busy ? "Generating…" : "Run Stage 17B"}
        </AmberButton>
      ) : (
        <div style={{
          backgroundColor: "#0A0908", border: "1px solid #1C1A18",
          borderRadius: 8, padding: 28,
        }}>
          <RichOutput text={output} />
          <div style={{ marginTop: 28, display: "flex", gap: 12, justifyContent: "flex-end" }}>
            <AmberButton variant="ghost" onClick={handleRetry} disabled={busy}>{busy && <Spinner />} Retry</AmberButton>
            <AmberButton onClick={handleProceed} disabled={proceeding}>
              {proceeding ? <><Spinner /> Loading...</> : "Proceed to Stage 18"}
            </AmberButton>
          </div>
        </div>
      )}
    </section>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// STAGE 18 — The Detonation
// ═════════════════════════════════════════════════════════════════════════
function Stage18({ session, onChange, goNext }: { session: SessionRow; onChange: () => void | Promise<void>; goNext: () => void }) {
  const run = useServerFn(runStage18);
  const load = useServerFn(loadStage18);
  const retry = useServerFn(retryStage18);
  const select = useServerFn(selectStage18Detonation);

  const [output, setOutput] = useState<string | null>(session.stage_18_output);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [redirects, setRedirects] = useState<Record<string, string>>({});
  const [globalRedirect, setGlobalRedirect] = useState<string>("");
  const [courageDismissed, setCourageDismissed] = useState(false);

  useEffect(() => { setOutput(session.stage_18_output); }, [session.stage_18_output]);

  useEffect(() => {
    if (output === null && !session.stage_18_output) load({ data: { sessionId: session.id } }).then((r) => r.output && setOutput(r.output)).catch(() => {});
  }, [output, load, session.id, session.stage_18_output]);

  const cards = useMemo(() => splitCardsLocal(output ?? ""), [output]);
  useEffect(() => {
    setChecked((prev) => {
      const next: Record<string, boolean> = {};
      cards.forEach((c) => { next[c.id] = prev[c.id] ?? false; });
      return next;
    });
  }, [cards.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const courageAbsent = cards.length === 3 && cards.every((c) =>
    /STRATEGIC\s+DISCOMFORT\s+ABSENT/i.test(c.markdown),
  );

  const handleRun = async () => {
    setBusy(true); setErr(null);
    try {
      const r = await run({ data: { sessionId: session.id } });
      setOutput(r.output); setCourageDismissed(false); onChange();
    } catch (e) { setErr(e instanceof Error ? e.message : "Stage 18 failed"); }
    finally { setBusy(false); }
  };

  const handleRetry = async (courage: boolean) => {
    setBusy(true); setErr(null);
    try {
      const toRegen = courage ? cards.map((c) => c.id) : cards.filter((c) => !checked[c.id]).map((c) => c.id);
      const g = globalRedirect.trim();
      const mergedRedirects: Record<string, string> = {};
      toRegen.forEach((id) => {
        const perCard = (redirects[id] ?? "").trim();
        const combined = [g, perCard].filter(Boolean).join("\n\n");
        if (combined) mergedRedirects[id] = combined;
      });
      const r = await retry({ data: {
        sessionId: session.id, cardIds: toRegen,
        redirectInstructions: mergedRedirects, courageRedirect: courage,
      } });
      setOutput(r.output); setRedirects({});
      // globalRedirect intentionally preserved so the user can iterate.
      if (courage) setCourageDismissed(true);
      else setCourageDismissed(false);
      onChange();
    } catch (e) { setErr(e instanceof Error ? e.message : "Retry failed"); }
    finally { setBusy(false); }
  };


  // Extract the canonical statement to persist. The model writes the label as
  // "DETONATION STATEMENT:" or "THE DETONATION STATEMENT:", optionally bold,
  // and sometimes puts the text on the same line. Falls back to the full card.
  const extractStatement = (markdown: string): string => {
    const m = markdown.match(
      /(?:^|\n)\s*\**\s*(?:THE\s+)?DETONATION\s+STATEMENT\s*\**\s*:?\s*\n*[ \t]*([^\n]+(?:\n(?!\s*\n)[^\n]+)*)/i,
    );
    return m ? m[1].trim() : markdown.trim();
  };

  // Extract the short Detonation Line. Same label tolerance as above. Falls
  // back to the card name ONLY when the label is genuinely absent — never let
  // an internal reference like "Detonation 3" get persisted as the master line
  // when real line text exists in the card.
  const extractLine = (markdown: string, fallbackName: string): string => {
    const m = markdown.match(
      /(?:^|\n)\s*\**\s*(?:THE\s+)?DETONATION\s+LINE\s*\**\s*:?\s*\n*[ \t]*([^\n]+)/i,
    );
    const raw = (m ? m[1] : "").replace(/^\**\s*/, "").replace(/\s*\**$/, "").trim();
    return raw || fallbackName.trim();
  };

  const handleSelect = async (markdown: string, fallbackName: string) => {
    setBusy(true); setErr(null);
    try {
      const statement = extractStatement(markdown);
      const line = extractLine(markdown, fallbackName);
      await select({ data: { sessionId: session.id, detonationMarkdown: statement, detonationLine: line } });
      await onChange();
      goNext();
    } catch (e) { setErr(e instanceof Error ? e.message : "Selection failed"); }
    finally { setBusy(false); }
  };

  const selectedStatement = session.stage_18_selected_detonation ?? null;
  const selectedLine = session.stage_18_detonation_line ?? null;

  const normaliseLine = (s: string) => s.trim().replace(/[.,;:!?\s]+$/g, "").toLowerCase();


  return (
    <section>
      <SectionTitle kicker="STAGE 18" title="The Detonation" subtitle="Three Detonation candidates. Uncheck any to regenerate; add a redirect to steer the rewrite." />
      {err && <ErrorBanner message={err} />}
      {!output ? (
        <AmberButton onClick={handleRun} disabled={busy || !session.stage_17b_output}>
          {busy && <Spinner />} {busy ? "Generating…" : "Run Stage 18"}
        </AmberButton>
      ) : (
        <>
          {courageAbsent && !courageDismissed && (
            <div style={{
              backgroundColor: "#0A0908", borderLeft: `4px solid ${AMBER}`,
              border: "1px solid #1C1A18", borderRadius: 8, padding: 20, marginBottom: 20,
            }}>
              <div style={{
                color: AMBER, textTransform: "uppercase", fontSize: "7pt",
                letterSpacing: "0.18em", marginBottom: 8, fontFamily: "Inter, system-ui, sans-serif", fontWeight: 500,
              }}>COURAGE REVIEW</div>
              <p className="text-body" style={{ color: "#EDE8E0", lineHeight: 1.6, margin: 0 }}>
                None of these ideas generated strategic discomfort. This may indicate the territory is not being pushed hard enough.
              </p>
              <div style={{ marginTop: 16, display: "flex", gap: 12 }}>
                <AmberButton variant="ghost" onClick={() => setCourageDismissed(true)}>Proceed with Selection</AmberButton>
                <AmberButton onClick={() => handleRetry(true)} disabled={busy}>
                  {busy && <Spinner />} Courage Redirect
                </AmberButton>
              </div>
            </div>
          )}
          {selectedLine && (
            <div style={{
              backgroundColor: "#0A0908", borderLeft: `4px solid ${AMBER}`,
              border: "1px solid #1C1A18", borderRadius: 8, padding: 16, marginBottom: 16,
            }}>
              <div style={{ color: AMBER, textTransform: "uppercase", fontSize: "7pt",
                letterSpacing: "0.18em", marginBottom: 6, fontFamily: "Inter, system-ui, sans-serif", fontWeight: 500 }}>
                CURRENTLY SELECTED DETONATION
              </div>
              <div className="text-body" style={{ color: "#EDE8E0", lineHeight: 1.5 }}>
                {selectedLine}
              </div>
              <div className="text-body-sm" style={{ color: "#8B8680", marginTop: 6 }}>
                Click "Select This Detonation" on any card below to change. Downstream stages will regenerate.
              </div>
            </div>
          )}
          {cards.map((c) => {
            const cardLine = extractLine(c.markdown, c.name);
            const cardStatement = extractStatement(c.markdown);
            // Primary match: canonical detonation line (short, stable, persisted).
            // Fallback: extracted statement match (older selections without line).
            const isSelected =
              (selectedLine !== null && normaliseLine(selectedLine) === normaliseLine(cardLine)) ||
              (selectedLine === null && selectedStatement !== null &&
                selectedStatement.trim() === cardStatement.trim());
            return (
              <DetonationOutputCard
                key={c.id}
                cardId={c.id}
                title={c.name}
                content={<RichOutput text={stripCardTitle(c.markdown, c.name)} />}
                isChecked={checked[c.id] ?? false}
                onCheckChange={(id, v) => setChecked((p) => ({ ...p, [id]: v }))}
                redirectText={redirects[c.id] ?? ""}
                onRedirectChange={(id, v) => setRedirects((p) => ({ ...p, [id]: v }))}
                smp={session.selected_smp}
                showCheckbox={true}
                selected={isSelected}
              >
                <AmberButton variant="ghost" onClick={() => handleSelect(c.markdown, c.name)} disabled={busy}>
                  {busy && <Spinner />} {busy ? "Loading..." : (isSelected ? "Selected ✓ — Re-confirm" : "Select This Detonation")}
                </AmberButton>
              </DetonationOutputCard>
            );
          })}
          <GlobalRetryDirection value={globalRedirect} onChange={setGlobalRedirect} disabled={busy} />
          <div style={{ marginTop: 12, display: "flex", gap: 12, justifyContent: "flex-end" }}>
            <AmberButton variant="ghost" onClick={() => handleRetry(false)} disabled={busy}>
              {busy && <Spinner />} Retry This Stage
            </AmberButton>
          </div>
        </>
      )}
    </section>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// STAGE 19 — Activation Architecture
// ═════════════════════════════════════════════════════════════════════════
function Stage19({ session, onChange, goNext }: { session: SessionRow; onChange: () => void | Promise<void>; goNext: () => void }) {
  const run = useServerFn(runStage19);
  const load = useServerFn(loadStage19);
  const retry = useServerFn(retryStage19);
  const [output, setOutput] = useState<string | null>(session.stage_19_output);
  const [busy, setBusy] = useState(false);
  const [proceeding, setProceeding] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const autoTriggeredRef = useRef(false);
  const [stage19Checked, setStage19Checked] = useState<Record<string, boolean>>({});

  useEffect(() => { setOutput(session.stage_19_output); }, [session.stage_19_output]);

  useEffect(() => {
    if (output === null && !session.stage_19_output) load({ data: { sessionId: session.id } }).then((r) => r.output && setOutput(r.output)).catch(() => {});
  }, [output, load, session.id, session.stage_19_output]);

  const handleRun = async () => {
    setBusy(true); setErr(null);
    try { const r = await run({ data: { sessionId: session.id } }); setOutput(r.output); await onChange(); }
    catch (e) { setErr(e instanceof Error ? e.message : "Stage 19 failed"); }
    finally { setBusy(false); }
  };
  const handleRetry = async () => {
    setBusy(true); setErr(null);
    try { const r = await retry({ data: { sessionId: session.id, cardIds: [], redirectInstructions: {} } }); setOutput(r.output); await onChange(); }
    catch (e) { setErr(e instanceof Error ? e.message : "Retry failed"); }
    finally { setBusy(false); }
  };

  useEffect(() => {
    if (autoTriggeredRef.current) return;
    if (!session.stage_18_selected_detonation) return;
    if (session.stage_19_output) return;
    if (output !== null && output !== "") return;
    if (busy) return;
    // P8 double-run guard: persist the autorun flag per-session so a
    // component remount (route revisit, parent re-render, StrictMode double
    // mount, etc.) cannot fire a second auto-run before the first write to
    // stage_19_output lands. The server fn is already idempotent, but this
    // also prevents the cosmetic duplicate "running" event in the UI.
    const key = `bg:stage19-autorun:${session.id}`;
    if (typeof window !== "undefined" && window.sessionStorage.getItem(key)) return;
    if (typeof window !== "undefined") window.sessionStorage.setItem(key, "1");
    autoTriggeredRef.current = true;
    void handleRun();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.stage_18_selected_detonation, session.stage_19_output, output, session.id]);

  const handleProceed = async () => {
    setProceeding(true);
    try { await onChange(); goNext(); }
    catch (e) { console.error("Stage advance error:", e); }
    finally { setProceeding(false); }
  };

  const stage19Blocks = useMemo(() => parseStage19BlocksLocal(output ?? ""), [output]);

  return (
    <section>
      <SectionTitle kicker="STAGE 19" title="Activation Architecture"
        subtitle="Calibration, channel hierarchy, compounding strategy, and distinctive asset activation." />
      {err && <ErrorBanner message={err} />}
      {!output ? (
        <AmberButton onClick={handleRun} disabled={busy}>
          {busy && <Spinner />} {busy ? "Generating…" : "Run Stage 19"}
        </AmberButton>
      ) : (
        <div style={{ backgroundColor: "#0A0908", border: "1px solid #1C1A18", borderRadius: 8, padding: 28 }}>
          {stage19Blocks.map((block, index) => (
            <div
              key={block.id}
              style={{
                borderTop: index === 0 ? "none" : `1px solid ${AMBER}33`,
                paddingTop: index === 0 ? 0 : 20,
                marginTop: index === 0 ? 0 : 20,
              }}
            >
              <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
                {block.selectable && (
                  <OptionCheck
                    checked={Boolean(stage19Checked[block.id])}
                    onChange={(checked) => setStage19Checked((prev) => ({ ...prev, [block.id]: checked }))}
                    label={block.label}
                  />
                )}
                <span className="detonation-heading" style={{ margin: 0 }}>{block.label}</span>
              </div>
              {block.content && <RichOutput text={block.content} />}
            </div>
          ))}
          <div style={{ marginTop: 28, display: "flex", gap: 12, justifyContent: "flex-end" }}>
            <AmberButton variant="ghost" onClick={handleRetry} disabled={busy}>{busy && <Spinner />} Retry</AmberButton>
            <AmberButton onClick={handleProceed} disabled={proceeding}>
              {proceeding ? <><Spinner /> Loading...</> : "Proceed to Stage 20"}
            </AmberButton>
          </div>
        </div>
      )}
    </section>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// STAGE 20 — Master Detonation Brief
// ═════════════════════════════════════════════════════════════════════════
function Stage20({ session, onChange, goNext }: { session: SessionRow; onChange: () => void | Promise<void>; goNext: () => void }) {
  const run = useServerFn(runStage20);
  const load = useServerFn(loadStage20);
  const retry = useServerFn(retryStage20);
  const regenSection = useServerFn(regenerateStage20Section);
  const approve = useServerFn(approveStage20);

  const [output, setOutput] = useState<string | null>(session.stage_20_output);
  const [approved, setApproved] = useState<boolean>(Boolean(session.stage_20_approved));
  const [busy, setBusy] = useState(false);
  const [proceeding, setProceeding] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const autoTriggeredRef = useRef(false);

  useEffect(() => { setOutput(session.stage_20_output); }, [session.stage_20_output]);
  useEffect(() => { setApproved(Boolean(session.stage_20_approved)); }, [session.stage_20_approved]);

  useEffect(() => {
    if (output === null && !session.stage_20_output) load({ data: { sessionId: session.id } }).then((r) => {
      if (r.output) setOutput(r.output); setApproved(r.approved);
    }).catch(() => {});
  }, [output, load, session.id, session.stage_20_output]);

  const sections = useMemo(() => parseStage20Local(output ?? ""), [output]);
  const { score } = useMemo(() => parseScoreLocal(output ?? ""), [output]);

  const handleRun = async () => {
    setBusy(true); setErr(null);
    try { const r = await run({ data: { sessionId: session.id } }); setOutput(r.output); await onChange(); }
    catch (e) { setErr(e instanceof Error ? e.message : "Stage 20 failed"); }
    finally { setBusy(false); }
  };
  const handleRetry = async () => {
    setBusy(true); setErr(null);
    try {
      const r = await retry({ data: { sessionId: session.id, cardIds: [], redirectInstructions: {} } });
      setOutput(r.output); setApproved(false); await onChange();
    } catch (e) { setErr(e instanceof Error ? e.message : "Retry failed"); }
    finally { setBusy(false); }
  };

  const handleSectionRegen = async (sectionId: string, feedback: string): Promise<string> => {
    const r = await regenSection({ data: { sessionId: session.id, sectionId, feedback } });
    setOutput(r.output); setApproved(false); await onChange();
    const updated = parseStage20Local(r.output).find((s) => s.id === sectionId);
    return updated?.content ?? "";
  };

  const handleApprove = async () => {
    setBusy(true); setErr(null);
    try { await approve({ data: { sessionId: session.id } }); setApproved(true); await onChange(); goNext(); }
    catch (e) { setErr(e instanceof Error ? e.message : "Approval failed"); }
    finally { setBusy(false); }
  };

  useEffect(() => {
    if (autoTriggeredRef.current) return;
    if (!session.stage_19_output) return;
    if (session.stage_20_output) return;
    if (output !== null && output !== "") return;
    if (busy) return;
    autoTriggeredRef.current = true;
    void handleRun();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.stage_19_output, session.stage_20_output, output]);

  const handleProceed = async () => {
    setProceeding(true);
    try { await onChange(); goNext(); }
    catch (e) { console.error("Stage advance error:", e); }
    finally { setProceeding(false); }
  };


  const composite = score.composite ?? 0;
  const canApprove = composite >= 40 && !approved;

  return (
    <section>
      <SectionTitle kicker="STAGE 20" title="Master Detonation Brief" subtitle="Click any section to add feedback and regenerate it in place." />
      {err && <ErrorBanner message={err} />}
      {!output ? (
        <AmberButton onClick={handleRun} disabled={busy}>{busy && <Spinner />} {busy ? "Generating…" : "Run Stage 20"}</AmberButton>
      ) : (
        <>
          <div style={{ backgroundColor: "#0A0908", border: "1px solid #1C1A18", borderRadius: 8, padding: 28 }}>
            {sections.length === 0 ? (
              <RichOutput text={output.replace(/BRIEF\s+QUALITY\s+SCORE[\s\S]*$/i, "").trim()} />
            ) : (
              sections.map((s) => (
                <DetonationBriefSection
                  key={s.id}
                  sectionId={s.id}
                  label={s.label}
                  content={<RichOutput text={s.content} />}
                  onRegenerate={handleSectionRegen}
                  onContentUpdate={() => { /* state already updated via handler */ }}
                />
              ))
            )}
          </div>

          {/* Brief Quality Score */}
          <div style={{
            marginTop: 24, backgroundColor: "#0A0908", border: "1px solid #1C1A18",
            borderRadius: 8, padding: 24,
          }}>
            <div style={{
              color: AMBER, textTransform: "uppercase", fontSize: "7pt",
              letterSpacing: "0.18em", marginBottom: 16, fontFamily: "Inter, system-ui, sans-serif", fontWeight: 500,
            }}>BRIEF QUALITY SCORE</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
              {[
                ["Emotional Clarity", score.emotional_clarity],
                ["Fame Invitation", score.fame_invitation],
                ["Distinctive Assets", score.distinctive_asset_integration],
                ["Psychological Leverage", score.psychological_leverage],
                ["Creative SoV Ambition", score.creative_sov_ambition],
              ].map(([label, val]) => (
                <div key={label as string} style={{ borderTop: `1px solid ${AMBER}33`, paddingTop: 10 }}>
                  <div className="text-mono" style={{ color: "#8B8680", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.1em" }}>{label}</div>
                  <div className="text-body" style={{ color: "#EDE8E0", fontSize: 18, marginTop: 4 }}>
                    {typeof val === "number" ? `${val}/10` : "—/10"}
                  </div>
                </div>
              ))}
            </div>
            <div style={{
              marginTop: 20, display: "flex", alignItems: "center", justifyContent: "space-between",
              borderTop: `1px solid ${AMBER}33`, paddingTop: 16,
            }}>
              <div>
                <div className="text-mono" style={{ color: "#8B8680", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.1em" }}>Composite</div>
                <div className="text-body" style={{ color: AMBER, fontSize: 24, fontWeight: 600 }}>{composite}/50</div>
              </div>
              <div className="text-mono" style={{
                color: score.status === "PASS" ? AMBER : "#EDE8E0",
                fontSize: 16, textTransform: "uppercase", letterSpacing: "0.16em", fontWeight: 600,
              }}>
                {score.status ?? "REVIEW"}
              </div>
            </div>
          </div>

          <div style={{ marginTop: 24, display: "flex", gap: 12, justifyContent: "flex-end" }}>
            <AmberButton variant="ghost" onClick={handleRetry} disabled={busy}>{busy && <Spinner />} Retry</AmberButton>
            {approved ? (
              <AmberButton onClick={handleProceed} disabled={proceeding}>
                {proceeding ? <><Spinner /> Loading...</> : "Proceed to Stage 20B"}
              </AmberButton>
            ) : (
              <AmberButton onClick={handleApprove} disabled={!canApprove || busy}>
                {busy && <Spinner />} Approve Brief
              </AmberButton>
            )}
          </div>
        </>
      )}
    </section>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// STAGE 20B — Channel Strategy and Audience Intelligence
// ═════════════════════════════════════════════════════════════════════════
type Stage20bInputs = {
  audienceAsHumans: string;
  dayInTheirLife: string;
  influenceMap: string;
  decisionJourney: string;
  psychologicalProfile: string;
  channelUniverseAndBudget: string;
};
const STAGE_20B_EMPTY: Stage20bInputs = {
  audienceAsHumans: "",
  dayInTheirLife: "",
  influenceMap: "",
  decisionJourney: "",
  psychologicalProfile: "",
  channelUniverseAndBudget: "",
};
const STAGE_20B_FIELDS: Array<{
  key: keyof Stage20bInputs;
  label: string;
  description: string;
  placeholder: string;
}> = [
  {
    key: "audienceAsHumans",
    label: "Who is this audience as humans",
    description: "Not job titles or demographics. The specific person — private fears, public performance, the gap between what they say and what they think.",
    placeholder: "What do they privately fear in this category? What do they need to be seen to know or to have decided? What keeps them awake at three in the morning?",
  },
  {
    key: "dayInTheirLife",
    label: "A day in their life",
    description: "Walk through a typical day. Name the specific moments when their guard is up and when it is down.",
    placeholder: "Wake-up, morning, commute, working day, evening, weekend. When are they most open to a new idea and most closed to being sold to?",
  },
  {
    key: "influenceMap",
    label: "Their influence map",
    description: "Who do they call, watch, quote, attend, trust — and why.",
    placeholder: "Peers, publications, events, voices. Which voices do they trust and why?",
  },
  {
    key: "decisionJourney",
    label: "Their decision journey for this specific category",
    description: "Trigger, research, objections, internal approval process, typical time from first exposure to signed engagement.",
    placeholder: "What triggers the thought that they need this? What research do they do? What objections must they overcome internally before they can act?",
  },
  {
    key: "psychologicalProfile",
    label: "Their psychological profile in this category",
    description: "The two or three most powerful cognitive biases operating in this specific audience at this specific decision moment.",
    placeholder: "e.g. loss aversion (fear of a brand misstep in market), authority bias, social proof from named peer brands.",
  },
  {
    key: "channelUniverseAndBudget",
    label: "Channel universe and budget orientation",
    description: "Named channels this audience actually uses, plus the approximate Long brand-building vs Short sales-activation weighting.",
    placeholder: "Specific publications, events, platforms, formats. Approximate Long / Short split available for this plan.",
  },
];

function Stage20b({ session, onChange, goNext }: { session: SessionRow; onChange: () => void | Promise<void>; goNext: () => void }) {
  const start = useServerFn(startStage20b);
  const load = useServerFn(loadStage20b);

  const initialInputs: Stage20bInputs = {
    ...STAGE_20B_EMPTY,
    ...((session.stage_20b_audience_input as Partial<Stage20bInputs> | null) ?? {}),
  };
  const [inputs, setInputs] = useState<Stage20bInputs>(initialInputs);
  const [output, setOutput] = useState<string | null>(session.stage_20b_output);
  const [editing, setEditing] = useState<boolean>(!session.stage_20b_output);
  const [busy, setBusy] = useState(false);
  const [proceeding, setProceeding] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setOutput(session.stage_20b_output);
    setEditing(!session.stage_20b_output);
  }, [session.stage_20b_output]);

  useEffect(() => {
    if (output === null && !session.stage_20b_output) {
      load({ data: { sessionId: session.id } })
        .then((r) => {
          if (r.output) setOutput(r.output);
          if (r.audienceInput) {
            setInputs({ ...STAGE_20B_EMPTY, ...(r.audienceInput as Partial<Stage20bInputs>) });
          }
        })
        .catch(() => {});
    }
  }, [output, load, session.id, session.stage_20b_output]);

  const allFilled = STAGE_20B_FIELDS.every((f) => inputs[f.key].trim().length > 0);

  const handleRun = async () => {
    if (!allFilled) {
      setErr("All six audience-intelligence inputs are mandatory. Please complete every field before generating the channel strategy.");
      return;
    }
    setBusy(true); setErr(null);
    try {
      // Generation runs detached on the server; this screen polls for it, so a
      // slow model call or a dropped connection can no longer kill the stage.
      await start({ data: { sessionId: session.id, audienceInput: inputs } });

      const deadline = Date.now() + 20 * 60 * 1000;
      for (;;) {
        await new Promise((r) => setTimeout(r, 5000));
        let r: Awaited<ReturnType<typeof load>>;
        try {
          r = await load({ data: { sessionId: session.id } });
        } catch {
          continue; // transient — keep polling
        }
        if (r.output) {
          setOutput(r.output); setEditing(false); await onChange();
          break;
        }
        if (r.error) throw new Error(r.error);
        if (Date.now() > deadline) {
          throw new Error(
            "The channel strategy is still generating after 20 minutes. Leave this page open or come back shortly — the result saves automatically.",
          );
        }
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Stage 20B failed");
    } finally { setBusy(false); }
  };


  const handleProceed = async () => {
    setProceeding(true);
    try { await onChange(); goNext(); }
    catch (e) { console.error("Stage advance error:", e); }
    finally { setProceeding(false); }
  };

  const canRun = session.stage_20_approved === true;

  return (
    <section>
      <SectionTitle
        kicker="STAGE 20B"
        title="Channel Strategy and Audience Intelligence"
        subtitle="Before the channel briefs are written, capture the audience intelligence that drives every channel decision. The output of this stage is the primary brief that Stage 21 writes from."
      />
      {err && <ErrorBanner message={err} />}
      {!canRun && (
        <ErrorBanner message="Stage 20 must be approved before Stage 20B can run." />
      )}

      {editing ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {STAGE_20B_FIELDS.map((f) => (
            <div key={f.key} style={{ backgroundColor: "#0A0908", border: "1px solid #1C1A18", borderRadius: 8, padding: 20 }}>
              <label
                htmlFor={`stage20b-${f.key}`}
                className="text-mono"
                style={{ display: "block", color: AMBER, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 8, fontWeight: 500 }}
              >
                {f.label}
              </label>
              <div className="text-body-sm" style={{ color: "#8B8680", marginBottom: 10, lineHeight: 1.5 }}>
                {f.description}
              </div>
              <textarea
                id={`stage20b-${f.key}`}
                value={inputs[f.key]}
                onChange={(e) => setInputs((p) => ({ ...p, [f.key]: e.target.value }))}
                rows={5}
                placeholder={f.placeholder}
                disabled={busy}
                style={{
                  width: "100%", backgroundColor: "#0A0908", color: "#EDE8E0",
                  border: "1px solid #1C1A18", borderRadius: 6, padding: 12,
                  fontFamily: "inherit", fontSize: 14, lineHeight: 1.5, resize: "vertical",
                }}
              />
            </div>
          ))}
          <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", flexWrap: "wrap" }}>
            {output && (
              <AmberButton variant="ghost" onClick={() => setEditing(false)} disabled={busy}>
                Cancel
              </AmberButton>
            )}
            <AmberButton onClick={handleRun} disabled={busy || !canRun}>
              {busy ? <><Spinner /> Generating Channel Strategy…</> : "Generate Channel Strategy"}
            </AmberButton>
          </div>
        </div>
      ) : output ? (
        <>
          <div style={{ backgroundColor: "#0A0908", border: "1px solid #1C1A18", borderRadius: 8, padding: 28 }}>
            <RichOutput text={output} />
          </div>
          <div style={{ marginTop: 24, display: "flex", gap: 12, justifyContent: "flex-end", flexWrap: "wrap" }}>
            <AmberButton variant="ghost" onClick={() => setEditing(true)} disabled={busy}>
              Edit Inputs and Regenerate
            </AmberButton>
            <AmberButton onClick={handleProceed} disabled={proceeding}>
              {proceeding ? <><Spinner /> Loading...</> : "Proceed to Stage 20B"}
            </AmberButton>
          </div>
        </>
      ) : null}
    </section>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// STAGE 21 — Channel Briefs
// ═════════════════════════════════════════════════════════════════════════
function resolveStage21ChannelName(channel: string, body: string): string {
  const trimmed = channel.trim();
  if (trimmed) return trimmed;
  const u = body.toUpperCase();
  if (/INFLUENCER|CREATOR/.test(u)) return "Influencer and Creator";
  return "Channel Brief";
}

function getStage21OutputEntries(outputs: Record<string, string>) {
  const preferredOrder = [
    "Film and Long-form",
    "Social and Short-form",
    "Influencer and Creator",
    "Digital and Search",
    "Email and CRM",
    "Outdoor and In-store",
  ];
  return Object.entries(outputs)
    .map(([rawChannel, body], index) => ({
      key: `${rawChannel || "channel"}-${index}`,
      channel: resolveStage21ChannelName(rawChannel, body),
      body,
    }))
    .sort((a, b) => {
      const ai = preferredOrder.indexOf(a.channel);
      const bi = preferredOrder.indexOf(b.channel);
      if (ai !== -1 || bi !== -1) return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
      return a.channel.localeCompare(b.channel);
    });
}

// Shows how faithfully each channel brief adapts the decided Lead Creative
// Expression. Judging only — it never rewrites a brief.
function FidelityPanel({
  report,
  onRecheck,
  busy,
}: {
  report: Stage21FidelityReport | null;
  onRecheck: () => void;
  busy: boolean;
}) {
  const colour = (v: string) => (v === "pass" ? AMBER : v === "drift" ? "#C81E1E" : "#C81E1E");
  const breaks = report?.results.filter((r) => r.verdict === "break").length ?? 0;
  const drifts = report?.results.filter((r) => r.verdict === "drift").length ?? 0;

  return (
    <div
      style={{
        marginTop: 24,
        padding: 20,
        border: `1px solid ${breaks > 0 ? "#C81E1E" : `${AMBER}33`}`,
        borderRadius: 8,
        backgroundColor: "#0A0908",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
        <div
          className="text-mono"
          style={{ color: AMBER, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase" }}
        >
          Fidelity to the Lead Creative Expression
        </div>
        <button
          type="button"
          onClick={onRecheck}
          disabled={busy}
          className="text-mono"
          style={{
            background: "none",
            border: `1px solid ${AMBER}40`,
            color: AMBER,
            padding: "6px 12px",
            borderRadius: 6,
            fontSize: 10,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            cursor: busy ? "default" : "pointer",
            opacity: busy ? 0.5 : 1,
          }}
        >
          {busy ? "Checking…" : report ? "Re-check" : "Run check"}
        </button>
      </div>

      {!report ? (
        <div className="text-body-sm" style={{ color: "#8B8680", marginTop: 12 }}>
          These briefs have not been held against the decided idea yet.
        </div>
      ) : (
        <>
          <div className="text-body-sm" style={{ color: breaks > 0 ? "#E5484D" : "#8B8680", marginTop: 10 }}>
            {breaks > 0
              ? `${breaks} brief${breaks === 1 ? "" : "s"} broke away from the decided idea — regenerate ${breaks === 1 ? "it" : "them"} before anything downstream uses ${breaks === 1 ? "it" : "them"}.`
              : drifts > 0
                ? `${drifts} brief${drifts === 1 ? "" : "s"} drifted. Recognisably the same idea, but weakened.`
                : "Every brief is a faithful adaptation of the decided idea."}
          </div>
          <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
            {report.results.map((r) => (
              <div key={r.channel} style={{ borderTop: "1px solid #1C1A18", paddingTop: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <div className="text-body-sm" style={{ color: "#EDE8E0" }}>{r.channel}</div>
                  <div
                    className="text-mono"
                    style={{
                      color: colour(r.verdict),
                      fontSize: 10,
                      letterSpacing: "0.14em",
                      textTransform: "uppercase",
                    }}
                  >
                    {r.verdict} · {r.score}/10
                  </div>
                </div>
                <div className="text-body-sm" style={{ color: "#8B8680", marginTop: 6, lineHeight: 1.6 }}>
                  {r.reasoning}
                </div>
                {r.missing.length > 0 && (
                  <div className="text-body-sm" style={{ color: "#8B8680", marginTop: 6 }}>
                    <span style={{ color: colour(r.verdict) }}>Missing:</span> {r.missing.join(" · ")}
                  </div>
                )}
                {r.misreadingEvidence && (
                  <div className="text-body-sm" style={{ color: "#E5484D", marginTop: 6 }}>
                    Misreading: {r.misreadingEvidence}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Stage21({ session, onChange, goNext }: { session: SessionRow; onChange: () => void | Promise<void>; goNext: () => void }) {
  const run = useServerFn(runStage21);
  const load = useServerFn(loadStage21);
  const clear = useServerFn(clearStage21);
  const recheck = useServerFn(recheckStage21Fidelity);
  const [outputs, setOutputs] = useState<Record<string, string> | null>(session.stage_21_outputs);
  const [fidelity, setFidelity] = useState<Stage21FidelityReport | null>(session.stage_21_fidelity);
  const [fidelityBusy, setFidelityBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [proceeding, setProceeding] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [audienceChannelDirection, setAudienceChannelDirection] = useState("");
  const autoTriggeredRef = useRef(false);

  useEffect(() => { setFidelity(session.stage_21_fidelity); }, [session.stage_21_fidelity]);

  const handleRecheck = async () => {
    setFidelityBusy(true);
    setErr(null);
    try {
      const r = await recheck({ data: { sessionId: session.id } });
      setFidelity(r.fidelity as Stage21FidelityReport);
      await onChange();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Fidelity check failed");
    } finally {
      setFidelityBusy(false);
    }
  };



  useEffect(() => { setOutputs(session.stage_21_outputs); }, [session.stage_21_outputs]);

  useEffect(() => {
    if (outputs === null && !session.stage_21_outputs) load({ data: { sessionId: session.id } }).then((r) => r.outputs && setOutputs(r.outputs)).catch(() => {});
  }, [outputs, load, session.id, session.stage_21_outputs]);

  const handleRun = async () => {
    setBusy(true); setErr(null);
    try {
      const r = await run({ data: { sessionId: session.id } });
      setOutputs(r.outputs);
      setFidelity((r.fidelity as Stage21FidelityReport | null) ?? null);
      await onChange();
    }
    catch (e) {
      console.error("Stage 21 run failed:", e);
      setErr(e instanceof Error ? e.message : "Stage 21 failed");
      autoTriggeredRef.current = false;
    }
    finally { setBusy(false); }
  };


  const handleForceRegenerate = async () => {
    if (busy) return;
    if (!confirm("Force regenerate will clear all saved channel briefs and re-run Stage 21 from scratch using the latest extractor. Continue?")) return;
    setBusy(true); setErr(null);
    try {
      await clear({ data: { sessionId: session.id } });
      setOutputs(null);
      const r = await run({ data: { sessionId: session.id, audienceChannelDirection: audienceChannelDirection.trim() || undefined } });
      setOutputs(r.outputs);
      await onChange();
    } catch (e) {
      console.error("Stage 21 force regenerate failed:", e);
      setErr(e instanceof Error ? e.message : "Stage 21 force regenerate failed");
    } finally { setBusy(false); }
  };


  useEffect(() => {
    if (autoTriggeredRef.current) return;
    if (!session.stage_20_approved) return;
    if (!session.stage_20b_output) return;
    if (session.stage_21_outputs && Object.keys(session.stage_21_outputs).length > 0) return;
    if (outputs !== null && Object.keys(outputs).length > 0) return;
    if (busy) return;
    autoTriggeredRef.current = true;
    void handleRun();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.stage_20_approved, session.stage_20b_output, session.stage_21_outputs, outputs]);


  const handleProceed = async () => {
    setProceeding(true);
    try { await onChange(); goNext(); }
    catch (e) { console.error("Stage advance error:", e); }
    finally { setProceeding(false); }
  };


  const download = (filename: string, content: string) => {
    const blob = new Blob([content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };
  const downloadAll = () => {
    if (!outputs) return;
    const combined = getStage21OutputEntries(outputs)
      .map(({ channel, body }) => `# ${channel}\n\n${body}`).join("\n\n---\n\n");
    download(`${session.brand_name ?? "brand"}-channel-briefs.md`, combined);
  };
  const outputEntries = outputs ? getStage21OutputEntries(outputs) : [];

  const stage21BlockedReason = !session.stage_20_approved
    ? "Stage 20 must be approved before Stage 21 can run."
    : !session.stage_20b_output
      ? "Stage 20B must complete before Stage 21 can run."
      : null;


  return (
    <section>
      <SectionTitle kicker="STAGE 21" title="Channel Briefs" subtitle="One detonation brief per active channel. Click a card to expand." />
      {err && <ErrorBanner message={err} />}
      {stage21BlockedReason && <ErrorBanner message={stage21BlockedReason} />}
      {!outputs || outputEntries.length === 0 ? (
        <AmberButton onClick={handleRun} disabled={busy || !!stage21BlockedReason}>
          {busy && !stage21BlockedReason && <Spinner />} {busy && !stage21BlockedReason ? "Generating channel briefs…" : stage21BlockedReason ? "Blocked — see above" : "Run Stage 21"}
        </AmberButton>
      ) : (

        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
            {outputEntries.map(({ key, channel, body }) => {
              const isOpen = expanded === channel;
              const roleMatch = body.match(/CHANNEL\s+ROLE\s*[:\-]?\s*([^\n]+)/i);
              const role = roleMatch ? roleMatch[1].trim() : "Channel Brief";
              return (
                <div key={key} style={{
                  backgroundColor: "#0A0908", border: "1px solid #1C1A18",
                  borderRadius: 8, padding: 20,
                }}>
                  <button type="button" onClick={() => setExpanded(isOpen ? null : channel)}
                    style={{ width: "100%", textAlign: "left", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                    <div style={{ color: AMBER, textTransform: "uppercase", fontSize: 16, letterSpacing: "0.06em", fontFamily: "Inter, system-ui, sans-serif", fontWeight: 500, lineHeight: 1.3 }}>{channel}</div>
                    <div className="text-body-sm" style={{ color: "#8B8680", marginTop: 4 }}>{role}</div>
                  </button>
                  {isOpen && (
                    <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${AMBER}33` }}>
                      <RichOutput text={stripLeadingLabels(body, [channel, "CHANNEL BRIEF", role])} />
                    </div>
                  )}
                  <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
                    <button type="button" onClick={() => download(`${channel.replace(/\s+/g, "-").toLowerCase()}-brief.md`, body)}
                      className="text-mono" style={{
                        background: "none", border: `1px solid ${AMBER}40`, color: AMBER,
                        padding: "6px 12px", borderRadius: 6, fontSize: 10, letterSpacing: "0.12em",
                        textTransform: "uppercase", cursor: "pointer",
                      }}>Download</button>
                  </div>
                </div>
              );
            })}
          </div>
          <FidelityPanel report={fidelity} onRecheck={handleRecheck} busy={fidelityBusy} />

          <div style={{ marginTop: 24, padding: 16, border: `1px solid ${AMBER}33`, borderRadius: 8, backgroundColor: "#0A0908" }}>
            <label htmlFor="stage21-audience-channel" className="text-mono" style={{ display: "block", color: AMBER, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>
              Audience and Channel Direction
            </label>
            <div className="text-body-sm" style={{ color: "#8B8680", marginBottom: 10 }}>
              Free-text correction to the channel selection when the default recommendations are wrong for the specific audience. Injected into the regeneration prompt as a mandatory constraint. Not a creative direction field.
            </div>
            <textarea
              id="stage21-audience-channel"
              value={audienceChannelDirection}
              onChange={(e) => setAudienceChannelDirection(e.target.value)}
              rows={4}
              placeholder="e.g. Audience is procurement leads aged 45+ in regional Australia — LinkedIn and TikTok are wrong, prioritise trade press and industry events instead."
              style={{
                width: "100%", backgroundColor: "#0A0908", color: "#EDE8E0",
                border: "1px solid #1C1A18", borderRadius: 6, padding: 12,
                fontFamily: "inherit", fontSize: 14, lineHeight: 1.5, resize: "vertical",
              }}
            />
          </div>
          <div id="creative-stimulus" style={{ scrollMarginTop: 140, marginTop: 28 }}>
            <Link
              to="/creative/$sessionId"
              params={{ sessionId: session.id }}
              style={{
                display: "block",
                textDecoration: "none",
                border: `1px solid ${AMBER}44`,
                borderRadius: 10,
                padding: "20px 24px",
                backgroundColor: "#0A0908",
              }}
            >
              <div className="text-mono" style={{ color: AMBER, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase" }}>
                Creative Engine →
              </div>
              <div className="text-body-sm" style={{ color: "#8B8680", marginTop: 6 }}>
                The Creative Stimulus Engine now has its own room. It reads these channel briefs as
                background input — open it to run the 37-lens sweep, Tissue Check, Gate One,
                orchestration and Gate Two.
              </div>
            </Link>
          </div>

          <div style={{ marginTop: 16, display: "flex", gap: 12, justifyContent: "flex-end", flexWrap: "wrap" }}>
            <AmberButton variant="ghost" onClick={handleForceRegenerate} disabled={busy}>
              {busy ? <><Spinner /> Regenerating…</> : "Retry"}
            </AmberButton>
            <AmberButton variant="ghost" onClick={downloadAll}>Download All Channel Briefs</AmberButton>
            <AmberButton onClick={handleProceed} disabled={proceeding}>
              {proceeding ? <><Spinner /> Loading...</> : "Proceed to Stage 22"}
            </AmberButton>
          </div>

        </>
      )}
    </section>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// STAGE 22 — Brand Architecture
// ═════════════════════════════════════════════════════════════════════════
const ARCH_COMPONENTS = ["REFLECTION", "DOMAIN", "HERITAGE", "VALUES", "ASSETS", "PERSONALITY"] as const;

function extractArchSection(arch: string, label: string): string {
  const re = new RegExp(`(?:^|\\n)\\s*${label}\\s*:\\s*([^\\n]+)`, "i");
  const m = arch.match(re);
  return m ? m[1].trim() : "";
}

function Stage22({ session, onChange }: { session: SessionRow; onChange: () => void | Promise<void> }) {
  const run = useServerFn(runStage22);
  const load = useServerFn(loadStage22);
  const regenerate = useServerFn(regenerateStage22);
  const [architecture, setArchitecture] = useState<string | null>(session.stage_22_brand_architecture);
  const [assets, setAssets] = useState<string | null>(session.stage_22_distinctive_assets);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const autoTriggeredRef = useRef(false);

  useEffect(() => { setArchitecture(session.stage_22_brand_architecture); }, [session.stage_22_brand_architecture]);
  useEffect(() => { setAssets(session.stage_22_distinctive_assets); }, [session.stage_22_distinctive_assets]);

  useEffect(() => {
    if (architecture === null && assets === null && !session.stage_22_brand_architecture && !session.stage_22_distinctive_assets) {
      load({ data: { sessionId: session.id } }).then((r) => {
        if (r.architecture) setArchitecture(r.architecture);
        if (r.assets) setAssets(r.assets);
      }).catch(() => {});
    }
  }, [architecture, assets, load, session.id, session.stage_22_brand_architecture, session.stage_22_distinctive_assets]);

  const handleRun = async () => {
    setBusy(true); setErr(null);
    try {
      const r = await run({ data: { sessionId: session.id } });
      setArchitecture(r.architecture); setAssets(r.assets); await onChange();
    } catch (e) { setErr(e instanceof Error ? e.message : "Stage 22 failed"); }
    finally { setBusy(false); }
  };

  const handleRegenerate = async () => {
    setBusy(true); setErr(null);
    try {
      const r = await regenerate({ data: { sessionId: session.id } });
      setArchitecture(r.architecture); setAssets(r.assets); await onChange();
    } catch (e) { setErr(e instanceof Error ? e.message : "Regeneration failed"); }
    finally { setBusy(false); }
  };

  useEffect(() => {
    if (autoTriggeredRef.current) return;
    const stage21Ready = session.stage_21_outputs && Object.keys(session.stage_21_outputs).length > 0;
    if (!stage21Ready) return;
    if (session.stage_22_brand_architecture) return;
    if (architecture !== null && architecture !== "") return;
    if (busy) return;
    autoTriggeredRef.current = true;
    void handleRun();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.stage_21_outputs, session.stage_22_brand_architecture, architecture]);


  const printPdf = () => window.print();

  const reflection = architecture ? extractArchSection(architecture, "REFLECTION") : "";
  const peripherals = (["DOMAIN", "HERITAGE", "VALUES", "ASSETS", "PERSONALITY"] as const)
    .map((label) => ({ label, content: architecture ? extractArchSection(architecture, label) : "" }));

  const stage22BlockedReason = !session.stage_20_approved
    ? "Stage 20 must be approved before Stage 22 can run."
    : !session.stage_21_outputs || Object.keys(session.stage_21_outputs).length === 0
      ? "Stage 21 must complete before Stage 22 can run."
      : null;

  return (
    <section>
      <SectionTitle kicker="STAGE 22" title="Brand Architecture" subtitle="The completed brand architecture and distinctive asset architecture." />
      {err && <ErrorBanner message={err} />}
      {stage22BlockedReason && <ErrorBanner message={stage22BlockedReason} />}
      {!architecture ? (
        <AmberButton onClick={handleRun} disabled={busy || !!stage22BlockedReason}>
          {busy && !stage22BlockedReason && <Spinner />} {busy && !stage22BlockedReason ? "Generating…" : stage22BlockedReason ? "Blocked — see above" : "Run Stage 22"}
        </AmberButton>

      ) : (
        <div id="phase2-print-region">
          {/* Visual layout: 5 peripherals around central reflection */}
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16,
            backgroundColor: "#0A0908", border: "1px solid #1C1A18",
            borderRadius: 12, padding: 24,
          }}>
            {peripherals.slice(0, 3).map((p) => <ArchBox key={p.label} {...p} />)}
            <ArchBox {...peripherals[3]} />
            <div style={{
              backgroundColor: "#0A0908", border: `1px solid ${AMBER}`,
              borderRadius: 8, padding: 24, display: "flex", flexDirection: "column", justifyContent: "center",
            }}>
              <div className="phase2-label" style={{ marginTop: 0 }}>REFLECTION</div>
              <div className="text-mono" style={{
                color: AMBER, fontSize: 28, lineHeight: 1.2, marginTop: 8,
                fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase",
                whiteSpace: "pre-wrap",
              }}>{sanitiseOutput(reflection) || "—"}</div>
            </div>
            <ArchBox {...peripherals[4]} />
          </div>


          {/* Distinctive Assets */}
          {assets && (
            <div style={{ marginTop: 32 }}>
              <div style={{
                color: AMBER, textTransform: "uppercase", fontSize: "7pt",
                letterSpacing: "0.18em", marginBottom: 16, fontFamily: "Inter, system-ui, sans-serif", fontWeight: 500,
              }}>CONCEPTUAL ASSETS</div>
              <div style={{ backgroundColor: "#0A0908", border: "1px solid #1C1A18", borderRadius: 8, padding: 24 }}>
                <RichOutput text={stripLeadingLabels(assets, ["CONCEPTUAL ASSETS", "DISTINCTIVE ASSETS", "DISTINCTIVE ASSET ARCHITECTURE", "ASSETS"])} />
              </div>
            </div>
          )}

          {busy && (
            <div style={{
              marginTop: 24, padding: 20, borderRadius: 8,
              backgroundColor: "#0A0908", border: `1px solid ${AMBER}44`,
              display: "flex", alignItems: "center", gap: 12,
            }}>
              <Spinner />
              <span className="text-mono" style={{ color: AMBER, fontSize: 13, letterSpacing: "0.12em", textTransform: "uppercase" }}>
                Regenerating Brand Architecture — this may take a few minutes…
              </span>
            </div>
          )}

          <div style={{ marginTop: 24, display: "flex", gap: 12, justifyContent: "flex-end", flexWrap: "wrap" }}>
            <AmberButton variant="ghost" onClick={handleRegenerate} disabled={busy}>
              {busy ? <><Spinner /> Regenerating…</> : "Regenerate This Stage"}
            </AmberButton>
            <AmberButton variant="ghost" onClick={printPdf} disabled={busy}>Download Brand Architecture</AmberButton>
            <AmberButton
              onClick={() => { window.location.href = `/complete?session=${session.id}`; }}
              disabled={busy}
            >
              Session Complete →
            </AmberButton>
          </div>
        </div>
      )}
    </section>
  );
}

function ArchBox({ label, content }: { label: string; content: string }) {
  return (
    <div style={{
      backgroundColor: "#0A0908", border: `1px solid ${AMBER}33`,
      borderRadius: 8, padding: 16, minHeight: 140,
    }}>
      <div style={{
        color: AMBER, textTransform: "uppercase", fontSize: "7pt",
        letterSpacing: "0.18em", marginBottom: 8, fontFamily: "Inter, system-ui, sans-serif", fontWeight: 500,
      }}>{label}</div>
      <div className="text-body-sm" style={{ color: "#EDE8E0", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{sanitiseOutput(content)}</div>
    </div>
  );
}
