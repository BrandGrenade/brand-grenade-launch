import { describe, expect, it } from "vitest";
import { stripDocumentMetadata } from "./strip-document-metadata";

describe("audit marker normalisation", () => {
  it("keeps the prior score instead of orphaning it", () => {
    const out = stripDocumentMetadata(
      "**Brand Permission — 7/10.** Re-run under corrected anchors from 6. Named supporting evidence is substantial.",
    );
    expect(out).not.toMatch(/7\/10\.\s*from/i);
    expect(out).not.toMatch(/corrected anchors/i);
    expect(out).toContain("(revised from 6/10)");
  });

  it("normalises the parenthesised review marker", () => {
    const out = stripDocumentMetadata(
      "**Clean Air:** 8/10 — CORRECTED ON REVIEW (was 4/10). No named competitor occupies stealth.",
    );
    expect(out).not.toMatch(/CORRECTED ON REVIEW/i);
    expect(out).toContain("(revised from 4/10)");
    expect(out).toContain("No named competitor occupies stealth.");
  });

  it("never glues a sentence onto a score", () => {
    const out = stripDocumentMetadata(
      "Fame — 6/10.Re-run under corrected anchors. The line is memorable.",
    );
    expect(out).not.toMatch(/10\.[A-Za-z]/);
  });
});
