// CREATIVE STIMULUS ENGINE — PHASE 4 export builders (client side).
// Two tiers: Raw Idea (the spark, no orchestration required) and Full Finished
// (the Gate Two-approved, orchestrated prompt set). Reference examples are
// linked out, never embedded — consistent with the licensing approach.

import { getLens } from "@/lib/stimulus/lenses";


function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function stamp(v: unknown): string {
  if (!v) return "—";
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

function refLinks(lensId: string): string {
  const lens = getLens(lensId);
  if (!lens || lens.references.length === 0) return "";
  return `<p class="refs">Real-world references (link out, nothing embedded): ${lens.references
    .map((r) => `<a href="${esc(r.url)}" target="_blank" rel="noreferrer noopener">${esc(r.label)}</a>`)
    .join(" · ")}</p>`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ratingsBlock(ratings: any): string {
  if (!ratings || typeof ratings !== "object") return `<p class="muted">Not scored.</p>`;
  const dims = Object.entries(ratings).filter(
    ([, v]) => v && typeof v === "object" && "score" in (v as object),
  );
  if (dims.length === 0) return `<pre class="muted">${esc(JSON.stringify(ratings, null, 2))}</pre>`;
  return `<table class="ratings"><tbody>${dims
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map(([k, v]: [string, any]) => {
      const label = k.replace(/_/g, " ");
      return `<tr><th>${esc(label)}</th><td>${esc(v.score)}</td><td>${esc(v.rationale ?? v.reason ?? "")}</td></tr>`;
    })
    .join("")}</tbody></table>`;
}

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600;700&display=swap');
  :root{--void:#0A0908;--ash:#1C1A18;--paper:#EDE8E0;--smoke:#8B8680;--detonation:#C81E1E;
    --surface:#151312;--rule:#2A2724;}
  body{background:var(--void);color:var(--paper);font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;
    line-height:1.65;margin:0;padding:48px;-webkit-font-smoothing:antialiased;}
  .wrap{max-width:880px;margin:0 auto;}
  h1{font-family:'Bebas Neue',Impact,sans-serif;font-weight:400;color:var(--paper);font-size:46px;line-height:1;letter-spacing:.01em;margin:0 0 8px;}
  h2{color:var(--detonation);font-size:13px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;margin:40px 0 12px;}
  h3{font-size:19px;font-weight:600;letter-spacing:-.01em;margin:0 0 6px;color:var(--paper);}
  .kicker,.muted,.refs,.meta{color:var(--smoke);font-size:13px;}
  .kicker{letter-spacing:.14em;text-transform:uppercase;font-size:13px;font-weight:600;margin-bottom:14px;}
  .card{border:1px solid var(--rule);border-radius:6px;padding:22px;margin:16px 0;background:var(--surface);}
  pre{white-space:pre-wrap;background:var(--surface);border:1px solid var(--rule);border-radius:6px;padding:16px;
    font-family:ui-monospace,Menlo,monospace;font-size:13px;color:var(--paper);line-height:1.6;}
  table.ratings{border-collapse:collapse;width:100%;font-size:13px;}
  table.ratings th{text-align:left;color:var(--smoke);font-weight:500;padding:5px 12px 5px 0;text-transform:capitalize;width:190px;vertical-align:top;}
  table.ratings td{padding:5px 12px 5px 0;vertical-align:top;color:var(--paper);}
  a{color:var(--detonation);}
  hr{border:none;border-top:1px solid var(--rule);margin:30px 0;}
  @media print{
    body{background:var(--paper);color:var(--ash);padding:24px;}
    h1,h3,table.ratings td{color:var(--ash);}
    .card,pre{background:#E1DCD4;border-color:#C2BCB5;color:var(--ash);}
    hr{border-top-color:#C2BCB5;}
  }
`;

function doc(title: string, body: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(title)}</title><style>${CSS}</style></head><body><div class="wrap">${body}</div></body></html>`;
}

export function download(filename: string, html: string) {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "export";

/* ------------------------------------------------------------- Raw Idea tier */

export type RawIdeaExport = {
  brandName: string;
  category: string;
  channelName: string;
  smp: string;
  direction: {
    lensId: string;
    lensName: string;
    text: string;
    instinctBrief: string;
    tissueStatus: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ratings: any;
    ratedAt: string | null;
    gateOneApproved: boolean;
    gateOneApprovedAt: string | null;
    gateOneNotes: string | null;
  };
};

/** One lens block — identical content in the single and batched exports. */
function rawIdeaBlock(d: RawIdeaExport["direction"]): string {
  const lens = getLens(d.lensId);
  return `
      <h2>The spark</h2>
      <div class="card">
        <h3>${esc(d.lensName)}</h3>
        <p class="muted">${esc(lens?.approach ?? "")}</p>
        ${lens ? `<p class="muted"><em>${esc(lens.provocation)}</em></p>` : ""}
        <pre>${esc(d.text)}</pre>
        ${refLinks(d.lensId)}
      </div>
      ${
        d.instinctBrief
          ? `<h2>Initial instinct</h2><div class="card"><p>${esc(d.instinctBrief)}</p></div>`
          : ""
      }
      <h2>Rating snapshot</h2>
      <div class="card">
        <p class="muted">Tissue Check: ${esc(d.tissueStatus)} · Gate One: ${
          d.gateOneApproved ? `approved ${esc(stamp(d.gateOneApprovedAt))}` : "not approved"
        }${d.ratedAt ? ` · rated ${esc(stamp(d.ratedAt))}` : ""}</p>
        ${ratingsBlock(d.ratings)}
        ${d.gateOneNotes ? `<p class="muted">Gate One notes: ${esc(d.gateOneNotes)}</p>` : ""}
      </div>`;
}

export type RawIdeaBatchExport = Omit<RawIdeaExport, "direction"> & {
  directions: RawIdeaExport["direction"][];
};

/**
 * Several lenses in one print-ready document — same content and format as the
 * single Raw Idea export, one lens per printed page.
 */
export function buildRawIdeaBatchExport(x: RawIdeaBatchExport): {
  filename: string;
  html: string;
} {
  const html = doc(
    `${x.brandName} — Raw ideas — ${x.directions.length} lenses`,
    `
      <p class="kicker">Brand Grenade · Creative Stimulus · Raw idea export (${x.directions.length} lenses)</p>
      <h1>${esc(x.brandName)}</h1>
      <p class="meta">${esc(x.category)}${x.channelName ? ` · ${esc(x.channelName)}` : ""}</p>
      ${x.smp ? `<p class="meta">SMP — ${esc(x.smp)}</p>` : ""}
      <p class="muted">Selected lenses: ${x.directions.map((d) => esc(d.lensName)).join(" · ")}</p>
      ${x.directions
        .map(
          (d, i) =>
            `<hr/><div${i > 0 ? ' style="page-break-before:always"' : ""}>${rawIdeaBlock(d)}</div>`,
        )
        .join("")}
      <hr/>
      <p class="muted">Raw stimulus, not finished work. No tool-specific prompt, no signature registry, no
      Creative Director cohesion pass applies to this export — take the sparks and develop them by hand.</p>
    `,
  );
  return {
    filename: `${slug(x.brandName)}-raw-ideas-${x.directions.length}-lenses.html`,
    html,
  };
}

export function buildRawIdeaExport(x: RawIdeaExport): { filename: string; html: string } {
  const html = doc(
    `${x.brandName} — Raw idea — ${x.direction.lensName}`,
    `
      <p class="kicker">Brand Grenade · Creative Stimulus · Raw idea export</p>
      <h1>${esc(x.brandName)}</h1>
      <p class="meta">${esc(x.category)} · ${esc(x.channelName)}</p>
      ${x.smp ? `<p class="meta">SMP — ${esc(x.smp)}</p>` : ""}
      <hr/>
      ${rawIdeaBlock(x.direction)}
      <hr/>
      <p class="muted">Raw stimulus, not finished work. No tool-specific prompt, no signature registry, no
      Creative Director cohesion pass applies to this export — take the spark and develop it by hand.</p>
    `,
  );
  return { filename: `${slug(x.brandName)}-raw-idea-${slug(x.direction.lensName)}.html`, html };
}


/* -------------------------------------------------------- Full Finished tier */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type FullExport = any;

export function buildFullFinishedExport(x: FullExport): { filename: string; html: string } {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const approved: any[] = x.approved ?? [];
  const html = doc(
    `${x.brandName} — Creative Showcase`,
    `
      <p class="kicker">Brand Grenade · Creative Stimulus · Full finished export</p>
      <h1>${esc(x.brandName)} — Creative Showcase</h1>
      <p class="meta">${esc(x.category)} · Registry v${esc(x.orchestration.registryVersion)} · CD verdict ${esc(
        x.orchestration.cdStatus,
      )} · Gate Two ${
        x.orchestration.gateTwoConfirmed
          ? `confirmed ${esc(stamp(x.orchestration.gateTwoConfirmedAt))}`
          : "not yet confirmed"
      }</p>
      ${x.smp ? `<p class="meta">SMP — ${esc(x.smp)}</p>` : ""}
      ${x.detonationLine ? `<p class="meta">Detonation — ${esc(x.detonationLine)}</p>` : ""}

      <h2>Approved prompt set — ${approved.length}</h2>
      ${approved
        .map(
          (p) => `
        <div class="card">
          <h3>${esc(p.channelName)} · ${esc(p.lensName)}</h3>
          <p class="muted">Tool target: ${esc(p.toolTarget || "—")} · Craft pass: ${esc(p.wadStatus)} · Gate Two approved ${esc(
            stamp(p.gateTwo.approvedAt),
          )}</p>
          <pre>${esc(p.finalPrompt)}</pre>
          ${refLinks(p.lensId)}
          <h2>Gate One rating snapshot</h2>
          ${ratingsBlock(p.gateOne.ratings)}
          ${p.gateOne.notes ? `<p class="muted">Gate One notes: ${esc(p.gateOne.notes)}</p>` : ""}
          ${p.cdNote ? `<p class="muted">CD cohesion note: ${esc(p.cdNote)}</p>` : ""}
          ${
            p.crossRefs.length
              ? `<p class="muted">Accepted cross-references: ${p.crossRefs
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  .map((c: any) => esc(c.suggestion))
                  .join(" · ")}</p>`
              : ""
          }
          ${
            p.revisionLog.length
              ? `<p class="muted">Revision notes: ${p.revisionLog
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  .map((r: any) => `${esc(stamp(r.at))} — ${esc(r.notes)}`)
                  .join(" · ")}</p>`
              : ""
          }
          ${p.gateTwo.notes ? `<p class="muted">Gate Two notes: ${esc(p.gateTwo.notes)}</p>` : ""}
        </div>`,
        )
        .join("")}

      <h2>Campaign signature registry</h2>
      <div class="card">
        ${
          (x.signatures ?? []).length
            ? (x.signatures as { category: string; name: string; description: string; status: string }[])
                .map(
                  (s) =>
                    `<p><strong>${esc(s.name)}</strong> <span class="muted">(${esc(s.category)}${
                      s.status !== "active" ? ` · ${esc(s.status)}` : ""
                    })</span><br/><span class="muted">${esc(s.description)}</span></p>`,
                )
                .join("")
            : `<p class="muted">No signatures recorded.</p>`
        }
      </div>

      <h2>Creative Director judgment</h2>
      <div class="card"><pre>${esc(x.orchestration.cdOutput || "—")}</pre></div>

      ${
        (x.rejected ?? []).length
          ? `<h2>Rejected at the CD pass</h2><div class="card">${(x.rejected as {
              channelName: string;
              lensName: string;
              reason: string;
              at: string | null;
            }[])
              .map(
                (r) =>
                  `<p class="muted">${esc(r.channelName)} · ${esc(r.lensName)} — ${esc(r.reason)} (${esc(stamp(r.at))})</p>`,
              )
              .join("")}</div>`
          : ""
      }

      ${
        (x.orchestration.amendmentLog ?? []).length
          ? `<h2>Set-level amendments</h2><div class="card">${(x.orchestration.amendmentLog as {
              at: string;
              notes: string;
            }[])
              .map((a) => `<p class="muted">${esc(stamp(a.at))} — ${esc(a.notes)}</p>`)
              .join("")}</div>`
          : ""
      }

      ${x.orchestration.gateTwoNotes ? `<h2>Gate Two sign-off note</h2><div class="card"><p>${esc(x.orchestration.gateTwoNotes)}</p></div>` : ""}

      <hr/>
      <p class="muted">A human takes these finished prompts into Adobe Firefly, Canva, or whichever tool fits.
      Live delivery into those tools is out of scope here.</p>
    `,
  );
  return { filename: `${slug(x.brandName)}-creative-showcase.html`, html };
}
