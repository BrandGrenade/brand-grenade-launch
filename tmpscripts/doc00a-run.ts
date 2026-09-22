import { regenerateDocument00ARun } from "../src/lib/doc00a-regenerate.server";

const SESSION = "22c0ba9b-21af-41ce-8416-a259a4ae4541";
const instructions = `
Reconcile this report with the session's current state. Specifically:
1. "Built Different: Engineering Claim and Brand Identity" (t2) has absorbed the substance of the engineering-heritage, technology-transition and adjacent territories. Treat t2 as the recommended primary territory, and state plainly for each remaining territory whether it is subsumed into t2, retained as a distinct option, or retired. Do not present five independent competing options when they are no longer independent.
2. Remove all internal-culture / staff / employee-culture language everywhere it appears. That dimension was explicitly excluded by a business decision downstream. Do not reintroduce it under another name.
3. Carry the corrected evidence through: BYD's full-year 2025 Australian volume is 52,415 units (FCAI VFACTS plus Electric Vehicle Council, all BYD deliveries including the Shark 6 PHEV ute), not any lower figure. Never restate a superseded figure.
4. Claim language: any finding that a space is unoccupied, unclaimed or owned by nobody must be written as an absence finding ("no evidence was found in the research inputs supplied of ..."), never as flat fact. Any timeframe or window must be marked as a modelled estimate, not measured.
5. Exactly one territory carries gateway status, and it must be the recommended primary territory.
`.trim();

const res = await regenerateDocument00ARun({ sessionId: SESSION, instructions });
console.log(JSON.stringify(res, null, 2));
