// Full-wave Opus 5.5 migration runner. Usage: bun tmpscripts/opus55-wave.ts <id> [opus5|opus55|both]
import { callClaude } from "../src/lib/claude.server";
import { supabaseAdmin } from "../src/integrations/supabase/client.server";
import { __policyInternals } from "../src/lib/model-policy";
import { writeFileSync } from "node:fs";
export const SESSION_ID = "c5142f1d-a381-44aa-9b88-c21875cc7996";
export type Spec = { id: string; name: string; cols?: string; sessionId?: string; build: (s: any) => Promise<{ system: string; user: string; maxTokens: number }>; check: (out: string, s?: any) => { pass: boolean; detail: string }; factBound: boolean; skipWrapper?: boolean; direct?: (model: string) => Promise<string> };
const { SPECS_A } = await import("./opus55-specs-a").catch(() => ({ SPECS_A: [] as Spec[] }));
const { SPECS_B } = await import("./opus55-specs-b").catch(() => ({ SPECS_B: [] as Spec[] }));
const { SPECS_C } = await import("./opus55-specs-c").catch(() => ({ SPECS_C: [] as Spec[] }));
const { SPECS_D } = await import("./opus55-specs-d").catch(() => ({ SPECS_D: [] as Spec[] }));
const ALL: Spec[] = [...SPECS_A, ...SPECS_B, ...SPECS_C, ...SPECS_D];
const [id, which = "both"] = process.argv.slice(2);
const spec = ALL.find((x) => x.id === id);
if (!spec) throw new Error(`no spec ${id}; have ${ALL.map((x) => x.id).join(",")}`);
let s: any = null;
if (spec.cols) {
  const r = await supabaseAdmin.from("sessions").select(spec.cols).eq("id", spec.sessionId ?? SESSION_ID).single();
  if (r.error) throw r.error; s = r.data;
}
const call = spec.direct ? null as any : await spec.build(s);
if (call) writeFileSync(`/tmp/opus55/wave/${id}-input.txt`, call.system + "\n" + call.user);
if (process.env.INPUT_ONLY) process.exit(0);
const eff = __policyInternals.HIGH_EFFORT_STAGES.has(id) ? "high" : undefined;
async function run(model: string, tag: string) {
  const t0 = Date.now();
  try {
    const out = spec!.direct ? await spec!.direct(model) : await callClaude({ systemPrompt: call.system, userMessage: call.user, maxTokens: call.maxTokens, model, stageLabel: `Stage ${id} (${tag} wave check)`, stageNumber: id, stageName: spec!.name, skipUniversalWrapper: spec!.skipWrapper === true } as any);
    const secs = (Date.now() - t0) / 1000;
    writeFileSync(`/tmp/opus55/wave/${id}-${tag}.md`, out);
    const c = spec!.check(out, s);
    console.log(`RESULT id=${id} tag=${tag} secs=${secs} chars=${out.length} effort=${eff ?? "default"} structure=${c.pass ? "PASS" : "FAIL"} ${c.detail}`);
  } catch (e: any) {
    console.log(`RESULT id=${id} tag=${tag} secs=${(Date.now() - t0) / 1000} ERROR ${e?.message?.slice(0, 300)}`);
  }
}
const jobs = [];
if (which !== "opus55") jobs.push(run("claude-opus-5", "opus5"));
if (which !== "opus5") jobs.push(run("claude-opus-5-5", "opus55"));
await Promise.all(jobs);
