/**
 * Permanent guard: fail loudly if any Node-only API becomes reachable from the
 * client bundle graph.
 *
 * Walks every static import (and, with DYN=1, every dynamic import too) from
 * the router / route tree / start entry, and reports any module that imports a
 * Node built-in. Run: `bun scripts/audit-client-graph.ts` (add DYN=1 for the
 * paranoid pass that ignores server-function splitting).
 */

import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const ROOT = process.cwd();
const EXTS = [".ts", ".tsx", ".js", ".jsx"];
const ENTRIES = ["src/router.tsx", "src/routeTree.gen.ts", "src/start.ts"];

const NODE_RE =
  /from\s+["'](node:[^"']+)["']|require\(["'](node:[^"']+)["']\)|from\s+["'](fs|path|crypto|child_process|os|async_hooks|net|http|https|zlib|stream|worker_threads)["']/g;
const IMPORT_RE =
  /(?:^|\n)\s*import\s+(?:type\s+)?[^;]*?from\s+["']([^"']+)["']|(?:^|\n)\s*import\s+["']([^"']+)["']|(?:^|\n)\s*export\s+[^;]*?from\s+["']([^"']+)["']/g;
const DYN_RE = /import\(\s*["']([^"']+)["']\s*\)/g;

function resolveSpec(spec: string, from: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = join(ROOT, "src", spec.slice(2));
  else if (spec.startsWith(".")) base = resolve(dirname(from), spec);
  else return null;
  for (const suffix of ["", ...EXTS, ...EXTS.map((e) => `/index${e}`)]) {
    const candidate = base + suffix;
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

const seen = new Set<string>();
const hits: string[] = [];
const includeDynamic = process.env["DYN"] === "1";

function walk(file: string, trail: string[]): void {
  if (seen.has(file)) return;
  seen.add(file);
  const src = readFileSync(file, "utf8");

  for (const m of src.matchAll(NODE_RE)) {
    const line = src.slice(0, m.index ?? 0).split("\n").length;
    hits.push(
      `${file.replace(`${ROOT}/`, "")}:${line}  ${m[0].trim()}\n    via ${trail
        .map((t) => t.replace(`${ROOT}/`, ""))
        .join(" -> ")}`,
    );
  }

  for (const m of src.matchAll(IMPORT_RE)) {
    if (/import\s+type\s/.test(m[0])) continue;
    const spec = m[1] ?? m[2] ?? m[3];
    const target = spec ? resolveSpec(spec, file) : null;
    if (target) walk(target, [...trail, file]);
  }

  if (includeDynamic) {
    for (const m of src.matchAll(DYN_RE)) {
      const target = resolveSpec(m[1] as string, file);
      if (target) walk(target, [...trail, `${file} (dynamic)`]);
    }
  }
}

for (const entry of ENTRIES) walk(resolve(ROOT, entry), []);

console.log(`client-reachable modules scanned: ${seen.size}${includeDynamic ? " (incl. dynamic)" : ""}`);
if (hits.length) {
  console.error(`\nNode-only APIs reachable from the client graph:\n\n${hits.join("\n\n")}\n`);
  process.exit(1);
}
console.log("OK — no Node built-ins reachable from the client graph.");
