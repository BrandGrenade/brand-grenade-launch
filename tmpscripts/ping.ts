import { callClaude } from "../src/lib/claude.server";
for (const m of ["claude-opus-5", "claude-opus-5-5"]) {
  try { const o = await callClaude({ systemPrompt: "Reply OK", userMessage: "ping", maxTokens: 2000, model: m, stageNumber: "1b", stageName: "ping" } as any); console.log("RESULT", m, "OK", JSON.stringify(o).slice(0, 80)); }
  catch (e: any) { console.log("RESULT", m, "ERR", String(e.message).slice(0, 250)); }
}
