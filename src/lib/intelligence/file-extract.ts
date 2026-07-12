// Client-side file text extraction for the Intelligence Lab input form.
//
// Runs entirely in the browser — server receives already-extracted plain text
// concatenated into the six research input fields. Supported formats:
// PDF, DOCX, PPTX, XLSX, CSV, TXT.

export const ACCEPTED_EXTENSIONS = [".pdf", ".docx", ".pptx", ".xlsx", ".csv", ".txt"] as const;
export const ACCEPT_ATTR = ACCEPTED_EXTENSIONS.join(",");
export const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB per file
export const MAX_TOTAL_BYTES = 50 * 1024 * 1024; // 50MB per session

export type FileKind = "pdf" | "docx" | "pptx" | "xlsx" | "csv" | "txt";

function kindOf(name: string): FileKind | null {
  const n = name.toLowerCase();
  if (n.endsWith(".pdf")) return "pdf";
  if (n.endsWith(".docx")) return "docx";
  if (n.endsWith(".pptx")) return "pptx";
  if (n.endsWith(".xlsx")) return "xlsx";
  if (n.endsWith(".csv")) return "csv";
  if (n.endsWith(".txt")) return "txt";
  return null;
}

export function detectKind(file: File): FileKind | null {
  return kindOf(file.name);
}

async function extractPdf(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  // Vite-friendly worker URL. The ?url suffix returns a public URL string.
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const parts: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .map((it) => ("str" in it ? (it as { str: string }).str : ""))
      .join(" ");
    parts.push(text);
  }
  return parts.join("\n\n");
}

async function extractDocx(file: File): Promise<string> {
  const mammoth = await import("mammoth");
  const buf = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer: buf });
  return result.value;
}

async function extractPptx(file: File): Promise<string> {
  const JSZipMod = await import("jszip");
  const JSZip = JSZipMod.default;
  const buf = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buf);
  const slidePaths = Object.keys(zip.files)
    .filter((p) => /^ppt\/slides\/slide\d+\.xml$/.test(p))
    .sort((a, b) => {
      const n = (s: string) => Number(s.match(/slide(\d+)\.xml/)?.[1] ?? 0);
      return n(a) - n(b);
    });
  const parts: string[] = [];
  for (const path of slidePaths) {
    const xml = await zip.files[path].async("string");
    // Extract all <a:t>…</a:t> text runs from the slide XML.
    const matches = xml.match(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g) ?? [];
    const text = matches
      .map((m) => m.replace(/<a:t[^>]*>|<\/a:t>/g, ""))
      .join(" ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
    parts.push(text.trim());
  }
  return parts.filter(Boolean).join("\n\n");
}

async function extractXlsx(file: File): Promise<string> {
  const XLSXMod = await import("xlsx");
  const XLSX = XLSXMod;
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const parts: string[] = [];
  for (const name of wb.SheetNames) {
    const sheet = wb.Sheets[name];
    const csv = XLSX.utils.sheet_to_csv(sheet);
    if (csv.trim()) parts.push(`# Sheet: ${name}\n${csv}`);
  }
  return parts.join("\n\n");
}

async function extractCsv(file: File): Promise<string> {
  // CSV is already text; return as-is with a header hint preserved.
  return await file.text();
}

async function extractTxt(file: File): Promise<string> {
  return await file.text();
}

export async function extractFileText(file: File): Promise<string> {
  const kind = detectKind(file);
  if (!kind) throw new Error(`Unsupported file type: ${file.name}`);
  switch (kind) {
    case "pdf":
      return extractPdf(file);
    case "docx":
      return extractDocx(file);
    case "pptx":
      return extractPptx(file);
    case "xlsx":
      return extractXlsx(file);
    case "csv":
      return extractCsv(file);
    case "txt":
      return extractTxt(file);
  }
}

export interface ExtractedFileMeta {
  field: string;
  filename: string;
  extracted_text_preview: string;
  file_type: FileKind;
  upload_status: "complete" | "error";
  bytes: number;
}
