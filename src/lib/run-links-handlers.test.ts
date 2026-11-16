import { describe, expect, it, vi } from 'vitest';
vi.mock('@tanstack/react-start', () => ({ createServerFn: () => { const c = { middleware: () => c, inputValidator: () => c, handler: (fn: unknown) => fn }; return c; } }));
vi.mock('@/integrations/supabase/auth-middleware', () => ({ requireSupabaseAuth: {} }));
import { readSavedRun, checkClientRunLinks } from './run-links.functions';
const id = '9ab82c60-4051-49f2-9825-a175a9ce3ae9';
function client(rows: Record<string, any>) {
  return { rpc: async () => ({ data: false, error: null }), from: (table: string) => {
    const q: any = { select: () => q, eq: () => q, order: () => Promise.resolve({ data: rows[table] ?? [], error: null }), maybeSingle: () => Promise.resolve({ data: rows[table] ?? null, error: null }) }; return q;
  } };
}
const read = readSavedRun as unknown as (args: any) => Promise<any>;
describe('saved run routes', () => {
  it('opens a saved brief ID as a brief, never a nonexistent workspace', async () => {
    const result = await read({ data: { id }, context: { userId: 'owner', supabase: client({ saved_briefs: { brief_id: id, brand_name: 'JLR', brief_text: 'Saved exact brief' } }) } });
    expect(result.table).toBe('saved_briefs');
    expect(result.sections).toEqual([{ title: 'brief text', text: 'Saved exact brief' }]);
  });
  it('opens the creative run itself without treating its ID as a session', async () => {
    const result = await read({ data: { id }, context: { userId: 'owner', supabase: client({ stimulus_runs: { id, channel_name: 'Podcast' }, stimulus_directions: [{ lens_name: 'Offline creative brief', direction: 'Exact saved creative text' }] }) } });
    expect(result.id).toBe(id);
    expect(result.sections[0].text).toBe('Exact saved creative text');
  });
  it('keeps denied/missing runs indistinguishable', async () => {
    await expect(read({ data: { id }, context: { userId: 'other', supabase: client({}) } })).rejects.toThrow('Run not found, or you do not have access');
  });
  it('refuses a requested stage without saved output', async () => {
    await expect(read({ data: { id, stage: '18' }, context: { userId: 'owner', supabase: client({ sessions: { id, stage_17_output: 'saved' } }) } })).rejects.toThrow('Stage 18 has no saved output');
  });
  it('checks admin authority before enumerating client records', async () => {
    const sb = client({}); const from = vi.spyOn(sb, 'from');
    const check = checkClientRunLinks as unknown as (args: any) => Promise<any>;
    await expect(check({ data: { clientId: id }, context: { userId: 'other', supabase: sb } })).rejects.toThrow('admins only');
    expect(from).not.toHaveBeenCalled();
  });
});