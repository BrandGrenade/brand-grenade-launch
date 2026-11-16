import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { completedStages, runLinks } from './run-links';
import { ROOM_OF, type RunRec, type RunTable } from './access/core';
import { STAGE_MANIFEST } from './stage-manifest';

const TABLES: RunTable[] = ['sessions', 'stimulus_runs', 'briefing_room_workspaces', 'saved_briefs', 'synthesiser_runs', 'intelligence_sessions'];
const idCol = (t: RunTable) => t === 'saved_briefs' ? 'brief_id' : 'id';
export async function requireLinkAdmin(sb: any, userId: string) {
  const { data, error } = await sb.rpc('bg_is_admin', { _uid: userId });
  if (error || data !== true) throw new Error('This check is available to platform admins only.');
}

export const readSavedRun = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator(i => z.object({ id: z.string().uuid(), stage: z.string().max(8).optional() }).parse(i))
  .handler(async ({ data, context }) => {
    // Keep ordinary reads under existing RLS; admins already have platform-wide read authority.
    const { data: isAdmin, error: roleError } = await context.supabase.rpc('bg_is_admin', { _uid: context.userId });
    if (roleError) throw new Error('Run access could not be checked. Try again.');
    const sb: any = isAdmin === true ? (await import('@/integrations/supabase/client.server')).supabaseAdmin : context.supabase;
    const hits = await Promise.all(TABLES.map(async table => {
      const { data: row, error } = await sb.from(table).select('*').eq(idCol(table), data.id).maybeSingle();
      if (error) throw new Error('Saved run could not be loaded. Try again.');
      return row ? { table, id: data.id, row } as RunRec : null;
    }));
    const run = hits.find((r): r is RunRec => r !== null);
    if (!run) throw new Error('Run not found, or you do not have access to it.');
    const stages = run.table === 'sessions' ? completedStages(run.row) : [];
    const selected = data.stage?.toUpperCase() ?? stages.at(-1);
    if (data.stage && !stages.includes(selected ?? '')) throw new Error(`Stage ${data.stage} has no saved output in this run.`);
    let sections: { title: string; text: string }[] = [];
    const display = (value: unknown) => typeof value === 'string' ? value : JSON.stringify(value, null, 2);
    if (run.table === 'sessions') {
      const entry = STAGE_MANIFEST.find(s => s.id.toUpperCase() === selected);
      sections = (entry?.columns ?? ['brief_text']).filter(c => run.row[c]).map(c => ({ title: c, text: display(run.row[c]) }));
    } else if (run.table === 'synthesiser_runs') {
      const { data: claims, error } = await sb.from('synthesiser_claims').select('heading,claim_text,label,source,source_date,position').eq('synthesiser_run_id', run.id).order('position');
      if (error) throw new Error('Saved research could not be loaded. Try again.');
      sections = (claims ?? []).map((c: any) => ({ title: c.heading ?? 'Claim', text: [c.claim_text, c.label, c.source, c.source_date].filter(Boolean).join('\n') }));
    } else if (run.table === 'stimulus_runs') {
      const [dirs, prompts] = await Promise.all([
        sb.from('stimulus_directions').select('*').eq('run_id', run.id).order('sort_order'),
        sb.from('stimulus_prompts').select('channel_name,final_prompt,status').eq('run_id', run.id).order('sort_order'),
      ]);
      if (dirs.error || prompts.error) throw new Error('Saved creative work could not be loaded. Try again.');
      sections = [...(dirs.data ?? []).map((d: any) => ({ title: d.lens_name ?? 'Direction', text: display(d) })), ...(prompts.data ?? []).map((p: any) => ({ title: p.channel_name, text: p.final_prompt ?? 'Final prompt not produced' }))];
    } else {
      const fields = run.table === 'saved_briefs' ? ['brief_text'] : run.table === 'intelligence_sessions' ? ['final_report'] : ['raw_brief','diagnosis','truths','relevance','tensions'];
      sections = fields.filter(c => run.row[c]).map(c => ({ title: c.replaceAll('_', ' '), text: display(run.row[c]) }));
    }
    return { id: run.id, table: run.table, room: ROOM_OF[run.table], brand: String(run.row.brand_name ?? run.row.channel_name ?? 'Saved run'), status: String(run.row.status ?? 'saved'), stages, selected, sections, ...runLinks(run) };
  });

export const checkClientRunLinks = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator(i => z.object({ clientId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await requireLinkAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const sb: any = supabaseAdmin;
    const groups = await Promise.all(TABLES.map(async table => {
      const { data: rows, error } = await sb.from(table).select(idCol(table)).eq('bg_client_id', data.clientId).eq('link_status', 'linked');
      if (error) throw new Error('Client runs could not be checked. Try again.');
      return (rows ?? []).map((r: any) => ({ run_id: r[idCol(table)], room: ROOM_OF[table], open_url: runLinks({ table, id: r[idCol(table)], row: {} }).open_url }));
    }));
    return groups.flat();
  });