import { buildExecSummaryDocument } from "../src/lib/exec-summary-document";
import fs from "fs";

const session = JSON.parse(fs.readFileSync("/tmp/qantas-row.json", "utf8"));
const intel = {}; // no Intelligence Lab context needed to verify Section 04

const html = buildExecSummaryDocument(session, intel);
fs.writeFileSync("/tmp/qantas-exec-summary.html", html);
console.log("Wrote /tmp/qantas-exec-summary.html");

// Extract Section 04 text
const match = html.match(/<div class="es-section"[^>]*>\s*<div class="es-section-number">SECTION 04<\/div>\s*<div class="es-section-title">Findings<\/div>([\s\S]*?)<\/div>\s*(<div class="es-section"|<div class="footer"|<\/div>)/);
if (match) {
  console.log("\n--- SECTION 04 FINDINGS ---\n");
  console.log(match[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
} else {
  console.log("Could not find Section 04 in output");
}
