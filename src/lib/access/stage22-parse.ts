// Parses the fixed Stage 22 line formats into records. Returns null when the
// stored text does not follow the format, so callers fall back to text.
const ARCH_KEYS = ["DOMAIN", "HERITAGE", "VALUES", "ASSETS", "PERSONALITY", "REFLECTION"] as const;
const clean = (s: string) => s.replace(/\*\*/g, "").replace(/^#+\s*/, "").trim();

export function parseStage22Architecture(t: string) {
  const out: Record<string, string> = {};
  for (const raw of t.split("\n")) {
    const m = /^([A-Z]+)\s*:\s*(.+)$/.exec(clean(raw));
    if (m && (ARCH_KEYS as readonly string[]).includes(m[1]) && !out[m[1]]) out[m[1]] = m[2].trim();
  }
  if (!ARCH_KEYS.every((k) => out[k])) return null;
  const list = (s: string) => s.split("/").map((x) => x.trim()).filter(Boolean);
  const [pw, ex] = out.PERSONALITY.split(/\s+[—–-]\s+/, 2);
  return {
    domain: out.DOMAIN,
    heritage: list(out.HERITAGE),
    values: list(out.VALUES),
    assets: list(out.ASSETS),
    personality: { words: pw.trim(), exemplar: ex?.trim() || null },
    reflection: out.REFLECTION,
  };
}

const SECTIONS = ["RECOMMENDED ASSETS", "DEPLOYMENT PRINCIPLES", "THE RECOGNITION TEST"] as const;
export function parseStage22Assets(t: string) {
  const buckets: Record<string, string[]> = {};
  let cur: string | null = null;
  for (const raw of t.split("\n")) {
    const line = clean(raw).replace(/:$/, "");
    if ((SECTIONS as readonly string[]).includes(line.toUpperCase())) { cur = line.toUpperCase(); buckets[cur] = []; continue; }
    if (cur && line) buckets[cur].push(line);
  }
  if (!SECTIONS.every((s) => buckets[s]?.length)) return null;
  const item = (s: string) => s.replace(/^([-*•]|\d+[.)])\s*/, "").trim();
  return {
    recommended_assets: buckets["RECOMMENDED ASSETS"].map((s) => {
      const m = /^(.*?)\s*\((Visual|Verbal|Sonic|Behavioural)\)\s*$/i.exec(item(s));
      return m ? { asset: m[1].trim(), type: m[2] } : { asset: item(s), type: null };
    }),
    deployment_principles: buckets["DEPLOYMENT PRINCIPLES"].map(item),
    recognition_test: buckets["THE RECOGNITION TEST"].join(" "),
  };
}
