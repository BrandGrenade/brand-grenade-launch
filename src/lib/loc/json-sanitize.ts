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

// Repair a JSON string that was truncated mid-stream by closing any open
// string literals, arrays, and objects, and trimming trailing commas or
// dangling keys. Best-effort — only used as a last-resort fallback after
// strict and sanitized parses both fail.
export function repairTruncatedJson(input: string): string {
  const sanitized = sanitizeJsonControlChars(input);
  const stack: string[] = [];
  let inString = false;
  let escaped = false;
  let lastNonWsOutsideString = "";
  for (let i = 0; i < sanitized.length; i++) {
    const ch = sanitized[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{" || ch === "[") stack.push(ch);
    else if (ch === "}" && stack[stack.length - 1] === "{") stack.pop();
    else if (ch === "]" && stack[stack.length - 1] === "[") stack.pop();
    if (ch.trim()) lastNonWsOutsideString = ch;
  }
  let out = sanitized;
  if (inString) out += '"';
  // Strip a trailing dangling key like `,"foo":` or `"foo":` with no value.
  out = out.replace(/,\s*"[^"]*"\s*:\s*$/, "");
  out = out.replace(/"[^"]*"\s*:\s*$/, "");
  // Strip a trailing comma before we close containers.
  out = out.replace(/,\s*$/, "");
  // If the last meaningful char was an opener, that container is empty — fine.
  void lastNonWsOutsideString;
  while (stack.length > 0) {
    const opener = stack.pop();
    out += opener === "{" ? "}" : "]";
  }
  return out;
}

export function parseJsonLenient<T>(raw: string): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    try {
      return JSON.parse(sanitizeJsonControlChars(raw)) as T;
    } catch {
      return JSON.parse(repairTruncatedJson(raw)) as T;
    }
  }
}
