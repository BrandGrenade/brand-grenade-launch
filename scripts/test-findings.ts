import { extractFindings } from "../src/lib/exec-summary-sections";
import fs from "fs";

const session = JSON.parse(fs.readFileSync("/tmp/qantas-row.json", "utf8"));
console.log("stage_2_output length:", (session.stage_2_output || "").length);
console.log("extractFindings result:", extractFindings(session, {}));
