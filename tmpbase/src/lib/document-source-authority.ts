const INTELLIGENCE_SOURCE_MARKER =
  /\[FROM_INTELLIGENCE_ENGINE\s+session=([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\]/i;

/** Resolve only the exact Intelligence run carried into this strategy brief. */
export function intelligenceSourceIdFromBrief(
  briefText: string | null | undefined,
): string | null {
  return briefText?.match(INTELLIGENCE_SOURCE_MARKER)?.[1] ?? null;
}

export function sameTextAuthority(
  left: string | null | undefined,
  right: string | null | undefined,
): boolean {
  return (left ?? "").trim() === (right ?? "").trim();
}