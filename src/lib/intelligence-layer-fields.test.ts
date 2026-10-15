import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// intelligence_sessions.layer_1…10_output are retired (kept, never read).
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return files(p);
    return /\.(ts|tsx)$/.test(n) && !n.endsWith(".test.ts") && n !== "types.ts" ? [p] : [];
  });
}

describe("Intelligence Lab layer fields", () => {
  it("are not read anywhere in app code", () => {
    const hits = files(join(process.cwd(), "src")).filter((f) =>
      /layer_(\d+|\$\{[^}]*\})_output/.test(readFileSync(f, "utf8")),
    );
    expect(hits).toEqual([]);
  });
});
