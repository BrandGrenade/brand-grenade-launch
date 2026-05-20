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

/** Count Stage 8 propositions specifically. Looks for blockquote bolded headlines,
 *  divider blocks, or PROPOSITION N labels — not generic ## sub-headings. */
export function countPropositions(text: string | null | undefined): number {
  if (!text) return 0;

  const textLines = lines(text);
  let count = 0;

  for (const line of textLines) {
    const trimmed = line.trim();

    // Count > **bold text** blockquotes — these are the proposition lines
    if (
      trimmed.startsWith(">") &&
      trimmed.includes("**") &&
      trimmed.length > 10 &&
      trimmed.length < 150
    ) {
      count++;
      continue;
    }

    // Count === or ═══ divider blocks — each proposition is separated by these
    if (trimmed.match(/^[═=]{5,}$/)) {
      count++;
      continue;
    }

    // Count PROPOSITION N labels
    if (trimmed.match(/^PROPOSITION\s+\d+/i)) {
      count++;
      continue;
    }
  }

  // Prefer blockquote count as most reliable
  const blockquoteCount = (text.match(/^>\s*\*\*[^*\n]{5,100}\*\*/gm) || []).length;

  if (blockquoteCount > 0) return blockquoteCount;
  if (count > 0) return Math.ceil(count / 2);
  return 1;
}
