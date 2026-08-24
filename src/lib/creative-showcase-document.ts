// FULL CREATIVE SHOWCASE — client-side document builder.
//
// STANDING TEMPLATE for this document type. Two clearly separated parts in
// one file:
//
//   FRONT MATTER — The Showcase (client-facing, reads first, dominates)
//     Movement 01  The Foundation — locked idea, campaign line, why it wins,
//                  and the signature devices named once, confidently.
//     Movement 02  The Expressions — each channel's creative output as full,
//                  unbroken hero content, with one short fidelity line that
//                  points at the appendix instead of reproducing it.
//     Movement 03  Proof of Coherence — the Orchestration Engine's CD verdict.
//
//   APPENDIX — Campaign Signature Registry & Consistency Trace (internal QA)
//     A. The deduplicated registry in full detail.
//     B. Per-channel signature trace with the evidence citations.
//     C. Accepted cross-references with their risk-weighing rationale.
//     D. Working artefacts — prompts and offline briefs.
//
// Registry rows are authored once at orchestration time and stored; evidence
// citations are recomputed on every render. Deduplication therefore happens
// here, at render, before either part of the document is built.

import type { CreativeShowcase, ShowcaseSignature } from "@/lib/creative-showcase.functions";
import { gateGenericDocument } from "./document-gate";

function esc(v: unknown): string {
  return String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function stamp(v: unknown): string {
  if (!v) return "—";
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "showcase";

/** Loose identity key so "Stealth. By Design." and "Stealth By Design" merge. */
const sigKey = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "");

/**
 * Front-matter copy states devices as fact. Strips comparative and hedging
 * scaffolding ("distinct from the SMP construction", "arguably", …) that
 * belongs in the QA register, never in the showcase.
 */
const HEDGE = /\b(?:as\s+)?(?:distinct from|as opposed to|not to be confused with|unlike)\b/i;

function confident(text: string): string {
  let t = String(text ?? "").trim();

  // Whole parenthetical asides that only exist to qualify: "(distinct from …)".
  t = t.replace(/\s*\(([^()]*)\)/g, (m, inner: string) => (HEDGE.test(inner) ? "" : m));

  // Set-off comparative clauses: ", distinct from the SMP construction," / "— unlike …".
  t = t.replace(
    /\s*[,;]\s*(?:as\s+)?(?:distinct from|as opposed to|not to be confused with|unlike)\b[^.;]*(?=[.;]|$)/gi,
    "",
  );
  t = t.replace(
    /\s*[—–-]\s*(?:as\s+)?(?:distinct from|as opposed to|not to be confused with|unlike)\b[^.;]*(?=[.;]|$)/gi,
    "",
  );

  // Plain hedges.
  t = t.replace(/\b(?:arguably|somewhat|fairly|relatively|broadly speaking|in a sense|essentially)\b\s*/gi, "");

  t = t.replace(/\s{2,}/g, " ").replace(/\s+([.,;])/g, "$1").trim();
  if (t && !/[.!?]$/.test(t)) t += ".";
  return t;
}

/** One entry per device. Longest description wins; the rest are folded in. */
function dedupeSignatures(sigs: ShowcaseSignature[]): ShowcaseSignature[] {
  const byKey = new Map<string, ShowcaseSignature>();
  for (const s of sigs) {
    const k = sigKey(s.name);
    if (!k) continue;
    const prev = byKey.get(k);
    if (!prev) {
      byKey.set(k, { ...s });
      continue;
    }
    if ((s.description ?? "").length > (prev.description ?? "").length) {
      byKey.set(k, { ...s, category: prev.category || s.category });
    }
  }
  return [...byKey.values()];
}

const CSS = `
:root{--void:#0A0908;--ash:#1C1A18;--paper:#EDE8E0;--smoke:#8B8680;--detonation:#C81E1E;
  --surface:#151312;--surface2:#1C1A18;--rule:#2A2724;}
*{box-sizing:border-box;}
body{background:var(--void);color:var(--paper);margin:0;padding:56px 24px 80px;line-height:1.65;
  font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;}
.wrap{max-width:900px;margin:0 auto;}
.kicker{color:var(--detonation);font-size:11px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;margin:0 0 14px;}
h1{font-size:44px;line-height:1.05;letter-spacing:-.02em;margin:0 0 10px;font-weight:700;}
h2{color:var(--detonation);font-size:12px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;margin:0 0 10px;}
h3{font-size:22px;font-weight:600;letter-spacing:-.01em;margin:0 0 6px;}
h4{font-size:13px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--smoke);margin:20px 0 6px;}
p{margin:0 0 10px;}
.muted{color:var(--smoke);font-size:13px;}
.movement{margin:56px 0 0;padding-top:28px;border-top:1px solid var(--rule);}
.movement-no{font-family:ui-monospace,Menlo,monospace;color:var(--smoke);font-size:11px;letter-spacing:.2em;margin-bottom:8px;}
.line{font-size:30px;line-height:1.2;font-weight:700;letter-spacing:-.02em;margin:0 0 14px;
  border-left:3px solid var(--detonation);padding-left:16px;}
.idea{font-size:17px;line-height:1.7;}
.card{border:1px solid var(--rule);border-radius:8px;padding:22px;margin:14px 0;background:var(--surface);}
.chan{border:1px solid var(--rule);border-left:3px solid var(--detonation);border-radius:8px;padding:26px;margin:20px 0;background:var(--surface);}
.hero{font-size:16px;line-height:1.75;white-space:pre-wrap;margin:12px 0 0;}
.fidelity-line{font-size:13px;color:var(--smoke);border-top:1px dashed var(--rule);margin-top:18px;padding-top:10px;}
.fidelity-line a{color:var(--detonation);text-decoration:none;}
.pill{display:inline-block;font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;
  border:1px solid var(--rule);border-radius:999px;padding:3px 10px;margin:0 6px 6px 0;color:var(--smoke);}
.pill.ok{border-color:#2F7D46;color:#67C08A;}
.pill.warn{border-color:#8A6A1F;color:#E0B34A;}
.pill.bad{border-color:#7D2F2F;color:#E5484D;}
.device{border-top:1px dashed var(--rule);padding-top:10px;margin-top:10px;}
.device .name{font-weight:600;font-size:15px;}
.device .cat{color:var(--detonation);font-size:10px;letter-spacing:.14em;text-transform:uppercase;margin-left:8px;}
.verdict{font-size:26px;font-weight:700;letter-spacing:-.01em;margin:0 0 8px;}
.verdict.pass{color:#67C08A;} .verdict.fail{color:#E5484D;} .verdict.none{color:var(--smoke);}
pre{white-space:pre-wrap;background:var(--surface2);border:1px solid var(--rule);border-radius:6px;padding:16px;
  font-family:ui-monospace,Menlo,monospace;font-size:12.5px;line-height:1.6;color:var(--paper);}
table.ratings{border-collapse:collapse;width:100%;font-size:13px;}
table.ratings th{text-align:left;color:var(--smoke);font-weight:500;padding:5px 12px 5px 0;text-transform:capitalize;width:200px;vertical-align:top;}
table.ratings td{padding:5px 12px 5px 0;vertical-align:top;}
details{border:1px solid var(--rule);border-radius:8px;padding:14px 18px;margin:12px 0;background:var(--surface);}
summary{cursor:pointer;font-weight:600;}
hr{border:none;border-top:1px solid var(--rule);margin:30px 0;}

/* ---------- APPENDIX: deliberately denser, more technical, unmistakably backing material ---------- */
.appendix-divider{margin:96px 0 0;border-top:3px double var(--rule);padding-top:22px;}
.appendix-divider .tag{display:inline-block;font-family:ui-monospace,Menlo,monospace;font-size:10px;letter-spacing:.24em;
  text-transform:uppercase;color:var(--void);background:var(--smoke);border-radius:3px;padding:4px 10px;margin-bottom:14px;}
.appendix-divider h2{font-size:20px;letter-spacing:.06em;color:var(--paper);text-transform:none;}
.appendix{font-family:ui-monospace,Menlo,monospace;font-size:12.5px;line-height:1.6;color:var(--smoke);
  border-left:2px solid var(--rule);padding-left:20px;margin-top:20px;}
.appendix h3{font-family:inherit;font-size:13px;letter-spacing:.16em;text-transform:uppercase;color:var(--paper);margin:32px 0 8px;}
.appendix h4{font-family:inherit;font-size:12px;letter-spacing:.1em;color:var(--detonation);margin:20px 0 6px;}
.appendix .row{border-bottom:1px solid var(--rule);padding:10px 0;}
.appendix .k{color:var(--paper);}
.appendix .quote{color:var(--smoke);font-style:normal;background:var(--surface2);border-left:2px solid var(--rule);
  padding:8px 12px;margin:6px 0 0;display:block;}
.appendix details{background:var(--surface2);}
.appendix .none{color:#6E6862;}

@media print{
  body{background:#fff;color:var(--ash);padding:0;}
  .movement,.appendix-divider{page-break-before:always;}
  .card,.chan,pre,details{background:#F4F1EC;border-color:#C2BCB5;color:var(--ash);}
  .muted,.appendix{color:#6B6660;}
  .appendix-divider .tag{background:#C2BCB5;color:#1C1A18;}
  details{page-break-inside:avoid;} details[open] summary{margin-bottom:8px;}
}
`;

function ratingsTable(ratings: unknown): string {
  if (!ratings || typeof ratings !== "object") return "";
  const dims = Object.entries(ratings as Record<string, unknown>).filter(
    ([, v]) => v && typeof v === "object" && "score" in (v as object),
  );
  if (!dims.length) return "";
  return `<table class="ratings"><tbody>${dims
    .map(([k, v]) => {
      const row = v as { score?: unknown; rationale?: unknown };
      return `<tr><th>${esc(k.replace(/_/g, " "))}</th><td>${esc(row.score)}</td><td class="muted">${esc(
        row.rationale ?? "",
      )}</td></tr>`;
    })
    .join("")}</tbody></table>`;
}

function fidelityPill(f: CreativeShowcase["channels"][number]["fidelity"]): string {
  if (!f) return `<span class="pill">Fidelity not checked</span>`;
  const v = (f.verdict || "").toLowerCase();
  const cls = v.includes("holds") || v === "pass" ? "ok" : v.includes("strain") ? "warn" : "bad";
  return `<span class="pill ${cls}">Fidelity ${esc(f.verdict)} · ${esc(f.score)}/10</span>
    <span class="pill ${f.lineVerbatim ? "ok" : "warn"}">Campaign line ${f.lineVerbatim ? "carried verbatim" : "not verbatim"}</span>`;
}

export function buildCreativeShowcase(x: CreativeShowcase): { filename: string; html: string } {
  const f = x.foundation;
  const chans = x.channels;

  // Deduplicate once, before either part of the document is built.
  const registry = dedupeSignatures(x.signatures);
  const registryKeys = new Set(registry.map((s) => sigKey(s.name)));

  // Per-channel carried threads, deduplicated against the same registry.
  const carriedByChannel = new Map<string, CreativeShowcase["channels"][number]["carries"]>();
  for (const c of chans) {
    const seen = new Set<string>();
    carriedByChannel.set(
      c.channelName,
      c.carries.filter((s) => {
        const k = sigKey(s.name);
        if (!k || seen.has(k) || !registryKeys.has(k)) return false;
        seen.add(k);
        return true;
      }),
    );
  }

  const anchor = (name: string) => `trace-${slug(name)}`;

  // ============================================ UNIVERSAL — BACKGROUND
  const background = `
<div class="movement" style="border-top:none;padding-top:0;">
  <div class="movement-no">BACKGROUND</div>
  <h2>Background and context</h2>
  <p>This is the <strong>Full Creative Showcase</strong> for ${esc(x.brandName)}${x.category ? ` · ${esc(x.category)}` : ""}, generated by the Brand Grenade Creative Stimulus Engine from one approved campaign in a single session. Nothing here is written from outside that session.</p>
  <p>It presents the locked creative idea and every channel expression built from it — ${chans.length} expression${chans.length === 1 ? "" : "s"} in total — together with the consistency trace that shows each expression carries the same idea. The appendix is internal QA material, not showcase content.</p>
  <p>It serves one decision: whether to approve this campaign, as presented, for production.</p>
</div>`;

  // ============================================ FRONT MATTER — MOVEMENT 01
  const foundation = `
<div class="movement" style="border-top:none;padding-top:0;">
  <div class="movement-no">MOVEMENT 01</div>
  <h2>The Foundation</h2>
  <p class="muted">Everything that follows is an expression of this one idea. It is stated here once, and once only.</p>
  <div class="card">
    <p class="line">${esc(f.line || "—")}</p>
    <h4>The winning idea${f.lens ? ` · lens: ${esc(f.lens)}` : ""}</h4>
    <p class="idea">${esc(f.idea)}</p>
    <p class="muted">Locked ${esc(stamp(f.lockedAt))}${
      f.ratingTotal != null ? ` · rated ${esc(f.ratingTotal)}/80 at the sweep` : ""
    }</p>
  </div>
  <h4>Why this idea wins</h4>
  <div class="card">
    ${f.instinctBrief ? `<p>${esc(f.instinctBrief)}</p>` : `<p class="muted">No instinct brief recorded against the winning lens.</p>`}
    ${ratingsTable(f.ratings) || `<p class="muted">No rating snapshot stored for the winning idea.</p>`}
  </div>
  ${x.smp ? `<h4>Strategic proposition it carries</h4><div class="card"><p>${esc(x.smp)}</p></div>` : ""}
  ${x.detonationLine ? `<p class="muted">Detonation line — ${esc(x.detonationLine)}</p>` : ""}
  ${
    registry.length
      ? `<h4>Signature devices</h4>
  <div class="card">
    <p class="muted">The devices every expression is built from. Each is named once, here.</p>
    ${registry
      .map(
        (s) =>
          `<div class="device"><span class="name">${esc(s.name)}</span><span class="cat">${esc(
            s.category,
          )}</span><div class="muted">${esc(confident(s.description))}</div></div>`,
      )
      .join("")}
  </div>`
      : `<p class="muted">No signature devices recorded — run the Orchestration Engine to extract the registry.</p>`
  }
</div>`;

  // ============================================ FRONT MATTER — MOVEMENT 02
  const expressions = `
<div class="movement">
  <div class="movement-no">MOVEMENT 02</div>
  <h2>The ${chans.length === 6 ? "Six" : chans.length} Expressions</h2>
  <p class="muted">Not ${chans.length} assets. One idea, expressed ${chans.length} ways. The work itself follows, whole and uninterrupted.</p>
  ${
    chans.length
      ? chans
          .map((c) => {
            const carried = carriedByChannel.get(c.channelName) ?? [];
            const verbatim = c.fidelity?.lineVerbatim;
            const fidelityLine =
              `${
                verbatim
                  ? `Carries the campaign line verbatim`
                  : c.fidelity
                    ? `Campaign line adapted, not verbatim`
                    : `Fidelity not yet checked`
              }${c.fidelity ? ` — fidelity ${esc(c.fidelity.verdict)} ${esc(c.fidelity.score)}/10` : ""}` +
              `${carried.length ? ` · ${carried.length} signature device${carried.length === 1 ? "" : "s"} carried` : ""}` +
              ` — full signature trace in <a href="#${anchor(c.channelName)}">Appendix B</a>.`;
            return `
  <div class="chan">
    <h3>${esc(c.channelName)}</h3>
    <p class="muted">How this channel expresses <strong>${esc(f.line || "the locked idea")}</strong></p>
    <div class="hero">${esc(c.adaptation)}</div>
    ${
      c.offlineBrief
        ? `<h4>Offline creative brief</h4><div class="hero">${esc(c.offlineBrief)}</div>`
        : ""
    }
    <p class="fidelity-line">${fidelityLine}</p>
  </div>`;
          })
          .join("")
      : `<p class="muted">No channel expressions generated yet.</p>`
  }
</div>`;

  // ============================================ FRONT MATTER — MOVEMENT 03
  const cd = (x.coherence.cdStatus ?? "").toLowerCase();
  const verdictCls = !x.coherence.hasOrchestration
    ? "none"
    : cd.includes("pass") || cd === "complete"
      ? "pass"
      : cd.includes("fail")
        ? "fail"
        : "none";
  const coherence = `
<div class="movement">
  <div class="movement-no">MOVEMENT 03</div>
  <h2>Proof of Coherence</h2>
  <p class="muted">Not a claim. The Orchestration Engine's own Creative Director cohesion pass across the set.</p>
  <div class="card">
    <p class="verdict ${verdictCls}">${
      x.coherence.hasOrchestration
        ? `CD cohesion verdict — ${esc((x.coherence.cdStatus ?? "unknown").toUpperCase())}`
        : "Orchestration Engine has not run on this campaign"
    }</p>
    <p class="muted">${
      x.coherence.hasOrchestration
        ? `Registry v${esc(x.coherence.registryVersion ?? "—")} · ${registry.length} signature device${
            registry.length === 1 ? "" : "s"
          } · Gate Two ${
            x.coherence.gateTwoConfirmed
              ? `confirmed ${esc(stamp(x.coherence.gateTwoConfirmedAt))}`
              : "not yet confirmed"
          }`
        : "Run orchestration to produce a verified cohesion verdict across the set."
    }</p>
    <p class="muted">The evidence behind this verdict — the per-channel signature trace and the cross-reference record — is set out in the Appendix.</p>
  </div>
</div>`;

  // ==================================================== APPENDIX (internal)
  const appxRegistry = `
  <h3>A · Campaign Signature Registry</h3>
  ${
    registry.length
      ? registry
          .map(
            (s) => `
  <div class="row">
    <div class="k">${esc(s.name)} <span style="color:var(--detonation)">[${esc(s.category)}]</span> <span class="none">status: ${esc(
      s.status,
    )}</span></div>
    <div>${esc(s.description)}</div>
  </div>`,
          )
          .join("")
      : `<p class="none">Registry empty — orchestration has not extracted signatures.</p>`
  }
  <p class="none">${x.signatures.length - registry.length > 0 ? `${x.signatures.length - registry.length} duplicate registry row(s) merged at render.` : "No duplicate registry rows detected."}</p>`;

  const appxTrace = `
  <h3>B · Per-channel consistency trace</h3>
  <p class="none">Traceability record. Each quotation is the passage in that channel's generated output where the device is present.</p>
  ${chans
    .map((c) => {
      const carried = carriedByChannel.get(c.channelName) ?? [];
      return `
  <h4 id="${anchor(c.channelName)}">${esc(c.channelName)}</h4>
  <div class="row"><span class="k">Fidelity:</span> ${
    c.fidelity
      ? `${esc(c.fidelity.verdict)} ${esc(c.fidelity.score)}/10 · line verbatim: ${c.fidelity.lineVerbatim ? "yes" : "no"}${
          c.fidelity.reasoning ? `<div>${esc(c.fidelity.reasoning)}</div>` : ""
        }`
      : "not checked"
  }</div>
  <div class="row"><span class="k">Gate One:</span> ${c.gateOneConfirmed ? "confirmed" : "not confirmed"} · <span class="k">generated:</span> ${esc(
    stamp(c.generatedAt),
  )}</div>
  ${
    carried.length
      ? carried
          .map(
            (s) => `
  <div class="row">
    <div class="k">${esc(s.name)} <span style="color:var(--detonation)">[${esc(s.category)}]</span></div>
    <span class="quote">…${esc(s.evidence)}…</span>
  </div>`,
          )
          .join("")
      : `<div class="row none">No registry device is explicitly carried in this expression — the format legitimately omits devices that do not apply to it.</div>`
  }
  ${c.cdNote ? `<div class="row"><span class="k">CD note:</span> ${esc(c.cdNote)}</div>` : ""}`;
    })
    .join("")}`;

  const allRefs = chans.flatMap((c) => c.crossRefs.map((r) => ({ ...r, channelName: c.channelName })));
  const appxRefs = `
  <h3>C · Accepted cross-references</h3>
  <p class="none">Suggested additions accepted at the cross-reference pass, with the risk-weighing recorded against each.</p>
  ${
    allRefs.length
      ? allRefs
          .map(
            (r) => `
  <div class="row">
    <div class="k">${esc(r.channelName)} — ${esc(r.suggestion)}</div>
    ${r.rationale ? `<div>${esc(r.rationale)}</div>` : `<div class="none">No rationale recorded.</div>`}
  </div>`,
          )
          .join("")
      : `<p class="none">No cross-references were accepted on this campaign.</p>`
  }
  ${
    x.coherence.rejected.length
      ? `<h4>Rejected at the CD pass</h4>${x.coherence.rejected
          .map(
            (r) =>
              `<div class="row">${esc(r.channelName)}${r.lensName ? ` · ${esc(r.lensName)}` : ""} — ${esc(
                r.reason,
              )} (${esc(stamp(r.at))})</div>`,
          )
          .join("")}`
      : ""
  }
  ${x.coherence.cdOutput ? `<h4>CD cohesion pass — full output</h4><pre>${esc(x.coherence.cdOutput)}</pre>` : ""}
  ${
    x.coherence.gateTwoNotes
      ? `<div class="row"><span class="k">Gate Two sign-off note:</span> ${esc(x.coherence.gateTwoNotes)}</div>`
      : ""
  }`;

  const appxArtefacts = `
  <h3>D · Working artefacts</h3>
  <p class="none">The generated inputs behind each expression, verbatim.</p>
  ${chans
    .map(
      (c) => `
  <details>
    <summary>${esc(c.channelName)} — content creation input prompt</summary>
    <pre>${esc(c.adaptation)}</pre>
  </details>${
    c.offlineBrief
      ? `<details><summary>${esc(c.channelName)} — offline creative brief</summary><pre>${esc(
          c.offlineBrief,
        )}</pre></details>`
      : ""
  }`,
    )
    .join("")}`;

  const appendix = `
<div class="appendix-divider">
  <span class="tag">Appendix · internal</span>
  <h2>Campaign Signature Registry &amp; Consistency Trace</h2>
  <p class="muted">Backing material, not showcase content. A QA register: what the registry holds, where each device is evidenced channel by channel, and how the cross-references were weighed.</p>
  <div class="appendix">
    ${appxRegistry}
    ${appxTrace}
    ${appxRefs}
    ${appxArtefacts}
    <hr/>
    <p class="none">Brand Grenade — Creative Stimulus Engine. One locked idea, ${chans.length} expression${
      chans.length === 1 ? "" : "s"
    }, one verified campaign. Confidential.</p>
  </div>
</div>`;

  // ============================================ UNIVERSAL — NEXT STEP
  const nextStep = `
<div class="movement">
  <div class="movement-no">NEXT STEP</div>
  <h2>Decisive recommendation — next step</h2>
  <p>Approve this campaign for production as presented: one locked idea carried across ${chans.length} channel expression${chans.length === 1 ? "" : "s"}, verified for consistency against the campaign signature registry.</p>
  <p>On approval, the channel expressions here become the production briefs. Any new channel added later must be generated against the same locked idea and re-run through the consistency trace before it is used.</p>
</div>`;

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(x.brandName)} — Full Creative Showcase</title><style>${CSS}</style></head>
<body><div class="wrap">
  <p class="kicker">Brand Grenade · Full Creative Showcase</p>
  <h1>${esc(x.brandName)}</h1>
  <p class="muted">${esc(x.category)} · One approved campaign, presented whole · ${esc(
    new Date().toLocaleDateString(),
  )}</p>
  ${background}
  ${foundation}
  ${expressions}
  ${coherence}
  ${nextStep}
  ${appendix}
</div></body></html>`;

  return {
    filename: `${slug(x.brandName)}-full-creative-showcase.html`,
    html: gateGenericDocument(html, "Full Creative Showcase", { narrativeSections: [] }),
  };
}
