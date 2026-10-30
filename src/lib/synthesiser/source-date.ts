/** Preserve source precision; never substitute an event, save or upload date. */
export function sourceDateFromExtraction(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const date = value.trim();
  if (date === 'Undated') return date;
  const match = date.match(/^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/);
  if (!match) return null;
  const year = Number(match[1]);
  if (year < 1800 || year > 2100) return null;
  if (match[2] && (Number(match[2]) < 1 || Number(match[2]) > 12)) return null;
  if (match[3]) {
    const parsed = new Date(`${date}T00:00:00Z`);
    if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0,10) !== date) return null;
  }
  return date;
}