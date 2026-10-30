import { describe,it,expect } from 'vitest';
import { sourceDateFromExtraction } from './source-date';
describe('source publication dates',()=>{
  it('preserves year-only precision',()=>expect(sourceDateFromExtraction('2023')).toBe('2023'));
  it('preserves month precision',()=>expect(sourceDateFromExtraction('2021-09')).toBe('2021-09'));
  it('preserves a valid full publication date',()=>expect(sourceDateFromExtraction('2026-10-30')).toBe('2026-10-30'));
  it('never invents a publication date from missing data',()=>expect(sourceDateFromExtraction(undefined)).toBeNull());
  it('rejects nonexistent source dates',()=>expect(sourceDateFromExtraction('2026-02-30')).toBeNull());
  it('rejects invalid source months',()=>expect(sourceDateFromExtraction('2026-13')).toBeNull());
});