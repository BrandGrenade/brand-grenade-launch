import fs from "node:fs";
import { buildExecSummaryDocument } from "./src/lib/exec-summary-document";
const session = JSON.parse(fs.readFileSync("/tmp/qantas.json", "utf8"));
const html = buildExecSummaryDocument(session, {});
fs.writeFileSync("/tmp/es.html", html);
console.log("bytes", html.length);
