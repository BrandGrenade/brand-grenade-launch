// FULL CREATIVE SHOWCASE — client-side document builder.
//
// One campaign, presented as a whole. Four movements, in order:
//   1. The Foundation      — the locked idea and line, stated once, with the
//                            real reason it won.
//   2. The Six Expressions — each channel as an expression of that foundation,
//                            with the shared signature threads it carries.
//   3. Proof of Coherence  — the Orchestration Engine's own CD verdict.
//   4. Full detail         — the complete prompts and offline briefs, last.

import type { CreativeShowcase } from "@/lib/creative-showcase.functions";

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
.chan{border:1px solid var(--rule);border-left:3px solid var(--detonation);border-radius:8px;padding:22px;margin:16px 0;background:var(--surface);}
.chan .expresses{font-size:14px;line-height:1.7;}
.pill{display:inline-block;font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;
  border:1px solid var(--rule);border-radius:999px;padding:3px 10px;margin:0 6px 6px 0;color:var(--smoke);}
.pill.ok{border-color:#2F7D46;color:#67C08A;}
.pill.warn{border-color:#8A6A1F;color:#E0B34A;}
.pill.bad{border-color:#7D2F2F;color:#E5484D;}
.thread{border-top:1px dashed var(--rule);padding-top:10px;margin-top:10px;}
.thread .name{font-weight:600;font-size:14px;}
.thread .cat{color:var(--detonation);font-size:10px;letter-spacing:.14em;text-transform:uppercase;margin-left:8px;}
.evidence{color:var(--smoke);font-size:13px;font-style:italic;margin-top:4px;}
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
@media print{
  body{background:#fff;color:var(--ash);padding:0;}
  .movement{page-break-before:always;}
  .card,.chan,pre,details{background:#F4F1EC;border-color:#C2BCB5;color:var(--ash);}
  .muted,.evidence{color:#6B6660;}
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
    x.signatures.length
      ? `<h4>Campaign signature registry — the shared threads</h4><div class="card">${x.signatures
          .map(
            (s) =>
              `<div class="thread"><span class="name">${esc(s.name)}</span><span class="cat">${esc(
                s.category,
              )}</span><div class="muted">${esc(s.description)}</div></div>`,
          )
          .join("")}</div>`
      : `<p class="muted">No campaign signature registry recorded — run the Orchestration Engine to extract one.</p>`
  }
</div>`;

  const expressions = `
<div class="movement">
  <div class="movement-no">MOVEMENT 02</div>
  <h2>The ${chans.length === 6 ? "Six" : chans.length} Expressions</h2>
  <p class="muted">Not six assets. One idea, expressed ${chans.length} ways — each shown against the foundation above, with the shared threads it carries.</p>
  ${
    chans.length
      ? chans
          .map(
            (c) => `
  <div class="chan">
    <h3>${esc(c.channelName)}</h3>
    <p class="muted">How this channel expresses <strong>${esc(f.line || "the locked idea")}</strong></p>
    <div>
      <span class="pill ${c.gateOneConfirmed ? "ok" : "warn"}">${c.gateOneConfirmed ? "Gate One confirmed" : "Gate One not confirmed"}</span>
      ${fidelityPill(c.fidelity)}
    </div>
    ${c.fidelity?.reasoning ? `<p class="expresses">${esc(c.fidelity.reasoning)}</p>` : ""}
    <h4>Threads it carries</h4>
    ${
      c.carries.length
        ? c.carries
            .map(
              (s) =>
                `<div class="thread"><span class="name">${esc(s.name)}</span><span class="cat">${esc(
                  s.category,
                )}</span><div class="muted">${esc(s.description)}</div><div class="evidence">“…${esc(
                  s.evidence,
                )}…”</div></div>`,
            )
            .join("")
        : `<p class="muted">No registry signature is explicitly carried in this expression — the format legitimately omits the ones that do not apply to it.</p>`
    }
    ${
      c.crossRefs.length
        ? `<h4>Accepted cross-references</h4>${c.crossRefs
            .map((r) => `<p class="muted">${esc(r.suggestion)}${r.rationale ? ` — ${esc(r.rationale)}` : ""}</p>`)
            .join("")}`
        : ""
    }
    ${c.cdNote ? `<h4>Creative Director note</h4><p class="muted">${esc(c.cdNote)}</p>` : ""}
  </div>`,
          )
          .join("")
      : `<p class="muted">No channel expressions generated yet.</p>`
  }
</div>`;

  const cd = (x.coherence.cdStatus ?? "").toLowerCase();
  const verdictCls = !x.coherence.hasOrchestration ? "none" : cd.includes("pass") || cd === "complete" ? "pass" : cd.includes("fail") ? "fail" : "none";
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
        ? `Registry v${esc(x.coherence.registryVersion ?? "—")} · Gate Two ${
            x.coherence.gateTwoConfirmed
              ? `confirmed ${esc(stamp(x.coherence.gateTwoConfirmedAt))}`
              : "not yet confirmed"
          }`
        : "Run orchestration to produce a verified cohesion verdict across the set."
    }</p>
    ${x.coherence.cdOutput ? `<pre>${esc(x.coherence.cdOutput)}</pre>` : ""}
    ${x.coherence.gateTwoNotes ? `<p class="muted">Gate Two sign-off note — ${esc(x.coherence.gateTwoNotes)}</p>` : ""}
  </div>
  ${
    x.coherence.rejected.length
      ? `<h4>Rejected at the CD pass</h4><div class="card">${x.coherence.rejected
          .map(
            (r) =>
              `<p class="muted">${esc(r.channelName)}${r.lensName ? ` · ${esc(r.lensName)}` : ""} — ${esc(
                r.reason,
              )} (${esc(stamp(r.at))})</p>`,
          )
          .join("")}</div>`
      : ""
  }
</div>`;

  const detail = `
<div class="movement">
  <div class="movement-no">MOVEMENT 04</div>
  <h2>Full Detail</h2>
  <p class="muted">The working artefacts behind the presentation — open only if you want to go deeper.</p>
  ${chans
    .map(
      (c) => `
  <details>
    <summary>${esc(c.channelName)} — content creation input prompt</summary>
    <pre>${esc(c.adaptation)}</pre>
  </details>
  ${
    c.offlineBrief
      ? `<details><summary>${esc(c.channelName)} — offline creative brief</summary><pre>${esc(
          c.offlineBrief,
        )}</pre></details>`
      : ""
  }`,
    )
    .join("")}
  <hr/>
  <p class="muted">Brand Grenade — Creative Engine. One locked idea, ${chans.length} expressions, one verified campaign. Confidential.</p>
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
  ${foundation}
  ${expressions}
  ${coherence}
  ${detail}
</div></body></html>`;

  return { filename: `${slug(x.brandName)}-full-creative-showcase.html`, html };
}
