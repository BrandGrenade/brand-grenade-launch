import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { EXPLORATION_OUT_OF_DATE, explorationSummaryOutOfDate, HeadroomResult, headroomSelectedAlternative, requireHeadroomSelection } from './modes';

const current = { selectionConfirmedAt: '2026-11-26T01:36:55Z', selectedSmp: 'Everything fitted is yours. The billing ends at handover.', runVersion: 12 };

describe('derived mode summary after reselection', () => {
  it('marks the earlier selection summary out of date until its replacement exists', () => {
    const old = { selectionConfirmedAt: '2026-11-25T10:16:47Z', selectedSmp: 'Pay for the engineering. The badge is free.', runVersion: 10 };
    expect(explorationSummaryOutOfDate(old, current)).toBe(true);
    expect(EXPLORATION_OUT_OF_DATE).toBe('Out of date: produced before the latest selection');
  });
  it('accepts only the summary produced for the latest confirmed selection', () => {
    expect(explorationSummaryOutOfDate({ ...current }, current)).toBe(false);
  });
  it('uses run version as a fallback for legacy records without decision provenance', () => {
    expect(explorationSummaryOutOfDate({ selectionConfirmedAt: null, selectedSmp: null, runVersion: 10 }, { selectionConfirmedAt: null, selectedSmp: null, runVersion: 12 })).toBe(true);
  });
  it('detects a summary whose internal selected alternative disagrees with its version metadata', () => {
    const outputs = { 'headroom.potential': { data: { alternatives: [{ position: 'The First Account', disposition: 'selected' }] } } };
    expect(headroomSelectedAlternative(outputs)).toBe('The First Account');
    expect(headroomSelectedAlternative(outputs)).not.toBe(current.selectedSmp);
  });
  it('refuses a Headroom summary that names any alternative other than the latest confirmed selection', () => {
    const result = HeadroomResult.parse({ alternatives: [{ position: current.selectedSmp, disposition: 'selected', reasons: ['Saved evidence'], evidence_refs: ['saved'] }], band: 'moderate', band_reasons: ['Saved evidence'], white_space_and_permission: [], conditions: ['Condition'], risks: [], evidence_refs: ['saved'], confidence: 'low', limitations: [] });
    expect(() => requireHeadroomSelection(result, current.selectedSmp)).not.toThrow();
    expect(() => requireHeadroomSelection(result, 'Pay for the engineering. The badge is free.')).toThrow('HEADROOM_SUMMARY_SELECTION_MISMATCH');
  });
  it('queues a fresh worker generation and preserves every earlier summary and attempt', () => {
    const sql = readFileSync('drizzle/migrations/0061_selection_summary_versions.sql', 'utf8');
    expect(sql).toContain("ON CONFLICT(session_id) DO UPDATE SET");
    expect(sql).toContain("generation = public.bg_exploration_jobs.generation + 1");
    expect(sql).toContain('selection_confirmed_at, selected_smp');
    const worker = readFileSync('src/lib/exploration/modes.server.ts', 'utf8');
    expect(worker).toContain(".eq('generation',job.generation)");
    expect(worker).toContain('generation:job.generation');
  });
});