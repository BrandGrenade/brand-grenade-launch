import { describe, expect, it } from 'vitest';
import { explorationTargetStage, explorationModeRule, modeFraming, requireExplorationDecisions } from './modes';
import { PIPELINE_STAGES } from '../pipeline-navigation';

describe.each(['headroom', 'turnaround'] as const)('%s engine destinations', mode => {
  it('never stops a step feeding an in-range stage', () => {
    for (const step of [...PIPELINE_STAGES.filter(s => Number.parseInt(s.id, 10) <= 13 && s.id !== '13B').map(s => s.id), '9-loc', '9-loc-validation']) {
      expect(Number.parseInt(explorationTargetStage(step), 10)).toBeLessThanOrEqual(13);
      expect(() => requireExplorationDecisions(step, { A: true, B: true, C: true })).not.toThrow();
    }
  });
  it('runs all LOC preparation before B, retaining A and Stage 9 gates', () => {
    for (const step of ['9-loc', '9-loc-validation']) {
      expect(explorationTargetStage(step)).toBe('9');
      expect(() => requireExplorationDecisions(step, { A: true, B: false, C: false })).not.toThrow();
      expect(() => requireExplorationDecisions(step, { A: false, B: false, C: false })).toThrow('Checkpoint A');
      expect(modeFraming({ mode, baselineJobId: '00000000-0000-4000-8000-000000000001', market: 'UK', growthAmbition: 'Growth', timeHorizon: 'Years', constraints: 'Evidence', categoriesAndMarkets: 'Cars', performanceSymptoms: 'Volume', marketsAndChannels: 'Retail', knownCommercialFactors: 'Unknown', partnerHypotheses: 'Hypothesis' }, step)).toContain(`[${mode.toUpperCase()} CONTEXT]`);
    }
    expect(() => requireExplorationDecisions('9', { A: true, B: false, C: false })).toThrow('Checkpoint B');
  });
  it('still stops excluded stages and supplies a plain non-retryable rule', () => {
    expect(() => requireExplorationDecisions('14', { A: true, B: true, C: true })).toThrow('EXPLORATION_ENDS_AT_STAGE13');
    expect(explorationModeRule('EXPLORATION_ENDS_AT_STAGE13', mode)).toBe(`Not part of a ${mode === 'headroom' ? 'Headroom' : 'Turnaround'} run. This run ends at Stage 13.`);
    expect(explorationModeRule('Provider unavailable', mode)).toBeNull();
  });
});