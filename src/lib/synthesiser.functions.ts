// Research Synthesiser — server function boundary.
// Client-safe module: the handler body is stripped from the client bundle.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SynthesiserResult } from "./synthesiser/types";

const MAX_TOTAL_CHARS = 400_000;

const SynthesiseInput = z.object({
  brandName: z.string().trim().min(1).max(200),
  category: z.string().trim().min(1).max(200),
  documents: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(300),
        text: z.string().min(1).max(400_000),
      }),
    )
    .min(1)
    .max(20),
});

export const synthesiseResearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SynthesiseInput.parse(input))
  .handler(async ({ data }): Promise<SynthesiserResult> => {
    let budget = MAX_TOTAL_CHARS;
    const documents = data.documents.map((d) => {
      const slice = d.text.slice(0, Math.max(0, budget));
      budget -= slice.length;
      return { name: d.name, text: slice };
    });

    const { synthesiseResearchDocuments } = await import(
      "./synthesiser/synthesise.server"
    );
    return synthesiseResearchDocuments({
      brandName: data.brandName,
      category: data.category,
      documents: documents.filter((d) => d.text.trim().length > 0),
    });
  });
