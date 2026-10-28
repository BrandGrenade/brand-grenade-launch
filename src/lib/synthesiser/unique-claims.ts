/** Exact claim identity only: never merge differently worded evidence. */
export function uniqueClaims<T extends { claim_text: unknown; heading: unknown; label?: unknown; source?: unknown; source_date?: unknown; position?: unknown }>(rows: T[]) {
  const groups = new Map<unknown, T[]>();
  for (const row of rows) {
    const group = groups.get(row.claim_text) ?? [];
    group.push(row);
    groups.set(row.claim_text, group);
  }
  return [...groups.values()].map((group, index) => ({
    ...group[0],
    position: index + 1,
    headings: [...new Set(group.flatMap(r => String(r.heading).split('; ')))],
    occurrences: group.map(r => ({ heading: r.heading, label: r.label ?? null, source: r.source ?? null, source_date: r.source_date ?? null })),
  }));
}