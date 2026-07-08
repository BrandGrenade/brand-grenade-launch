// Model output frequently contains raw control characters (unescaped \n, \r,
// \t) inside JSON string literals. JSON.parse rejects those. Walk the string
// and escape control chars that appear between unescaped double quotes.
export function sanitizeJsonControlChars(input: string): string {
  let out = "";
  let inString = false;
  let escaped = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    const code = input.charCodeAt(i);
    if (!inString) {
      out += ch;
      if (ch === '"') inString = true;
      continue;
    }
    // inside string
    if (escaped) {
      out += ch;
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      out += ch;
      escaped = true;
      continue;
    }
    if (ch === '"') {
      out += ch;
      inString = false;
      continue;
    }
    if (code < 0x20) {
      if (ch === "\n") out += "\\n";
      else if (ch === "\r") out += "\\r";
      else if (ch === "\t") out += "\\t";
      else if (ch === "\b") out += "\\b";
      else if (ch === "\f") out += "\\f";
      else out += `\\u${code.toString(16).padStart(4, "0")}`;
      continue;
    }
    out += ch;
  }
  return out;
}

export function parseJsonLenient<T>(raw: string): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return JSON.parse(sanitizeJsonControlChars(raw)) as T;
  }
}
