import { buildExecSummaryDocument } from "../src/lib/exec-summary-document";
import fs from "fs";

const session = JSON.parse(fs.readFileSync("/tmp/qantas-row.json", "utf8"));
const intel = {}; // no Intelligence Lab context needed to verify Section 04

const html = buildExecSummaryDocument(session, intel);
fs.writeFileSync("/tmp/qantas-exec-summary.html", html);
console.log("Wrote /tmp/qantas-exec-summary.html");

// Extract Section 04 text
const match = html.match(
  /<div class="section">\s*<div class="part-label">SECTION 04<\/div>\s*<h2>Findings<\/h2>\s*(?:<p>([\s\S]*?)<\/p>|<p class="es-missing">([\s\S]*?)<\/p>)/,
);
if (match) {
  console.log("\n--- SECTION 04 FINDINGS ---\n");
  console.log((match[1] || match[2]).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
} else {
  console.log("Could not find Section 04 in output");
}
