// F1d item 4: every code path that clears a stored stage output (a rerun) must
// pass version_actor from the signed-in user so the saved version records who triggered it.
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return files(p);
    return /\.(ts|tsx)$/.test(f) && !/\.test\./.test(f) && !p.includes("integrations/supabase") ? [p] : [];
  });
}

// Fields that are versioned outputs on sessions / briefing_room_workspaces.
const CLEAR = /\b(stage_\w+_output|stage_\w+_structured|stage_12_smps|loc_engine_outputs|loc_decision_packages|loc_validation|diagnosis|truths|relevance|tensions)\s*:\s*null\b/;

function updateBlocks(src: string): { start: number; body: string }[] {
  const out: { start: number; body: string }[] = [];
  const re = /\.update\(\s*/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    let i = m.index + m[0].length;
    let depth = 0;
    const begin = i;
    for (; i < src.length; i++) {
      const c = src[i];
      if (c === "(" || c === "{" || c === "[") depth++;
      else if (c === ")" || c === "}" || c === "]") {
        if (depth === 0) break;
        depth--;
      }
    }
    out.push({ start: begin, body: src.slice(begin, i) });
  }
  return out;
}

describe("rerun actor coverage", () => {
  it("every update that clears a versioned output also sets version_actor (or spreads a field set that does)", () => {
    const offenders: string[] = [];
    for (const f of files("src")) {
      const src = readFileSync(f, "utf8");
      if (!/from\("(sessions|briefing_room_workspaces)"\)/.test(src)) continue;
      for (const b of updateBlocks(src)) {
        if (!CLEAR.test(b.body)) continue;
        const ok = /version_actor/.test(b.body) || /\.\.\.(baseFields|update)\b/.test(b.body) || /^update\b/.test(b.body.trim());
        if (!ok) offenders.push(`${f}:${src.slice(0, b.start).split("\n").length}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
