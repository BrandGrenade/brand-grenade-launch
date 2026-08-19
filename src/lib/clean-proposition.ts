// Strips editorial scaffolding from a stored strategic proposition so no
// deliverable ever renders an editing instruction (e.g. "Replace X with - Y")
// or a superseded candidate line as if it were the final proposition.
//
// Applied at every read point that renders the proposition. Raw stored data
// is left untouched.
//
// CONTENT-INTEGRITY RULE (Issue 4): the trailing-commentary strip must never
// truncate a legitimate second sentence. Editorial commentary appended by the
// model is always joined onto the line by a dash/colon/parenthesis or a
// bracketed aside — never by full sentence punctuation. So the strip fires
// only on that separator form; a proposition whose own second sentence begins
// "This lands..." is returned complete.

const COMMENTARY_VERBS = "speaks|works|refers|nods|plays|lands";

export function cleanProposition(input: string | null | undefined): string {
  if (!input) return "";
  let t = String(input).trim();

  // "Replace <old line> with - <final line>" → "<final line>"
  const replaceForm = t.match(/^\s*replace\s+[\s\S]{1,300}?\s+with\s*[-–—:]*\s*([\s\S]+)$/i);
  if (replaceForm) t = replaceForm[1];

  // Trailing editorial commentary, but ONLY when it is attached as an aside:
  //   "… — this speaks to …", "… (this works because …)", "… : this lands …"
  // A commentary clause introduced by a sentence break (". This lands …") is
  // the author's own second sentence and is kept verbatim.
  t = t.replace(
    new RegExp(`\\s*[\\(\\[]?\\s*[-–—:;]+\\s*\\(?this\\s+(?:${COMMENTARY_VERBS})\\b[\\s\\S]*$`, "i"),
    "",
  );
  // Parenthesised aside with no dash: "… (this works because …)"
  t = t.replace(
    new RegExp(`\\s*[\\(\\[]\\s*this\\s+(?:${COMMENTARY_VERBS})\\b[\\s\\S]*$`, "i"),
    "",
  );

  return t.replace(/\s{2,}/g, " ").trim();
}
