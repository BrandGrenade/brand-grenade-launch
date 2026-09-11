// Regenerates the Valuation Input Brief for one session using the same
// prompts, section defs, front matter and assembly order as the Stage 16
// server function, then writes it back to stage_16_valuation_output.
import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "fs";
import { getValuationSections, buildSectionUserMessage, type SessionForStage16 } from "../src/lib/stage16-sections";
import { callClaude } from "../src/lib/claude.server";
import { VALUATION_DISCLAIMER, VALUATION_READER_GUIDE, VALUATION_PROPOSITION_PROVENANCE } from "../src/lib/stage16.functions";
import { deriveRunFacts } from "../src/lib/run-facts";

const sb = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const id = process.argv[2];
const { data: s, error } = await sb.from("sessions").select("*").eq("id", id).maybeSingle();
if (error || !s) { console.error("session load failed", error); process.exit(1); }
const sess = s as Record<string, any>;

const brand = sess.brand_name ?? "Untitled Brand";
const category = sess.category ?? "";
const runFacts = deriveRunFacts(sess, "valuation");
const forSections = { ...sess, run_facts: runFacts } as unknown as SessionForStage16;

const parts: string[] = [];
parts.push(`# VALUATION INPUT BRIEF\n## ${brand} — ${category}\n\n*Brand Grenade Strategy Intelligence System*\n\n---\n`);
parts.push(`\n${VALUATION_DISCLAIMER}\n${VALUATION_READER_GUIDE}\n`);

const humanEvolved = /====\s*STAGE 10 RE-SCORE/i.test(String(sess.stage_10_output ?? ""));
console.log("human-evolved locked line detected:", humanEvolved);

const sections = getValuationSections(forSections);
for (const section of sections) {
  console.log("writing", section.name);
  let body = (await callClaude({
    systemPrompt: section.systemPrompt,
    userMessage: buildSectionUserMessage(section, brand, category),
    maxTokens: section.maxTokens,
    sessionId: id,
    stageLabel: `Stage 16 — ${section.name}`,
    stageNumber: "16",
    stageName: "Document Assembly",
  })).trim();
  if (section.name === "strength_index" && humanEvolved) {
    const fb = body.indexOf("\n\n");
    const opener = fb > 0 ? body.slice(0, fb).trim() : "";
    const isSummary = opener.length > 0 && opener.length < 400 && /^\*\*/.test(opener);
    body = isSummary
      ? `${opener}\n\n${VALUATION_PROPOSITION_PROVENANCE}${body.slice(fb).trim()}`
      : `${VALUATION_PROPOSITION_PROVENANCE}${body}`;
  }
  parts.push(`\n# ${section.title}\n\n${body}\n`);
}
parts.push(`\n---\n\n*Brand Grenade Strategy Intelligence System*\n*Confidential*\n`);

const output = parts.join("\n");
writeFileSync("/tmp/valuation.md", output);
const { error: ue } = await sb.from("sessions").update({ stage_16_valuation_output: output, stage_16_error: null }).eq("id", id);
console.log("saved", output.length, "chars", ue?.message ?? "ok");
