// Live proof of the effort capability guard.
//
// 1. Raw API control: send output_config.effort to claude-haiku-4-5 directly →
//    expected HTTP 400 (this is the failure the guard exists to prevent).
// 2. Guarded path: call the platform's own callClaude with effort:"high" on
//    claude-haiku-4-5 → expected success, field stripped, warning logged.
import { callClaude } from "@/lib/claude.server";

const key = process.env["ANTHROPIC_API_KEY"]!;

async function rawControl() {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5",
      max_tokens: 64,
      output_config: { effort: "high" },
      messages: [{ role: "user", content: "Reply with the single word READY." }],
    }),
  });
  console.log("RAW CONTROL status:", r.status);
  console.log("RAW CONTROL body:", (await r.text()).slice(0, 300));
}

async function guarded() {
  const reply = await callClaude({
    systemPrompt: "You are a health-check probe. Reply with exactly READY.",
    userMessage: "ping",
    maxTokens: 64,
    skipUniversalWrapper: true,
    model: "claude-haiku-4-5",
    stageNumber: "10", // a HIGH_EFFORT stage, to prove stage policy is stripped too
    effort: "high",
    stageLabel: "guard-test",
  });
  console.log("GUARDED reply:", JSON.stringify(reply.trim()));
}

await rawControl();
await guarded();
