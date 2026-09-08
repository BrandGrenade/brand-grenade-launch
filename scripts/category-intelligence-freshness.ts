// Category Intelligence freshness audit.
//
// Stage 2 asserts a competitive set as current fact. Competitive sets change:
// Coles retired the Vintage Cellars and First Choice Liquor Market banners in
// 2025 and the Dan Murphy's session carried the dead names for months. This
// script lists every session whose Category Intelligence is old enough, or
// unverified enough, that it should be re-checked before any client-facing use.
//
//   bun scripts/category-intelligence-freshness.ts

import { createClient } from "@supabase/supabase-js";

/** Category Intelligence older than this is treated as at risk of drift. */
export const STAGE_2_STALE_AFTER_DAYS = 120;

export interface FreshnessRow {
  id: string;
  brand: string;
  ageDays: number;
  factVerified: boolean;
  stale: boolean;
}

export function assessFreshness(
  rows: { id: string; brand_name: string; created_at: string; stage_2_output: string | null }[],
  now = new Date(),
): FreshnessRow[] {
  return rows
    .filter((r) => r.stage_2_output)
    .map((r) => {
      const ageDays = Math.floor((now.getTime() - new Date(r.created_at).getTime()) / 86_400_000);
      const factVerified = /VERIFICATION REVIEW/i.test(r.stage_2_output!);
      return {
        id: r.id,
        brand: r.brand_name,
        ageDays,
        factVerified,
        stale: ageDays > STAGE_2_STALE_AFTER_DAYS || !factVerified,
      };
    })
    .sort((a, b) => b.ageDays - a.ageDays);
}

if (import.meta.main) {
  const sb = createClient(process.env["SUPABASE_URL"]!, process.env["SUPABASE_SERVICE_ROLE_KEY"]!, {
    auth: { persistSession: false },
  });
  const { data, error } = await sb
    .from("sessions")
    .select("id, brand_name, created_at, stage_2_output")
    .not("stage_2_output", "is", null);
  if (error) throw new Error(error.message);

  const rows = assessFreshness(data as never);
  console.log(`Category Intelligence freshness — ${rows.length} session(s) with Stage 2 output\n`);
  for (const r of rows) {
    console.log(
      `${r.stale ? "RE-VERIFY" : "ok       "}  ${r.ageDays.toString().padStart(4)}d  ` +
        `${r.factVerified ? "fact-verified" : "NOT fact-verified"}  ${r.brand}  ${r.id}`,
    );
  }
  const stale = rows.filter((r) => r.stale).length;
  console.log(
    `\n${stale} session(s) need a Category Intelligence re-verification pass before client-facing use.`,
  );
}
