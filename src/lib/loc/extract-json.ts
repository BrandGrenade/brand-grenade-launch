/** Extract the first complete JSON object, ignoring braces in quoted strings. */
export function extractLocJson(text: string): string {
  const start = text.indexOf("{");
  if (start < 0) throw new Error("LOC engine did not return a JSON object");
  let depth = 0;
  let quoted = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === '"') quoted = false;
    } else if (c === '"') quoted = true;
    else if (c === "{") depth++;
    else if (c === "}" && --depth === 0) return text.slice(start, i + 1);
  }
  throw new Error("LOC engine returned an incomplete JSON object");
}