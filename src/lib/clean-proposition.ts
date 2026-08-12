// Strips editorial scaffolding from a stored strategic proposition so no
// deliverable ever renders an editing instruction (e.g. "Replace X with - Y")
// or a superseded candidate line as if it were the final proposition.
//
// Applied at every read point that renders the proposition. Raw stored data
// is left untouched.

export function cleanProposition(input: string | null | undefined): string {
  if (!input) return "";
  let t = String(input).trim();

  // "Replace <old line> with - <final line>" → "<final line>"
  const replaceForm = t.match(/^\s*replace\s+[\s\S]{1,300}?\s+with\s*[-–—:]*\s*([\s\S]+)$/i);
  if (replaceForm) t = replaceForm[1];

  // Trailing editorial commentary ("this speaks to…", "this works because…").
  t = t.replace(/\s*\bthis\s+(speaks|works|refers|nods|plays|lands)\b[\s\S]*$/i, "");

  return t.replace(/\s{2,}/g, " ").trim();
}
