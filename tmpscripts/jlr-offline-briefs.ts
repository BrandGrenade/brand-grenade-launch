// One-off: generate the 9 JLR offline creative briefs from the locked idea
// and Stage 21 channel strategies, with binding fact corrections.
// Usage: NODE_PATH=node_modules bun tmpscripts/jlr-offline-briefs.ts <channelIndexStart> <channelIndexEnd>

import { runOfflineCreativeBrief } from "../src/lib/stimulus/offline-brief.server";

const SESSION_ID = "3470f1ad-b322-4230-8e3d-bf0072e95b7a";
const USER_ID = "92e24d49-2fa7-4b25-be6e-22dda817df9d";

const FACT_CORRECTIONS = [
  "Idris Elba's night shifts were on the assembly line at Ford's Dagenham plant, not Cowley.",
  "Sean Connery's coffin polishing was in Edinburgh, not Southampton.",
].join("\n");

const CHANNELS = [
  "Large-format Roadside and Commuter Outdoor",
  "Retail Floor, Standing-room Occasions and Handover",
  "Earned Media and Independent Long-term Motoring Review",
  "Instagram and YouTube Creator-led Short Form and Examination",
  "Connected TV and YouTube Long Form, plus Thirty Second Broadcast Cuts",
  "Search and the Published-standard Destination",
  "Quality Print and Its Digital Editions, Carrying the Published Standard as Long Copy",
  "Owner CRM to the Qx60, Qx65 and Qx80 Installed Base",
  "Podcast and In-car Radio",
];

const start = Number(process.argv[2] ?? 0);
const end = Number(process.argv[3] ?? CHANNELS.length);

for (const channel of CHANNELS.slice(start, end)) {
  try {
    const r = await runOfflineCreativeBrief({
      sessionId: SESSION_ID,
      userId: USER_ID,
      channelName: channel,
      factCorrections: FACT_CORRECTIONS,
    });
    console.log(`OK  ${channel} -> run ${r.runId}, ${r.text.length} chars`);
  } catch (e) {
    console.log(`FAIL ${channel}: ${e instanceof Error ? e.message : String(e)}`);
  }
}
