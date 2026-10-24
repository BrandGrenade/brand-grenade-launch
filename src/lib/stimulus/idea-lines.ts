/** Accept historical full pairings as well as new supporting-only expressions. */
export function supportingExpression(expression: string, master: string): string {
  let support = expression.trim();
  const prefix = master.trim();
  if (!prefix) return support;
  while (support === prefix || (support.startsWith(prefix) && /\s/.test(support[prefix.length] ?? ""))) {
    support = support.slice(prefix.length).trimStart();
  }
  return support;
}

/** Only an explicitly specified line is binding; other quoted guidance stays context. */
export function specifiedRevisionLine(notes: string, hasMaster: boolean): { field: "line" | "expressionUnderMaster"; text: string } | null {
  const quote = /["“]([^"”]+)["”]/g;
  for (const match of notes.matchAll(quote)) {
    const before = notes.slice(Math.max(0, (match.index ?? 0) - 160), match.index).split(/[\n.!?]/).pop() ?? "";
    const after = notes.slice((match.index ?? 0) + match[0].length, (match.index ?? 0) + match[0].length + 100).split(/[\n.!?]/)[0] ?? "";
    const context = `${before} ${after}`;
    if (!/\b(?:field\s*[12]|(?:master|expression|end|closing|supporting|campaign)\s+line|tagline|line\s+(?:verbatim|exactly)|(?:use|keep|end\s+(?:on|with)|line\s+(?:is|must|should)))\b/i.test(context)) continue;
    const field = /\b(?:field\s*1|candidate\s+master\s+line)\b/i.test(context)
      ? "line"
      : /\b(?:field\s*2|expression\s+line|supporting\s+line)\b/i.test(context) || hasMaster
        ? "expressionUnderMaster"
        : "line";
    return { field, text: match[1] };
  }
  return null;
}