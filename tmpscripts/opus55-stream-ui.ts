// Item 3: does live progress text still reach the UI through the platform's
// own streaming path on Opus 5.5? streamClaude is what every stage yields to
// the browser, so timing its deltas is the same signal the user sees.
import { streamClaude } from "../src/lib/claude.server";
const model = process.argv[2];
const t0 = Date.now();
let n = 0, chars = 0, first = -1, lastGap = 0, prev = t0;
for await (const d of streamClaude({
  systemPrompt: "You are a strategist.",
  userMessage: "Write 300 words on why Nissan's engineering credibility is under-leveraged in Australia.",
  maxTokens: 4000, model, effort: "high",
  stageLabel: `stream-ui-check ${model}`, stageNumber: "11",
})) {
  n++; chars += d.length;
  if (first < 0) first = Date.now() - t0;
  lastGap = Math.max(lastGap, Date.now() - prev); prev = Date.now();
}
console.log(`[${model}] deltas=${n} chars=${chars} first_delta_ms=${first} max_silent_gap_ms=${lastGap} total_s=${(Date.now()-t0)/1000}`);
