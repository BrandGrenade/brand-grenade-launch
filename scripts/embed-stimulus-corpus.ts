// Build-time precomputation of LOC stimulus corpus embeddings.
//
//   bun run scripts/embed-stimulus-corpus.ts
//
// Re-run whenever STIMULUS_CORPUS_VERSION changes or entries are added.
// Writes src/lib/loc/stimulus-vectors.json (checked in — the runtime never
// embeds the corpus, only the brand context).

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  OBJECT_STIMULI,
  WORLD_STIMULI,
  STIMULUS_CORPUS_VERSION,
  stimulusText,
} from "../src/lib/loc/stimulus-corpus";

const MODEL = "openai/text-embedding-3-small";
const DIMENSIONS = 256;
const BATCH = 64;

async function embedBatch(inputs: string[], key: string): Promise<number[][]> {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: MODEL, input: inputs, dimensions: DIMENSIONS }),
  });
  if (!res.ok) throw new Error(`embeddings ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { data: Array<{ index: number; embedding: number[] }> };
  const out: number[][] = [];
  for (const d of json.data) out[d.index] = d.embedding;
  return out;
}

async function main() {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("LOVABLE_API_KEY not set");

  const items = [...OBJECT_STIMULI, ...WORLD_STIMULI].map((s) => ({
    id: s.id,
    text: stimulusText(s),
  }));

  const vectors: Record<string, number[]> = {};
  for (let i = 0; i < items.length; i += BATCH) {
    const slice = items.slice(i, i + BATCH);
    const vecs = await embedBatch(slice.map((s) => s.text), key);
    slice.forEach((s, j) => {
      vectors[s.id] = vecs[j]!.map((v) => Math.round(v * 1e5) / 1e5);
    });
    console.log(`embedded ${Math.min(i + BATCH, items.length)}/${items.length}`);
  }

  const target = resolve(import.meta.dirname, "../src/lib/loc/stimulus-vectors.json");
  writeFileSync(
    target,
    JSON.stringify(
      { model: MODEL, dimensions: DIMENSIONS, corpusVersion: STIMULUS_CORPUS_VERSION, vectors },
      null,
      0,
    ),
  );
  console.log(`wrote ${target} (${Object.keys(vectors).length} vectors)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
