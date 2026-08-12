// Read-only prose renderer for the Demo Mode walkthrough.
// Same block grammar as the working pipeline output view, with all
// streaming / caret / auto-scroll behaviour removed.

type Block =
  | { kind: "h2"; text: string }
  | { kind: "h3"; text: string }
  | { kind: "subhead"; text: string }
  | { kind: "label"; text: string }
  | { kind: "para"; text: string }
  | { kind: "callout"; text: string }
  | { kind: "hr" }
  | { kind: "bullets"; items: string[] };

const MUTED = "#8B8680";
const CREAM = "#EDE8E0";
const RED = "#E5484D";

function parseBlocks(text: string): Block[] {
  const lines = text.split("\n");
  const blocks: Block[] = [];
  let bulletBuf: string[] = [];
  const flush = () => {
    if (bulletBuf.length) {
      blocks.push({ kind: "bullets", items: [...bulletBuf] });
      bulletBuf = [];
    }
  };
  const labelRe = /^(?:\*\*)?([A-Z0-9][A-Z0-9 \-—&/]{2,}):(?:\*\*)?\s*$/;
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      flush();
      continue;
    }
    if (line.startsWith("- ") || line.startsWith("* ")) {
      bulletBuf.push(line.slice(2));
      continue;
    }
    flush();
    if (/^---+\s*$/.test(line) || /^\*\*\*+\s*$/.test(line)) {
      blocks.push({ kind: "hr" });
    } else if (line.startsWith("#### ")) {
      blocks.push({ kind: "subhead", text: line.slice(5) });
    } else if (line.startsWith("### ")) {
      blocks.push({ kind: "h3", text: line.slice(4) });
    } else if (line.startsWith("## ")) {
      blocks.push({ kind: "h2", text: line.slice(3) });
    } else if (line.startsWith("# ")) {
      blocks.push({ kind: "h2", text: line.slice(2) });
    } else if (line.startsWith("> ")) {
      blocks.push({ kind: "callout", text: line.slice(2) });
    } else if (labelRe.test(line)) {
      const m = line.match(labelRe);
      blocks.push({ kind: "label", text: m ? (m[1] as string) : line });
    } else {
      blocks.push({ kind: "para", text: line });
    }
  }
  flush();
  return blocks;
}

function Inline({ text }: { text: string }) {
  const parts: Array<{ kind: "t" | "b" | "i"; v: string }> = [];
  const re = /(\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push({ kind: "t", v: text.slice(last, m.index) });
    const tok = m[0];
    if (tok.startsWith("**") || tok.startsWith("__")) parts.push({ kind: "b", v: tok.slice(2, -2) });
    else parts.push({ kind: "i", v: tok.slice(1, -1) });
    last = m.index + tok.length;
  }
  if (last < text.length) parts.push({ kind: "t", v: text.slice(last) });
  return (
    <>
      {parts.map((p, i) =>
        p.kind === "b" ? (
          <strong key={i} style={{ color: CREAM, fontWeight: 600 }}>
            {p.v}
          </strong>
        ) : p.kind === "i" ? (
          <em key={i}>{p.v}</em>
        ) : (
          <span key={i}>{p.v}</span>
        ),
      )}
    </>
  );
}

export function Prose({ text }: { text: string | null | undefined }) {
  if (!text || !text.trim()) return null;
  const blocks = parseBlocks(text);
  return (
    <div style={{ color: MUTED, lineHeight: 1.8 }}>
      {blocks.map((b, i) => {
        switch (b.kind) {
          case "h2":
            return (
              <h2
                key={i}
                className="text-h2"
                style={{ color: CREAM, fontWeight: 600, marginTop: 32, marginBottom: 12 }}
              >
                <Inline text={b.text} />
              </h2>
            );
          case "h3":
            return (
              <h3
                key={i}
                className="text-h3"
                style={{ color: CREAM, fontWeight: 600, marginTop: 24, marginBottom: 8 }}
              >
                <Inline text={b.text} />
              </h3>
            );
          case "subhead":
            return (
              <p
                key={i}
                className="text-body"
                style={{ color: CREAM, fontWeight: 600, marginTop: 16, marginBottom: 6 }}
              >
                <Inline text={b.text} />
              </p>
            );
          case "label":
            return (
              <p
                key={i}
                className="text-label"
                style={{
                  color: RED,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  marginTop: 24,
                  marginBottom: 8,
                }}
              >
                <Inline text={b.text} />
              </p>
            );
          case "hr":
            return (
              <hr key={i} style={{ border: 0, borderTop: "1px solid #1C1A18", margin: "24px 0" }} />
            );
          case "callout":
            return (
              <p
                key={i}
                className="text-body"
                style={{
                  borderLeft: "3px solid #C81E1E",
                  paddingLeft: 16,
                  color: MUTED,
                  fontStyle: "italic",
                  margin: "12px 0",
                }}
              >
                <Inline text={b.text} />
              </p>
            );
          case "bullets":
            return (
              <ul key={i} style={{ paddingLeft: 20, margin: "8px 0", listStyle: "none" }}>
                {b.items.map((item, j) => (
                  <li
                    key={j}
                    className="text-body"
                    style={{ position: "relative", margin: "4px 0", color: MUTED, lineHeight: 1.8 }}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        position: "absolute",
                        left: -16,
                        top: "0.7em",
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        backgroundColor: "#C81E1E",
                      }}
                    />
                    <Inline text={item} />
                  </li>
                ))}
              </ul>
            );
          case "para":
          default:
            return (
              <p
                key={i}
                className="text-body"
                style={{ color: MUTED, lineHeight: 1.8, marginBottom: 12 }}
              >
                <Inline text={b.text} />
              </p>
            );
        }
      })}
    </div>
  );
}
