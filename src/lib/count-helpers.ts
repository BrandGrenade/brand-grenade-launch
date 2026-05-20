// Helpers to count repeating structural elements in pipeline stage outputs.
// Used to enforce per-item completeness in downstream stages.

function lines(text: string | null | undefined): string[] {
  return (text ?? "").split("\n");
}

export function countHeadings(text: string | null | undefined, level: 2 | 3 = 2): number {
  const marker = "#".repeat(level) + " ";
  return lines(text).filter((l) => l.trim().startsWith(marker)).length;
}

export function countCallouts(text: string | null | undefined): number {
  return lines(text).filter((l) => l.trim().startsWith("> ")).length;
}

/** Count Strategic Territories / Universes / similar from a stage output.
 *  Uses ## headings as the primary signal, falls back to > callouts, then to 1. */
export function countSections(text: string | null | undefined, fallback = 1): number {
  const h = countHeadings(text, 2);
  if (h > 0) return h;
  const c = countCallouts(text);
  if (c > 0) return c;
  return fallback;
}
