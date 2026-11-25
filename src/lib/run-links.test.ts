import { describe, expect, it, vi } from 'vitest';
import { completedStages, runLinks, runPath } from './run-links';
import { requireLinkAdmin } from './run-links.functions';

describe('canonical saved run links', () => {
  const id = '3470f1ad-b322-4230-8e3d-bf0072e95b7a';
  it.each(['campaign','deal','diagnostic','validate','headroom','turnaround'])('%s active run opens its current checkpoint instead of a saved-output screen', mode => {
    const links = runLinks({ table: 'sessions', id, row: { status: 'awaiting_review', current_stage: 1, stage_1_output: 'saved', mode } });
    expect(links.open_url).toBe(`https://brandgrenade.app/pipeline?session=${id}`);
    expect(links.stage_urls['1']).toBe(`https://brandgrenade.app/runs/${id}?stage=1`);
  });
  it('opens latest saved stage 22, never stale current_stage', () => {
    const links = runLinks({ table: 'sessions', id, row: { current_stage: 8, stage_18_output: 'saved', stage_22_output: 'saved' } });
    expect(links.open_url).toBe(`https://brandgrenade.app/runs/${id}?stage=22`);
    expect(links.stage_urls['18']).toBe(`https://brandgrenade.app/runs/${id}?stage=18`);
    expect(Object.keys(links.stage_urls)).toEqual(['18', '22']);
  });
  it('does not treat empty or in-progress outputs as completed', () => {
    expect(completedStages({ status: 'complete', current_stage: 22, stage_21_outputs: {}, stage_22_output: ' ' })).toEqual([]);
  });
  it('preserves lettered saved stage anchors', () => {
    expect(completedStages({ stage_17b_output: 'saved', stage_20b_output: 'saved' })).toEqual(['17B', '20B']);
    expect(runPath(id, '17b')).toBe(`/runs/${id}?stage=17B`);
  });
  for (const table of ['synthesiser_runs','intelligence_sessions','briefing_room_workspaces','saved_briefs','stimulus_runs'] as const) {
    it(`${table} uses its own record ID without constructing session/workspace links`, () => {
      expect(runLinks({ table, id, row: { session_id: 'other' } }).open_url).toBe(`https://brandgrenade.app/runs/${id}`);
    });
  }
  it('refuses non-admin link checks', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: false, error: null });
    await expect(requireLinkAdmin({ rpc }, 'user')).rejects.toThrow('admins only');
    expect(rpc).toHaveBeenCalledWith('bg_is_admin', { _uid: 'user' });
  });
  it('refuses checks if role verification fails', async () => {
    await expect(requireLinkAdmin({ rpc: async () => ({ data: true, error: 'failed' }) }, 'user')).rejects.toThrow('admins only');
  });
});