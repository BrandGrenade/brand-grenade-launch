import { describe, expect, it } from "vitest";
import { filterStructuredStream } from "./structured-output";

async function* src(parts: string[]) { for (const p of parts) yield p; }

describe("stream keep-alives (Stage 11 stall fix)", () => {
  it("passes empty keep-alive deltas through so a silent model (thinking) never leaves the client stream idle", async () => {
    const out: string[] = [];
    const sink = { raw: "" };
    for await (const d of filterStructuredStream(src(["", "", "Visible text."]), sink)) out.push(d);
    expect(out.filter((d) => d === "").length).toBe(2);
    expect(out.join("")).toBe("Visible text.");
    expect(sink.raw).toBe("Visible text.");
  });
  it("keeps the stream alive inside the hidden structured block without leaking it", async () => {
    const out: string[] = [];
    const sink = { raw: "" };
    for await (const d of filterStructuredStream(src(["Text.\n<<<STRUCTURED_JSON\n{", "", "}\n>>>"]), sink)) out.push(d);
    expect(out.join("")).toBe("Text.");
    expect(out).toContain("");
    expect(sink.raw).toContain("STRUCTURED_JSON");
  });
});
