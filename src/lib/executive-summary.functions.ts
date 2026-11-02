import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

/** Deliverables export: identical assembly to the access point's stage16.executive_summary. Read-only. */
export const getExecutiveSummary = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ sessionId: z.string().uuid(), version: z.number().int().positive().optional() }).parse(i))
  .handler(async ({ data, context }) => {
    const { assertSessionAccess } = await import('./auth-helpers.server');
    await assertSessionAccess(data.sessionId, context.userId);
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { supabaseDb } = await import('./access/access.server');
    const { executiveSummaryForRun } = await import('./access/core');
    const db = supabaseDb(supabaseAdmin);
    const run = await db.findRun(data.sessionId);
    if (!run || run.table !== 'sessions') throw new Error('Run not found');
    const out = await executiveSummaryForRun(db, run, data.version);
    const content = out.content as { text: string; record: { variant: string; word_count: number } };
    return { version: out.version, text: content.text, variant: content.record.variant, wordCount: content.record.word_count };
  });
